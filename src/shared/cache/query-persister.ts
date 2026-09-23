import { dehydrate, hydrate } from "@tanstack/react-query";
import type {
  DehydratedState,
  Query,
  QueryClient,
} from "@tanstack/react-query";
import {
  isPersistDenied,
  PERSISTABLE_ROOTS,
  policyOfQueryKey,
} from "./cache-policy";
import {
  APP_BUILD_ID,
  CACHE_KEY_PREFIX,
  buildCacheNamespace,
  type CacheIdentity,
} from "./cache-namespace";
import { idbDelete, idbGet, idbKeys, idbSet } from "./idb";

/**
 * L3 — persisted query cache trên IndexedDB của máy người dùng.
 *
 * Bài toán: access token chỉ nằm trong RAM nên mỗi lần F5 là mất sạch cache
 * React Query, và mọi dropdown/danh mục lại đi hỏi VPS. Với vài nghìn nhân viên
 * kho F5/điều hướng liên tục, đó là lượng request thuần tuý lãng phí.
 *
 * Ranh giới đã chọn (xem docs/cache/CACHE_POLICY.md):
 *  - CHỈ ghi những nhóm `persist: true` trong cache-policy.ts: master, reference,
 *    và — sau quyết định vận hành — báo cáo/bảng điều khiển kèm hai chốt chặn
 *    (`revalidateOnRestore` + trần dung lượng từng query).
 *  - TỒN KHO, chứng từ, RBAC, tìm kiếm KHÔNG BAO GIỜ chạm đĩa.
 *  - Khoá lưu trữ gắn user + scope + permission + build (cache-namespace.ts).
 *  - Ghi xong là dọn mọi bản ghi namespace khác -> không tích luỹ dữ liệu của
 *    người dùng cũ trên máy dùng chung, và không phình đĩa qua các lần deploy.
 *  - Mọi lỗi (quota, chế độ riêng tư, IDB bị chặn) đều nuốt và tắt persist cho
 *    phiên hiện tại. Ứng dụng vẫn chạy bằng mạng.
 */

/**
 * Trần dung lượng của TỪNG query.
 *
 * Đây là chốt chặn quan trọng nhất khi mở persist cho nhóm báo cáo. Đo trên dữ
 * liệu thật: `reports/movement-trace` trả 2,1 MB và `document-history` 461 KB —
 * ghi những thứ đó xuống đĩa vừa phình dung lượng vừa tốn thời gian serialize
 * nhiều hơn cả thời gian gọi lại mạng. Trong khi bảng điều khiển chỉ 5-20 KB và
 * mở gần như mỗi phiên.
 *
 * Ngưỡng 256 KB tách đúng hai nhóm đó: giữ cái nhỏ-và-hay-mở, bỏ cái khổng
 * lồ-và-thỉnh-thoảng.
 */
const MAX_QUERY_BYTES = 256_000;
/** Trần dung lượng cả bản ghi, sau khi đã lọc theo trần từng query. */
const MAX_SERIALIZED_BYTES = 4_000_000;
/** Trần số query được ghi, chống trường hợp filter sinh vô số biến thể khoá. */
const MAX_PERSISTED_QUERIES = 120;
/** Gom nhiều thay đổi liên tiếp thành một lần ghi. */
const WRITE_DEBOUNCE_MS = 2_000;
/** Không để màn hình chờ treo vì IndexedDB chậm/treo. */
const RESTORE_TIMEOUT_MS = 1_500;

interface PersistedRecord {
  readonly buildId: string;
  readonly savedAt: number;
  readonly state: DehydratedState;
}

let disabled = false;
let activeNamespace: string | null = null;
let activeClient: QueryClient | null = null;
let restorePromise: Promise<void> | null = null;
// Async storage work may finish after logout or a context change.
let persistenceGeneration = 0;
let unsubscribe: (() => void) | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function isCurrentSession(namespace: string, generation: number): boolean {
  return activeNamespace === namespace && persistenceGeneration === generation;
}

function isPersistableKey(key: Query["queryKey"]): boolean {
  const root = Array.isArray(key) ? key[0] : key;
  if (typeof root !== "string" || !PERSISTABLE_ROOTS.has(root)) return false;
  // Danh sách chặn theo khoá thắng cả chính sách nhóm (vd. danh bạ người dùng
  // nằm trong nhóm `report` nhưng là dữ liệu cá nhân).
  return !isPersistDenied(key);
}

function isPersistable(query: Query): boolean {
  if (!isPersistableKey(query.queryKey)) return false;
  if (query.state.status !== "success") return false;
  if (query.state.data === undefined) return false;
  // Query đang lỗi ở lần fetch gần nhất vẫn giữ data cũ; đừng đóng băng nó xuống đĩa.
  return query.state.fetchStatus === "idle" && query.state.error == null;
}

