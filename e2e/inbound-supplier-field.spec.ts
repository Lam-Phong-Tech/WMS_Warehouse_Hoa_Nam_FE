import { expect, test } from "@playwright/test";

test("inbound receipt requires and searches an existing supplier", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const user = {
    id: "inbound-supplier-operator",
    user_id: "inbound-supplier-operator",
    display_name: "Người quản lý kho",
    username: "inbound-supplier",
    email: "inbound-supplier@example.test",
    status: "ACTIVE",
    roles: [
      {
        role_id: "inbound-supplier-role",
        role_code: "SUPER_ADMIN",
        role_name: "Admin",
        scope_ref: null,
      },
    ],
    permissions: [
      "inbound.view",
      "inbound.create",
      "supplier.view",
      "supplier.create",
      "supplier.update",
    ],
    warehouse_scope_ids: [],
  };
  let createdBody: Record<string, unknown> | null = null;
  const supplierRow = {
    id: "10000000-0000-4000-8000-000000000001",
    code: "NCC-001",
    name: "Honda Việt Nam",
    display_name: "NCC-001 - Honda Việt Nam",
    code_status: "ASSIGNED",
    status: "ACTIVE",
    version: 1,
    updated_at: "2026-11-08T08:30:00+07:00",
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (/\/auth\/(login|refresh)$/.test(url.pathname)) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            access_token: "<inbound-supplier-fixture-token>",
            token_type: "bearer",
            expires_in: 3600,
            user,
          },
        },
      });
      return;
    }
    if (url.pathname.endsWith("/auth/me")) {
      await route.fulfill({ json: { success: true, data: user } });
      return;
    }
    if (url.pathname.endsWith("/auth/preferences")) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            version: 1,
            locale: "vi",
            timezone: "Asia/Ho_Chi_Minh",
            date_format: "DD/MM/YYYY",
            default_homepage: "dashboard",
            theme: "light",
            accent: "ocean",
            font_size: "medium",
            density: "comfortable",
            reduced_motion: false,
          },
        },
      });
      return;
    }
    if (url.pathname.endsWith("/warehouses")) {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "warehouse-main",
              code: "KHO-TONG-HN",
              name: "Kho tổng Hoa Nam",
              status: "ACTIVE",
            },
          ],
          meta: { total: 1, current_page: 1, per_page: 20, last_page: 1 },
        },
      });
      return;
    }
    if (url.pathname.includes("/mini-app/inbound/suppliers")) {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const rows = [supplierRow].filter((row) =>
        `${row.code} ${row.name}`.toLowerCase().includes(q),
      );
      await route.fulfill({
        json: {
          success: true,
          data: rows,
          meta: { page: 1, per_page: 20, total: rows.length, last_page: 1 },
        },
      });
      return;
    }
    if (url.pathname.endsWith("/inbound-documents")) {
      if (request.method() === "POST") {
        createdBody = request.postDataJSON();
        await route.fulfill({
          status: 201,
          json: {
            success: true,
            data: {
              id: "10000000-0000-4000-8000-000000000099",
              doc_no: "PN-20261108-001",
              doc_date: createdBody.doc_date,
              dst_warehouse_id: createdBody.dst_warehouse_id,
              supplier_id: createdBody.supplier_id,
              status: "DRAFT",
              version: 1,
              lines: [],
              scanned_qty: 0,
              qty_planned: 0,
            },
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          success: true,
          data: [],
          meta: { current_page: 1, per_page: 20, last_page: 1, total: 0 },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: [],
        meta: { total: 0, current_page: 1, per_page: 20, last_page: 1 },
      },
    });
  });

  await page.goto("/inbound", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /^Bắt đầu làm việc/ })
    .click({ timeout: 90_000 });

  await page
    .getByRole("button", { name: "Tạo phiếu nhập", exact: true })
    .click({ timeout: 90_000 });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Tạo phiếu nhập", { exact: true })).toBeVisible();

  await dialog
    .getByRole("button", { name: "Tạo phiếu & quét hàng", exact: true })
    .click();
  await expect(dialog.getByText("Chọn nhà cung cấp.", { exact: true })).toBeVisible();

  const supplier = dialog.getByRole("combobox", { name: /Nhà cung cấp/ });
  await supplier.click();
  await supplier.fill("Honda");
  await page
    .getByRole("option", { name: "NCC-001 - Honda Việt Nam", exact: true })
    .click();

  await dialog
    .getByRole("button", { name: "Tạo phiếu & quét hàng", exact: true })
    .click();
  await expect.poll(() => createdBody?.supplier_id).toBe(supplierRow.id);
});
