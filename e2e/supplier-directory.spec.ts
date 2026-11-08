import { expect, test } from "@playwright/test";

test("supplier directory: shell, responsive list, create and versioned update", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const user = {
    id: "supplier-ui-operator",
    user_id: "supplier-ui-operator",
    display_name: "Người quản lý kho",
    username: "supplier-ui",
    email: "supplier-ui@example.test",
    status: "ACTIVE",
    roles: [
      {
        role_id: "supplier-ui-role",
        role_code: "SUPER_ADMIN",
        role_name: "Admin",
        scope_ref: null,
      },
    ],
    permissions: ["supplier.view", "supplier.create", "supplier.update"],
    warehouse_scope_ids: [],
  };
  const suppliers = [
    {
      id: "10000000-0000-4000-8000-000000000001",
      code: "NCC-001",
      name: "Honda Việt Nam",
      status: "ACTIVE",
      version: 1,
      updated_at: "2026-11-08T08:30:00+07:00",
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      code: "NCC-002",
      name: "Công ty TNHH Thương mại và Cung ứng máy nông nghiệp Hoa Nam",
      status: "ACTIVE",
      version: 2,
      updated_at: "2026-11-08T09:15:00+07:00",
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      code: "NCC-003",
      name: "Kubota",
      status: "INACTIVE",
      version: 1,
      updated_at: "2026-11-07T16:45:00+07:00",
    },
    {
      id: "10000000-0000-4000-8000-000000000004",
      code: "NCC-004",
      name: "Yanmar",
      status: "ACTIVE",
      version: 1,
      updated_at: "2026-11-07T14:20:00+07:00",
    },
  ];
  const directoryRow = (row: (typeof suppliers)[number]) => ({
    ...row,
    display_name: `${row.code} - ${row.name}`,
    code_status: "ASSIGNED",
  });
  let creates = 0;
  let edits = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (/\/auth\/(login|refresh)$/.test(url.pathname)) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            access_token: "<supplier-ui-fixture-token>",
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
    if (url.pathname.includes("/mini-app/inbound/suppliers")) {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        expect(Object.keys(body).sort()).toEqual(["name", "status"]);
        creates++;
        const row = {
          id: "10000000-0000-4000-8000-000000000005",
          code: "NCC-005",
          ...body,
          version: 1,
          updated_at: "2026-11-08T10:00:00+07:00",
        };
        suppliers.push(row);
        await route.fulfill({
          status: 201,
          json: { success: true, data: directoryRow(row) },
        });
        return;
      }
      if (request.method() === "PATCH") {
        expect(request.headers()["if-match"]).toBe('"1"');
        edits++;
        const row = suppliers.find((supplier) =>
          url.pathname.endsWith(supplier.id),
        )!;
        Object.assign(row, request.postDataJSON(), { version: 2 });
        await route.fulfill({
          json: { success: true, data: directoryRow(row) },
        });
        return;
      }
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const rows = suppliers.filter(
        (row) =>
          row.status === url.searchParams.get("status") &&
          `${row.code} ${row.name}`.toLowerCase().includes(q),
      );
      await route.fulfill({
        json: {
          success: true,
          data: rows.map(directoryRow),
          meta: { page: 1, per_page: 20, total: rows.length, last_page: 1 },
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
  await page.goto("/master-data/suppliers", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Bắt đầu làm việc →" })
    .click({ timeout: 90_000 });
  await expect(
    page.getByRole("heading", { name: "Danh sách NCC", exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Honda Việt Nam", { exact: true })).toBeVisible();
  expect(
    await page
      .locator(".hn-ncc-filters .MuiOutlinedInput-root")
      .first()
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(48);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440) {
      const catalogMenu = page.getByRole("button", {
        name: "Danh mục",
        exact: true,
      });
      if ((await catalogMenu.getAttribute("aria-expanded")) === "false")
        await catalogMenu.click();
      await expect(
        page.getByRole("button", { name: "Danh sách NCC", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
    await expect(
      page.getByRole("button", { name: "Thêm NCC", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    const table = page.locator(".hn-ncc-scroll");
    expect(
      await table.evaluate(
        (element) => element.scrollWidth >= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/supplier-list-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Thêm NCC", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Mã NCC", { exact: true })).toHaveValue(
    "Tự động cấp khi lưu",
  );
  await dialog
    .getByLabel("Tên nhà cung cấp", { exact: false })
    .fill("Nhà cung cấp mới");
  await page.screenshot({
    path: "test-results/supplier-create-dialog.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Lưu NCC", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Nhà cung cấp mới", { exact: true }),
  ).toBeVisible();
  expect(creates).toBe(1);
  await page.getByRole("button", { name: "Sửa NCC-005", exact: true }).click();
  await dialog
    .getByLabel("Tên nhà cung cấp", { exact: false })
    .fill("Nhà cung cấp đã cập nhật");
  await dialog
    .getByRole("button", { name: "Lưu thay đổi", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Nhà cung cấp đã cập nhật", { exact: true }),
  ).toBeVisible();
  expect(edits).toBe(1);
  await page.getByRole("button", { name: "Giao diện", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Tối", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/supplier-list-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Thêm NCC", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator(".MuiDialog-container")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/supplier-form-mobile-dark.png",
    fullPage: true,
  });
});
