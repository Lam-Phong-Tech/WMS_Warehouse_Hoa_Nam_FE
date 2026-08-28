import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from "@playwright/test";

/**
 * Luồng 04 · Bảo hành & linh kiện — LIVE runtime evidence.
 *
 * Khác với warranty-flow04-evidence.spec.ts (UI với API mock), suite này
 * TUYỆT ĐỐI KHÔNG dùng page.route()/mocks: browser FE m1 nói chuyện HTTP thật
 * với BE m1 và DB thật, tạo evidence cho chuỗi:
 *
 *   login thật → POST warranty case thật → GET case → PATCH CHECKING
 *   → idempotent replay → upload/download/delete attachment
 *   → create component issue → scan → post (trừ tồn) → replay post
 *   → kiểm subledger container + warranty events.
 *
 * Yêu cầu môi trường (skip toàn bộ nếu thiếu):
 *   E2E_LIVE_RUNTIME=1
 *   E2E_LIVE_USERNAME / E2E_LIVE_PASSWORD  (email đăng nhập có quyền warranty + container/sku view)
 *   E2E_LIVE_API_BASE_URL                  (mặc định http://localhost:8080/api/v1)
 * Tùy chọn để chạy sâu chuỗi component issue post:
 *   E2E_LIVE_COMPONENT_SKU_ID / E2E_LIVE_CONTAINER_ID (nếu bỏ trống sẽ tự
 *   discovery container BOX còn tồn COMPONENT qua API thật; ví dụ dữ liệu
 *   WarrantyDemoSeeder của BE).
 */

const LIVE = process.env.E2E_LIVE_RUNTIME === "1";
const API_BASE =
  process.env.E2E_LIVE_API_BASE_URL ?? "http://localhost:8080/api/v1";
const USERNAME = process.env.E2E_LIVE_USERNAME ?? "";
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? "";

type Json = Record<string, unknown>;

function uniqueKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function jsonOf(response: {
  json: () => Promise<unknown>;
}): Promise<Json> {
  return (await response.json()) as Json;
}

function dataOf(body: Json): Json {
  return (body.data ?? {}) as Json;
}

function rowsOf(body: Json): Json[] {
  const data = body.data;
  if (Array.isArray(data)) return data as Json[];
  if (data && typeof data === "object" && Array.isArray((data as Json).data)) {
    return (data as Json).data as Json[];
  }
  return [];
}

