/**
 * Bọc IndexedDB tối thiểu cho persisted query cache.
 *
 * Vì sao tự viết thay vì thêm idb/localforage/dexie: cả lớp persist chỉ cần
 * get/set/delete/keys trên MỘT object store. Thêm một dependency runtime cho
 * ngần đó API là chi phí bundle + chuỗi cung ứng không tương xứng.
 *
 * Vì sao KHÔNG dùng localStorage: nó đồng bộ (chặn main thread), trần ~5MB, và
 * lưu chuỗi — ghi payload danh mục vào đó sẽ làm giật UI ngay trên máy yếu của kho.
 *
 * Mọi hàm ở đây fail-soft: trình duyệt chặn storage (chế độ riêng tư, quota,
 * Safari ITP) thì trả null/false chứ không ném lỗi ra ngoài. Cache là tối ưu,
 * không được là điểm chết của ứng dụng.
 */
const DB_NAME = "wms-query-cache";
const DB_VERSION = 1;
const STORE = "dehydrated";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    // Truy cập chính thuộc tính này cũng có thể ném lỗi khi site data bị chặn.
    return false;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (!hasIndexedDb()) {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    const done = (value: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => done(request.result);
      request.onerror = () => done(null);
      request.onblocked = () => done(null);
      // Một tab khác đang giữ transaction upgrade có thể treo vô hạn; đừng để
      // màn hình chờ của app phụ thuộc vào đó.
      setTimeout(() => done(null), 3000);
    } catch {
      done(null);
    }
  });

  return dbPromise;
}

function runTx<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const request = work(tx.objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
          tx.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export function idbGet<T>(key: string): Promise<T | null> {
  return runTx<T>("readonly", (store) => store.get(key) as IDBRequest<T>);
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const result = await runTx("readwrite", (store) =>
    store.put(value, key),
  ).then(
    () => true,
    () => false,
  );
  return result !== null && result !== false;
}

export function idbDelete(key: string): Promise<unknown> {
  return runTx("readwrite", (store) => store.delete(key));
}

/**
 * Mở sẵn kết nối IndexedDB, KHÔNG chờ kết quả.
 *
 * VÌ SAO: cổng nạp persisted cache (`use-persisted-cache.ts`) chỉ chạy SAU khi
 * máy chủ xác nhận danh tính, nên lần `indexedDB.open()` đầu tiên nằm NỐI TIẾP
 * ngay sau vòng mạng `/auth/refresh`. Trên máy Windows của kho (Defender quét
 * file, Chromium đóng backing store sau mỗi lần tải lại) đó là hàng chục tới
 * hàng trăm mili giây chết trên đúng đường tới hạn của mỗi lần F5. Mở kết nối
 * KHÔNG cần biết danh tính; chỉ việc ĐỌC mới cần.
 *
 * Không nới lỏng ranh giới nào: hàm này không đọc và không hydrate gì cả.
 */
export function warmIdb(): void {
  void openDb();
}

export async function idbKeys(): Promise<string[]> {
  const keys = await runTx<IDBValidKey[]>(
    "readonly",
    (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>,
  );
  if (!keys) return [];
  return keys.filter((key): key is string => typeof key === "string");
}

/** Chỉ dùng cho test — buộc lần gọi sau mở lại kết nối. */
export function resetIdbForTests(): void {
  dbPromise = null;
}