function isFresh(dataUpdatedAt: number, queryKey: unknown): boolean {
  const policy = policyOfQueryKey(queryKey as Query["queryKey"]);
  if (!policy.persist) return false;
  return Date.now() - dataUpdatedAt < policy.persistTtl;
}

/**
 * Cắt bớt để bản ghi không vượt trần. Bỏ query NẶNG NHẤT trước: một danh mục
 * khổng lồ hiếm khi đáng giá bằng năm dropdown nhỏ mà người dùng chạm liên tục.
 */
function capSize(state: DehydratedState): DehydratedState {
  const measured = state.queries.map((query) => {
    let bytes = MAX_SERIALIZED_BYTES + 1;
    try {
      bytes = JSON.stringify(query).length;
    } catch {
      // Payload không serialize được (vòng lặp tham chiếu) -> coi như quá khổ và loại.
    }
    return { query, bytes };
  });

  measured.sort((a, b) => a.bytes - b.bytes);

  const kept: DehydratedState["queries"] = [];
  let total = 0;
  for (const { query, bytes } of measured) {
    if (kept.length >= MAX_PERSISTED_QUERIES) break;
    // Trần theo TỪNG query: một báo cáo 2 MB không được phép chiếm chỗ của
    // hàng chục danh mục nhỏ mà người dùng chạm liên tục.
    if (bytes > MAX_QUERY_BYTES) continue;
    if (total + bytes > MAX_SERIALIZED_BYTES) continue;
    total += bytes;
    kept.push(query);
  }

  return { ...state, queries: kept, mutations: [] };
}

async function writeNow(client: QueryClient): Promise<void> {
  if (disabled || !activeNamespace) return;
  const namespace = activeNamespace;
  const generation = persistenceGeneration;

  const state = capSize(
    dehydrate(client, {
      shouldDehydrateQuery: isPersistable,
      shouldDehydrateMutation: () => false,
    }),
  );

  const record: PersistedRecord = {
    buildId: APP_BUILD_ID,
    savedAt: Date.now(),
    state,
  };

  const ok = await idbSet(namespace, record);
  if (!isCurrentSession(namespace, generation)) {
    if (activeNamespace !== namespace) await idbDelete(namespace);
    return;
  }
  if (!ok) {
    // Ghi hỏng gần như luôn là hết quota. Thử dọn rác trước khi đầu hàng.
    await pruneOtherNamespaces(namespace, generation);
    if (!isCurrentSession(namespace, generation)) return;
    const retry = await idbSet(namespace, record);
    if (!isCurrentSession(namespace, generation)) {
      if (activeNamespace !== namespace) await idbDelete(namespace);
      return;
    }
    if (!retry) {
      disabled = true;
      return;
    }
  }

  await pruneOtherNamespaces(namespace, generation);
}

async function pruneOtherNamespaces(
  namespace: string,
  generation: number,
): Promise<void> {
  const keys = await idbKeys();
  if (!isCurrentSession(namespace, generation)) return;
  await Promise.all(
    keys.filter((key) => key !== namespace).map((key) => idbDelete(key)),
  );
  // Bản ghi của schema cũ không khớp tiền tố hiện tại cũng bị dọn ở trên —
  // điều kiện lọc duy nhất là "không phải namespace đang dùng".
  void CACHE_KEY_PREFIX;
}

function scheduleWrite(client: QueryClient): void {
  if (disabled || !activeNamespace) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void writeNow(client);
  }, WRITE_DEBOUNCE_MS);
}

/** Client nào đã được gắn listener "rời trang" (chỉ gắn một lần cho mỗi client). */
let flushListenerClient: QueryClient | null = null;

/**
 * GHI NGAY khi người dùng rời trang, nếu còn một lần ghi đang chờ debounce.
 *
 * VÌ SAO CẦN — đo được 07/09/2026: mở màn Danh sách SKU rồi F5 SAU 2 giây thì
 * lần tải sau chỉ còn 2 request (`/auth/refresh` + số thông báo chưa đọc), 6
 * request danh mục lấy thẳng từ IndexedDB. Nhưng F5 TRƯỚC khi hết 2 giây thì
 * chưa có gì kịp ghi, và lần tải sau vẫn phải gọi lại đủ 6 request. Người dùng
 * bấm F5 nhanh — nhất là khi đang sốt ruột vì trang chậm — nên đúng lúc cần
 * cache nhất lại là lúc không có.
 *
 * `pagehide` là sự kiện đáng tin nhất cho việc này: nó chạy cả khi trang vào
 * bfcache và cả trên iOS, khác `beforeunload`/`unload`. Kèm `visibilitychange`
 * để bắt luôn trường hợp người dùng chuyển sang tab khác rồi không quay lại.
 *
 * Best-effort: transaction IndexedDB mở trước khi trang chết thường vẫn hoàn
 * tất; nếu không thì mất đúng một lần ghi — bằng đúng hành vi cũ, không tệ hơn.
 */