async function apiLogin(): Promise<{ api: APIRequestContext; token: string }> {
  // baseURL phải kết thúc bằng "/" để "./x" giữ nguyên segment /api/v1.
  const api = await playwrightRequest.newContext({ baseURL: `${API_BASE}/` });
  // BE m1 validate email bắt buộc đúng định dạng — E2E_LIVE_USERNAME phải là email.
  const login = await api.post("./auth/login", {
    data: { email: USERNAME, password: PASSWORD },
  });
  expect(
    login.status(),
    `POST /auth/login phải 200 (nhận ${login.status()})`,
  ).toBe(200);
  const token = String(
    (dataOf(await jsonOf(login)) as Json).access_token ?? "",
  );
  expect(token, "access_token thật từ BE").not.toHaveLength(0);
  await api.dispose();
  const authed = await playwrightRequest.newContext({
    baseURL: `${API_BASE}/`,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  return { api: authed, token };
}

async function discoverComponentStock(
  api: APIRequestContext,
): Promise<{ skuId: string; containerId: string }> {
  const containers = await api.get("./containers", {
    params: { per_page: 100 },
  });
  expect(containers.status()).toBe(200);
  for (const row of rowsOf(await jsonOf(containers))) {
    const id = String(row.container_id ?? row.id ?? "");
    // Scan component-issue chỉ nhận container BOX chưa CLOSED/ISSUED,
    // đúng primary_sku_id và còn subledger stock.
    const containerType = String(
      row.container_type ?? row.type ?? "",
    ).toUpperCase();
    const containerStatus = String(row.status ?? "").toUpperCase();
    const primarySkuId = String(row.primary_sku_id ?? "");
    if (
      id === "" ||
      containerType !== "BOX" ||
      ["CLOSED", "ISSUED"].includes(containerStatus) ||
      primarySkuId === ""
    ) {
      continue;
    }
    const detail = await api.get(`./containers/${id}`);
    if (detail.status() !== 200) continue;
    const available = ((dataOf(await jsonOf(detail)).items ?? []) as Json[])
      .filter(
        (item) =>
          item.is_active !== false &&
          String(item.sku_id) === primarySkuId &&
          Number(item.quantity ?? 0) > 0,
      )
      .reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    if (available < 1) continue;
    const sku = await api.get(`./products/${primarySkuId}`);
    if (sku.status() !== 200) continue;
    const skuData = dataOf(await jsonOf(sku));
    if (
      String(skuData.sku_type).toUpperCase() === "COMPONENT" &&
      String(skuData.status).toUpperCase() === "ACTIVE"
    ) {
      return { skuId: primarySkuId, containerId: id };
    }
  }
  return { skuId: "", containerId: "" };
}

test.describe("Flow 04 live runtime (FE ↔ BE thật, không mock)", () => {
  test.skip(
    !LIVE || USERNAME === "" || PASSWORD === "",
    "Set E2E_LIVE_RUNTIME=1 + E2E_LIVE_USERNAME/E2E_LIVE_PASSWORD để chạy live suite",
  );

  test("WAR-01/02/03 + COMP-01 end-to-end trên HTTP thật", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    testInfo.annotations.push({
      type: "mock_or_route_interception",
      description: "FORBIDDEN — suite này không đăng ký page.route nào",
    });
    const evidence: Json[] = [];
    const record = (step: string, extra: Json) => {
      evidence.push({ step, at: new Date().toISOString(), ...extra });
    };

    let caseId = "";
    let caseCode = "";

    await test.step("UI login thật", async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/login");
      // LoginPage dùng FormInput custom (label không gắn htmlFor) -> chọn theo placeholder.
      await page.getByPlaceholder("your@gmail.com").fill(USERNAME);
      await page.getByPlaceholder("Nhập mật khẩu").fill(PASSWORD);
      const [loginResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/auth/login") &&
            response.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Đăng nhập" }).click(),
      ]);
      expect(loginResponse.status()).toBe(200);
      record("ui-login", {
        status: loginResponse.status(),
        request_id: ((await jsonOf(loginResponse)).meta as Json | undefined)
          ?.request_id,
      });
      await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    });

    await test.step("UI WAR-01 list + WAR-02 intake TEMP_ONLY thật", async () => {
      // Access token FE nằm trong memory nên phải điều hướng client-side
      // (full page load sẽ mất session thật) — đi qua menu như người dùng.
      const [listResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/warranty-cases") &&
            response.request().method() === "GET",
        ),
        page
          .getByRole("button", { name: "Danh sách bảo hành" })
          .first()
          .click(),
      ]);
      expect(listResponse.status()).toBe(200);

      await page.getByRole("button", { name: "+ Tiếp nhận bảo hành" }).click();
      await page.getByText("Mất mã (TEMP_ONLY)").click();
      await page
        .getByLabel("Lý do mất/không có mã")
        .fill("Live e2e: khách làm mất tem");
      await page
        .getByLabel("Mô tả nhận diện máy")
        .fill("Live e2e: máy cưa lọng màu cam");
      await page.getByLabel("Tên khách gửi").fill("Khách Live E2E");
      await page.getByLabel("Số điện thoại").fill("0900112233");
      await page
        .getByLabel("Bệnh / lỗi khách phản ánh")
        .fill("Live e2e: máy kêu to bất thường");

      const [createResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/warranty-cases") &&
            response.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Lưu tiếp nhận" }).click(),
      ]);
      expect(createResponse.status()).toBe(201);
      const headers = createResponse.request().headers();
      expect(headers["idempotency-key"]).toMatch(/^fe:warranty-create:/);
      const created = dataOf(await jsonOf(createResponse));
      caseId = String(created.id ?? created.warranty_case_id ?? "");
      caseCode = String(created.case_code ?? created.warranty_case_code ?? "");
      expect(caseId).not.toHaveLength(0);
      expect(created.stock_effect).toBe("NONE");
      record("ui-create-temp-only", {
        status: 201,
        case_id: caseId,
        case_code: caseCode,
        idempotency_key: headers["idempotency-key"],
      });
      await expect(page.getByText(caseCode).first()).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("live-war02-created.png"),
        fullPage: true,
      });
    });

    const { api } = await apiLogin();
    try {
      await test.step("PATCH CHECKING + idempotent replay thật", async () => {
        const detail = await api.get(`./warranty-cases/${caseId}`);
        expect(detail.status()).toBe(200);
        expect(Number(dataOf(await jsonOf(detail)).version)).toBe(1);

        const key = uniqueKey("live-warranty-update");
        const patchBody = {
          status: "CHECKING",
          description: "Live e2e checking",
        };
        const first = await api.patch(`./warranty-cases/${caseId}`, {
          headers: { "If-Match": "1", "Idempotency-Key": key },
          data: patchBody,
        });
        expect(first.status()).toBe(200);
        expect(first.headers()["idempotent-replay"]).toBe("false");
        expect(Number(dataOf(await jsonOf(first)).version)).toBe(2);

        const replay = await api.patch(`./warranty-cases/${caseId}`, {
          headers: { "If-Match": "1", "Idempotency-Key": key },
          data: patchBody,
        });
        expect(replay.status()).toBe(200);
        expect(replay.headers()["idempotent-replay"]).toBe("true");
        expect(Number(dataOf(await jsonOf(replay)).version)).toBe(2);

        const events = await api.get(`./warranty-cases/${caseId}/events`);
        expect(events.status()).toBe(200);
        const types = rowsOf(await jsonOf(events)).map((row) =>
          String(row.event_type),
        );
        expect(types).toContain("RECEIVE");
        expect(types).toContain("CHECK");
        expect(
          types.filter((type) => type === "CHECK"),
          "replay không được ghi event CHECK lần hai",
        ).toHaveLength(1);
        record("patch-checking-replay", { version: 2, events: types });
      });

      await test.step("Attachment upload/list/download/delete thật", async () => {
        const upload = await api.post(
          `./warranty-cases/${caseId}/attachments`,
          {
            multipart: {
              attachment_type: "INTAKE",
              file: {
                name: "live-intake.png",
                mimeType: "image/png",
                // BE validate mimes theo magic bytes -> phải là ảnh thật (PNG 1x1).
                buffer: Buffer.from(
                  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
                  "base64",
                ),
              },
            },
          },
        );
        expect(upload.status()).toBe(201);
        const uploaded = dataOf(await jsonOf(upload));
        const attachmentId = String(uploaded.id ?? "");
        expect(attachmentId).not.toHaveLength(0);
        expect(uploaded.stock_effect).toBe("NONE");
        expect(uploaded).not.toHaveProperty("storage_path");

        const list = await api.get(`./warranty-cases/${caseId}/attachments`);
        expect(list.status()).toBe(200);
        expect(
          rowsOf(await jsonOf(list)).some(
            (row) => String(row.id) === attachmentId,
          ),
        ).toBe(true);

        const download = await api.get(
          `./warranty-attachments/${attachmentId}/download`,
        );
        expect(download.status()).toBe(200);
        expect((await download.body()).length).toBeGreaterThan(0);

        const remove = await api.delete(
          `./warranty-attachments/${attachmentId}`,
        );
        expect(remove.status()).toBe(200);
        const afterDelete = await api.get(
          `./warranty-attachments/${attachmentId}/download`,
        );
        expect(afterDelete.status()).toBe(404);
        record("attachment-lifecycle", { attachment_id: attachmentId });
      });

      await test.step("COMP-01: create → scan → post trừ tồn thật + replay", async () => {
        let componentSkuId = process.env.E2E_LIVE_COMPONENT_SKU_ID ?? "";
        let containerId = process.env.E2E_LIVE_CONTAINER_ID ?? "";

        if (componentSkuId === "" || containerId === "") {
          const discovered = await discoverComponentStock(api);
          componentSkuId = discovered.skuId;
          containerId = discovered.containerId;
        }

        test.skip(
          componentSkuId === "" || containerId === "",
          "Không tìm được container BOX còn tồn COMPONENT — seed WarrantyDemoSeeder hoặc set E2E_LIVE_COMPONENT_SKU_ID/E2E_LIVE_CONTAINER_ID",
        );

        const subledgerQty = async (): Promise<number> => {
          const detail = await api.get(`./containers/${containerId}`);
          expect(detail.status()).toBe(200);
          return ((dataOf(await jsonOf(detail)).items ?? []) as Json[])
            .filter(
              (item) =>
                String(item.sku_id) === componentSkuId &&
                item.is_active !== false,
            )
            .reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
        };
        const qtyBefore = await subledgerQty();
        expect(qtyBefore).toBeGreaterThan(0);

        const warehouses = await api.get("./warehouses", {
          params: { per_page: 10 },
        });
        expect(warehouses.status()).toBe(200);
        const activeWarehouse = rowsOf(await jsonOf(warehouses)).find(
          (row) => String(row.status).toUpperCase() === "ACTIVE",
        );
        expect(activeWarehouse, "cần warehouse ACTIVE").toBeTruthy();

        const create = await api.post("./component-issue-documents", {
          data: {
            warehouse_id: String((activeWarehouse as Json).id),
            warranty_case_id: caseId,
            document_date: new Date().toISOString().slice(0, 10),
            purpose: "WARRANTY",
            note: "Live e2e component issue",
            lines: [{ sku_id: componentSkuId, required_qty: 1 }],
          },
        });
        expect(create.status()).toBe(201);
        const createdDoc = await jsonOf(create);
        const doc = dataOf(createdDoc);
        const documentId = String(((doc.document ?? doc) as Json).id ?? "");
        expect(documentId).not.toHaveLength(0);
        const lineId = String(
          (((doc.lines ?? []) as Json[])[0] ?? {}).id ?? "",
        );
        expect(lineId).not.toHaveLength(0);

        const scan = await api.post(
          `./component-issue-documents/${documentId}/scan`,
          {
            headers: { "If-Match": "1" },
            data: { line_id: lineId, container_id: containerId, quantity: 1 },
          },
        );
        expect(scan.status()).toBe(200);
        const scanData = dataOf(await jsonOf(scan));
        expect(scanData.stock_effect).toBe("NONE");
        expect(Number(scanData.version)).toBe(2);
        expect(
          await subledgerQty(),
          "scan phải stock-neutral (chưa trừ tồn)",
        ).toBe(qtyBefore);

        const postKey = uniqueKey("live-component-post");
        const post = await api.post(
          `./component-issue-documents/${documentId}/post`,
          { headers: { "If-Match": "2", "Idempotency-Key": postKey } },
        );
        expect(post.status()).toBe(200);
        expect(post.headers()["idempotent-replay"]).toBe("false");
        const posted = dataOf(await jsonOf(post));
        const movements = (posted.movement_ids ?? []) as unknown[];
        expect(movements.length).toBeGreaterThan(0);
        const qtyAfter = await subledgerQty();
        expect(qtyAfter, "post phải trừ đúng 1 khỏi subledger").toBe(
          qtyBefore - 1,
        );

        const replayPost = await api.post(
          `./component-issue-documents/${documentId}/post`,
          { headers: { "If-Match": "2", "Idempotency-Key": postKey } },
        );
        expect(replayPost.status()).toBe(200);
        expect(replayPost.headers()["idempotent-replay"]).toBe("true");
        expect(
          await subledgerQty(),
          "replay post không được trừ tồn lần hai",
        ).toBe(qtyBefore - 1);

        const detailAfter = await api.get(
          `./component-issue-documents/${documentId}`,
        );
        expect(detailAfter.status()).toBe(200);
        const docAfter = dataOf(await jsonOf(detailAfter));
        expect(String(((docAfter.document ?? docAfter) as Json).status)).toBe(
          "POSTED",
        );
        record("component-issue-posted", {
          document_id: documentId,
          container_id: containerId,
          sku_id: componentSkuId,
          movement_ids: movements,
          subledger_before: qtyBefore,
          subledger_after: qtyAfter,
        });
      });

      await test.step("UI WAR-03: chi tiết case phản ánh dữ liệu thật", async () => {
        // Không dùng page.goto ở đây: full page load sẽ mất session in-memory.
        await expect(page.getByText(caseCode).first()).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath("live-war03-list-after.png"),
          fullPage: true,
        });
      });
    } finally {
      await api.dispose();
    }

    await testInfo.attach("live-runtime-evidence.json", {
      body: JSON.stringify(
        {
          suite: "warranty-flow04-live-runtime",
          api_base: API_BASE,
          mock_or_route_interception: "FORBIDDEN",
          case_id: caseId,
          case_code: caseCode,
          steps: evidence,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
});