function ensureFlushOnLeave(client: QueryClient): void {
  if (typeof window === "undefined") return;
  if (flushListenerClient === client) return;
  flushListenerClient = client;

  const flush = () => {
    if (!writeTimer) return; // không có lần ghi nào đang chờ
    clearTimeout(writeTimer);
    writeTimer = null;
    void writeNow(client);
  };

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Nạp cache đã lưu cho đúng danh tính hiện tại rồi bắt đầu theo dõi để ghi tiếp.
 *
 * PHẢI gọi SAU khi máy chủ đã xác nhận danh tính (GET /auth/me trả về), không
 * dùng gợi ý user trong cookie: cookie có thể là của phiên trước trên máy dùng
 * chung, hydrate theo nó là mở đúng cửa rò dữ liệu chéo tài khoản.
 */
export function startQueryPersistence(
  client: QueryClient,
  identity: CacheIdentity,
): Promise<void> {
  const namespace = buildCacheNamespace(identity);
  if (
    activeNamespace === namespace &&
    activeClient === client &&
    restorePromise
  ) {
    return restorePromise;
  }

  stopQueryPersistence();
  activeNamespace = namespace;
  activeClient = client;
  disabled = false;
  restorePromise = restoreAndSubscribe(
    client,
    namespace,
    persistenceGeneration,
  );
  return restorePromise;
}

async function restoreAndSubscribe(
  client: QueryClient,
  namespace: string,
  generation: number,
): Promise<void> {
  const record = await withTimeout(
    idbGet<PersistedRecord>(namespace),
    RESTORE_TIMEOUT_MS,
    null,
  );
  if (!isCurrentSession(namespace, generation)) return;

  if (record && record.buildId === APP_BUILD_ID && record.state?.queries) {
    const queries = record.state.queries
      .filter(
        (query) =>
          isPersistable(query as unknown as Query) &&
          isFresh(query.state.dataUpdatedAt, query.queryKey),
      )
      .map((query) => {
        const policy = policyOfQueryKey(query.queryKey as Query["queryKey"]);
        if (!policy.revalidateOnRestore) return query;

        // Ép "đã cũ" bằng cách đặt dataUpdatedAt = 0. Dữ liệu VẪN hiển thị ngay
        // (React Query luôn render data đang có, dù cũ), nhưng query bị coi là
        // stale nên nó gọi lại máy chủ ngay khi màn hình mount.
        //
        // Không có bước này, một bản ghi vừa lưu 30 giây trước vẫn nằm trong
        // staleTime -> React Query coi là tươi -> KHÔNG gọi lại, và người dùng
        // có thể nhìn số cũ suốt cả phiên. Với báo cáo/tồn kho thì đó là sai.
        return {
          ...query,
          state: { ...query.state, dataUpdatedAt: 0 },
        };
      });
    if (queries.length > 0) {
      hydrate(client, { ...record.state, queries, mutations: [] });
    }
  } else if (record) {
    // Build cũ hoặc bản ghi hỏng: bỏ hẳn, đừng cố cứu shape không còn đúng.
    await idbDelete(namespace);
  }
  if (!isCurrentSession(namespace, generation)) return;

  unsubscribe = client.getQueryCache().subscribe((event) => {
    if (!isPersistableKey(event.query.queryKey)) return;
    // Search, inventory, observer changes and fetch starts do not change the
    // disk snapshot. Avoid serializing all cached reports for unrelated UI work.
    if (
      event.type === "removed" ||
      (event.type === "updated" &&
        ["success", "error", "invalidate", "setState"].includes(
          event.action.type,
        ))
    ) {
      scheduleWrite(client);
    }
  });
  ensureFlushOnLeave(client);

  void pruneOtherNamespaces(namespace, generation);
}

/** Dừng theo dõi. Không tự xoá dữ liệu — dùng `clearPersistedQueryCache` cho việc đó. */
export function stopQueryPersistence(): void {
  persistenceGeneration += 1;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  unsubscribe?.();
  unsubscribe = null;
  activeNamespace = null;
  activeClient = null;
  restorePromise = null;
}

/**
 * Xoá sạch mọi bản ghi persisted. Gọi khi đăng xuất và khi phiên bị thu hồi —
 * máy trong kho là máy dùng chung, người sau không được thấy gì của người trước.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  stopQueryPersistence();
  const keys = await idbKeys();
  // A new authenticated session may have started while IDB listed old keys.
  await Promise.all(
    keys.filter((key) => key !== activeNamespace).map((key) => idbDelete(key)),
  );
}

/** Chỉ dùng cho test. */
export function __persisterInternals() {
  return {
    isPersistable,
    capSize,
    get activeNamespace() {
      return activeNamespace;
    },
    get disabled() {
      return disabled;
    },
  };
}
