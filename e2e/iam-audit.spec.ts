import { test, expect, type Page, type Locator } from "@playwright/test";
import XLSX from "xlsx";

const cases = [
  { width: 1440, theme: "light" },
  { width: 1024, theme: "light" },
  { width: 768, theme: "light" },
  { width: 390, theme: "light" },
  { width: 320, theme: "light" },
  { width: 390, theme: "dark" },
] as const;
const screenshotRoot = "test-results/iam-audit";

test("roles metadata uses supported fields and failed loading can retry", async ({
  page,
}) => {
  await openFixture(page, "roles", 390, "light");
  const root = page.locator(".hn-iam-roles");
  await root.getByRole("button", { name: "Tạo vai trò", exact: true }).click();
  let editor = page.getByRole("dialog", { name: /^Tạo vai trò/ });
  await editor
    .getByRole("textbox", { name: "Mã vai trò", exact: false })
    .fill("browser_reader");
  await editor
    .getByRole("textbox", { name: "Tên vai trò", exact: false })
    .fill("Vai trò kiểm tra trình duyệt");
  await drawerGeometry(page, editor);
  await page.screenshot({
    path: `${screenshotRoot}/role-create-390-light.png`,
    fullPage: false,
  });
  await editor
    .getByRole("button", { name: "Tạo vai trò", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const create = await page.evaluate(() =>
    window.__iamRequests.find(
      (request) => request.method === "POST" && request.url === "/roles",
    ),
  );
  expect(create?.payload).toEqual({
    role_code: "BROWSER_READER",
    role_name: "Vai trò kiểm tra trình duyệt",
    scope_type: "FUNCTION",
    status: "ACTIVE",
  });
  await root
    .getByRole("button", { name: "Thông tin vai trò", exact: true })
    .click();
  editor = page.getByRole("dialog", { name: /^Sửa vai trò/ });
  await editor
    .getByRole("textbox", { name: "Tên vai trò", exact: false })
    .fill("Vai trò kiểm tra trình duyệt đã cập nhật");
  await editor
    .getByRole("button", { name: "Lưu vai trò", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__iamRequests.some(
        (request) =>
          request.method === "PATCH" && request.url === "/roles/role-new",
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.__iamRequests.some(
        (request) =>
          request.method === "POST" &&
          /\/roles\/.+\/permissions$/.test(request.url),
      ),
    ),
  ).toBe(false);
  await page.goto("/e2e/fixtures/iam-audit.html?view=roles&loadError=1");
  await expect(page.locator(".hn-iam-roles")).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByText("Chưa tải được dữ liệu phân quyền", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.__iamFailRoles = false;
  });
  await page
    .getByRole("button", { name: /Thử lại|Tải lại/ })
    .last()
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Quản lý danh mục SKU (sku.manage)",
      exact: true,
    }),
  ).toBeVisible();
});

for (const width of [1440, 390, 320]) {
  test(`effective ${width}: explicit account, grant sources and real user detail`, async ({
    page,
  }) => {
    await openFixture(page, "users", width, "light");
    await page
      .getByRole("tab", { name: "Quyền hiệu lực", exact: true })
      .click();
    const root = page.locator(".hn-effective-screen");
    await expect(root).toBeVisible();
    const picker = root.getByRole("combobox", {
      name: "Chọn hoặc tìm người dùng",
      exact: true,
    });
    await picker.click();
    await picker.fill(width === 1440 ? "Nguyễn Minh" : "minh.anh");
    if (width === 1440) {
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.__iamRequests
                .filter((request) => request.url === "/users")
                .at(-1)?.params,
          ),
        )
        .toMatchObject({ keyword: "Nguyễn Minh" });
    }
    await page.getByRole("option", { name: /Nguyễn Minh Anh/ }).click();
    await expect(root.locator(".hn-effective-identity")).toContainText(
      "Nguyễn Minh Anh — Điều phối vận hành kho và kiểm soát dữ liệu Hoa Nam",
    );
    await expect(root.locator(".hn-effective-table-wrap")).toContainText(
      "Xuất báo cáo",
    );
    await noPageOverflow(page);
    expect(
      await root
        .locator(".hn-effective-table-wrap")
        .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `${screenshotRoot}/effective-${width}-light.png`,
      fullPage: false,
    });
    await root
      .getByRole("tab", { name: "Nguồn cấp quyền", exact: true })
      .click();
    const sources = root.locator(".hn-effective-source-list");
    await expect(sources).toContainText("Quản lý kho");
    await expect(sources).toContainText("Theo dõi báo cáo");
    await expect(sources).toContainText("Xuất báo cáo");
    await expect(sources).toContainText(/Cấp riêng|Cấp bổ sung/);
    expect(
      await sources.evaluate(
        (node) => node.scrollWidth <= node.clientWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${screenshotRoot}/effective-sources-${width}-light.png`,
      fullPage: false,
    });
    await root
      .getByRole("button", { name: "Xem chi tiết người dùng", exact: true })
      .click();
    const detail = page.getByRole("dialog", { name: /^Chi tiết người dùng/ });
    await drawerGeometry(page, detail);
    expect(
      await page.evaluate(() =>
        window.__iamRequests.filter((request) => request.method !== "GET"),
      ),
    ).toEqual([]);
  });
}

test("users filters, paging and explicit status confirmation", async ({
  page,
}) => {
  await openFixture(page, "users", 1440, "light");
  const root = page.locator(".hn-iam-screen");
  await expect(root.locator(".hn-iam-user-summary")).toContainText(
    "32 tài khoản",
  );
  await root.locator(".hn-iam-users-pagination").getByRole("combobox").click();
  await page.getByRole("option", { name: "20 / trang", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__iamRequests
            .filter((request) => request.url === "/users")
            .at(-1)?.params,
      ),
    )
    .toMatchObject({ per_page: 20, page: 1 });
  await root.getByRole("combobox", { name: "Lọc theo trạng thái" }).click();
  await page.getByRole("option", { name: "Đã khóa", exact: true }).click();
  await expect(root.locator(".hn-iam-user-summary")).toContainText(
    "4 tài khoản",
  );
  await root.getByRole("button", { name: "Xóa lọc", exact: true }).click();
  await root.getByRole("combobox", { name: "Lọc theo vai trò" }).click();
  await page
    .getByRole("option", { name: "Theo dõi báo cáo", exact: true })
    .click();
  await expect(root.locator(".hn-iam-row-actions button")).toHaveCount(1);
  await root.getByRole("button", { name: "Xóa lọc", exact: true }).click();
  await root
    .getByRole("textbox", { name: "Tìm người dùng" })
    .fill("khong-tim-thay");
  await expect(
    root.getByText("Không có người dùng phù hợp bộ lọc.", { exact: true }),
  ).toBeVisible();
  await root.getByRole("button", { name: "Xóa lọc", exact: true }).click();
  await root.locator(".hn-iam-row-actions button").first().click();
  await page
    .getByRole("dialog", { name: /^Chi tiết người dùng/ })
    .getByRole("button", { name: "Sửa", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: /^Sửa người dùng/ });
  await edit.locator("#iam-status").click();
  await page.getByRole("option", { name: "Tạm ngưng", exact: true }).click();
  await edit
    .getByRole("tab", { name: "Vai trò & phạm vi", exact: true })
    .click();
  await edit.getByRole("combobox", { name: "Vai trò", exact: true }).click();
  await page
    .getByRole("option", { name: "Nhân viên kho", exact: true })
    .click();
  await edit.getByRole("tab", { name: "Xem lại & lưu", exact: true }).click();
  await edit
    .locator("#iam-reason")
    .fill("Điều chuyển vai trò và tạm ngừng tài khoản theo quyết định");
  await edit
    .getByRole("button", { name: "Lưu người dùng", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Ngừng hoạt động tài khoản?",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__iamRequests.filter((request) => request.method !== "GET"),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: `${screenshotRoot}/user-deactivate-1440-light.png`,
    fullPage: false,
  });
  const deactivate = confirm.getByRole("button", {
    name: /Ngừng hoạt động|khóa tài khoản|Xác nhận thay đổi/,
  });
  await expect(deactivate).toHaveAttribute("data-action-tone", "danger");
  await deactivate.click();
  await expect(edit).not.toBeVisible();
  const assignment = await page.evaluate(() =>
    window.__iamRequests.find(
      (request) =>
        request.url === "/users/user-1/roles" && request.method === "POST",
    ),
  );
  expect(assignment).toMatchObject({
    payload: {
      roles: [
        {
          role_id: "role-staff",
          scope_ref: "warehouse-main",
          effective_from: "2026-01-01",
          effective_to: null,
        },
        {
          role_id: "role-report",
          scope_ref: "warehouse-main",
          effective_from: "2026-01-01",
          effective_to: null,
        },
      ],
    },
  });
});

async function openFixture(
  page: Page,
  view: string,
  width: number,
  theme: string,
) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(
    (mode) => localStorage.setItem("hoa-nam-theme", mode),
    theme,
  );
  await page.goto(`/e2e/fixtures/iam-audit.html?view=${view}`);
  await expect(
    page.locator(
      view === "audit"
        ? ".hn-audit-settings"
        : view === "roles"
          ? ".hn-iam-roles"
          : ".hn-iam-screen",
    ),
  ).toBeVisible({ timeout: 90000 });
}

async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    })),
  ).toEqual(expect.objectContaining({ width: page.viewportSize()!.width }));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

async function drawerGeometry(page: Page, drawer: Locator) {
  await expect(drawer).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await drawer.boundingBox();
      return bounds ? Math.round(bounds.x + bounds.width) : null;
    })
    .toBe(page.viewportSize()!.width);
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.x + box!.width)).toBe(page.viewportSize()!.width);
  expect(
    await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  const overflowing = await drawer.evaluate((node) =>
    Array.from(node.querySelectorAll<HTMLElement>("section, dl, dd, form"))
      .filter(
        (element) =>
          element.getBoundingClientRect().width > 0 &&
          element.scrollWidth > element.clientWidth + 2,
      )
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        width: element.clientWidth,
        scroll: element.scrollWidth,
      })),
  );
  expect(overflowing).toEqual([]);
  await noPageOverflow(page);
}

async function closeDrawer(page: Page, drawer: Locator) {
  await drawer
    .getByRole("button", { name: "Đóng", exact: true })
    .first()
    .click();
  await expect(drawer).not.toBeVisible();
  await noPageOverflow(page);
}

for (const { width, theme } of cases) {
  test(`audit ${width} ${theme}: responsive list, result semantics and right detail`, async ({
    page,
  }) => {
    await openFixture(page, "audit", width, theme);
    const root = page.locator(".hn-audit-settings");
    await expect(
      root.getByRole("heading", { name: "Nhật ký hệ thống", exact: true }),
    ).toBeVisible();
    const view = root
      .getByRole("button", { name: "Xem chi tiết nhật ký", exact: true })
      .first();
    await expect(view).toBeVisible();
    await noPageOverflow(page);
    await expect(
      root.locator('[data-audit-result="SUCCESS"]').first(),
    ).toBeVisible();
    await expect(
      root.locator('[data-audit-result="FAILED"]').first(),
    ).toHaveAttribute("data-settings-tone", "error");
    await expect(
      root.locator('[data-audit-result="UNKNOWN"]').first(),
    ).toHaveAttribute("data-settings-tone", "neutral");
    if (width >= 768) {
      await expect(root.locator("thead th").last()).toHaveText("");
      const style = await root
        .locator("thead th")
        .nth(1)
        .evaluate((node) => ({
          fontSize: getComputedStyle(node).fontSize,
          lineHeight: getComputedStyle(node).lineHeight,
          weight: getComputedStyle(node).fontWeight,
        }));
      expect(style).toEqual({
        fontSize: "16px",
        lineHeight: "24px",
        weight: "800",
      });
    }
    const footer = root.locator(".hn-audit-pagination");
    await expect(
      footer.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    ).toBeVisible();
    await page.screenshot({
      path: `${screenshotRoot}/audit-list-${width}-${theme}.png`,
      fullPage: false,
    });
    await view.click();
    const drawer = page.getByRole("dialog", {
      name: /^Chi tiết nhật ký hệ thống/,
    });
    await drawerGeometry(page, drawer);
    await expect(
      drawer.getByText("WAREHOUSE_COORDINATOR_LONG_REFERENCE_20261104", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      drawer.getByText(
        "Nội dung kiểm tra sau thay đổi — không được mất dữ liệu",
        { exact: false },
      ),
    ).toBeVisible();
    await page.screenshot({
      path: `${screenshotRoot}/audit-detail-${width}-${theme}.png`,
      fullPage: false,
    });
    await closeDrawer(page, drawer);
    await expect(view).toBeFocused();
  });
}

test("users create and profile edit preserve real assignment and If-Match contracts", async ({
  page,
}) => {
  await openFixture(page, "users", 1440, "light");
  const root = page.locator(".hn-iam-screen");
  await root
    .getByRole("button", { name: "Thêm người dùng", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: /^Thêm người dùng/ });
  await create
    .locator("#iam-display-name")
    .fill("Người dùng kiểm tra trình duyệt");
  await create.locator("#iam-email").fill("browser.fixture@example.com");
  await create.locator("#iam-phone").fill("0901234567");
  await create
    .getByRole("tab", { name: "Vai trò & phạm vi", exact: true })
    .click();
  await create.getByRole("combobox", { name: "Vai trò", exact: true }).click();
  await page
    .getByRole("option", { name: "Nhân viên kho", exact: true })
    .click();
  await create
    .getByRole("combobox", { name: "Phạm vi dữ liệu", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Kho tổng Hoa Nam", exact: true })
    .click();
  await create.getByRole("tab", { name: "Xem lại & lưu", exact: true }).click();
  await create.locator("#iam-password").fill("BrowserFixture!2026");
  await create
    .locator("#iam-reason")
    .fill("Tạo tài khoản kiểm tra trình duyệt cục bộ");
  await create
    .getByRole("button", { name: "Lưu người dùng", exact: true })
    .click();
  await expect(create).not.toBeVisible();
  const createWrites = await page.evaluate(() =>
    window.__iamRequests.filter((request) => request.method === "POST"),
  );
  expect(createWrites).toHaveLength(2);
  expect(createWrites[0]).toMatchObject({
    url: "/users",
    payload: {
      display_name: "Người dùng kiểm tra trình duyệt",
      email: "browser.fixture@example.com",
      password: "BrowserFixture!2026",
      status: "ACTIVE",
    },
  });
  expect(createWrites[1]).toMatchObject({
    url: "/users/user-new/roles",
    payload: {
      roles: [
        {
          role_id: "role-staff",
          scope_ref: "warehouse-main",
          effective_from: null,
          effective_to: null,
        },
      ],
      reason: "Tạo tài khoản kiểm tra trình duyệt cục bộ",
    },
  });
  await page.evaluate(() => {
    window.__iamRequests = [];
  });
  await root.locator(".hn-iam-row-actions button").first().click();
  const detail = page.getByRole("dialog", { name: /^Chi tiết người dùng/ });
  await detail.getByRole("button", { name: "Sửa", exact: true }).click();
  const edit = page.getByRole("dialog", { name: /^Sửa người dùng/ });
  await edit.locator("#iam-phone").fill("0912345678");
  await edit.getByRole("tab", { name: "Xem lại & lưu", exact: true }).click();
  await edit
    .locator("#iam-reason")
    .fill("Cập nhật số điện thoại, giữ nguyên quyền và phạm vi");
  await edit
    .getByRole("button", { name: "Lưu người dùng", exact: true })
    .click();
  await expect(edit).not.toBeVisible();
  const editWrites = await page.evaluate(() =>
    window.__iamRequests.filter((request) => request.method !== "GET"),
  );
  expect(editWrites).toHaveLength(1);
  expect(editWrites[0]).toMatchObject({
    method: "PATCH",
    url: "/users/user-1",
    headers: { "If-Match": "1" },
    payload: { phone: "0912345678", version: 1 },
  });
});

for (const { width, theme } of cases) {
  test(`roles ${width} ${theme}: grouped permission matrix and review drawer`, async ({
    page,
  }) => {
    await openFixture(page, "roles", width, theme);
    const root = page.locator(".hn-iam-roles");
    await expect(
      root.getByRole("heading", { name: "Vai trò & quyền", exact: true }),
    ).toBeVisible();
    const permission = root.getByRole("checkbox", {
      name: "Quản lý danh mục SKU (sku.manage)",
      exact: true,
    });
    await expect(permission).toBeVisible();
    await expect(
      root.getByRole("checkbox", {
        name: "Legacy quyền cũ không còn thực thi (legacy.permission)",
        exact: true,
      }),
    ).toBeDisabled();
    await noPageOverflow(page);
    await page.screenshot({
      path: `${screenshotRoot}/roles-matrix-${width}-${theme}.png`,
      fullPage: false,
    });
    await permission.check();
    await root
      .getByRole("button", { name: "Xem lại & lưu", exact: true })
      .click();
    const review = page.getByRole("dialog", {
      name: /^Xem lại thay đổi quyền/,
    });
    await drawerGeometry(page, review);
    await expect(
      review.getByText("Quản lý danh mục SKU", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      review.getByRole("textbox", { name: "Lý do thay đổi", exact: false }),
    ).toBeVisible();
    await page.screenshot({
      path: `${screenshotRoot}/roles-review-${width}-${theme}.png`,
      fullPage: false,
    });
    await closeDrawer(page, review);
    await expect(permission).toBeChecked();
    expect(
      await page.evaluate(() =>
        window.__iamRequests.filter((request) => request.method !== "GET"),
      ),
    ).toEqual([]);
  });
}

test("roles sync reason, payload and conflict reconciliation preserve draft", async ({
  page,
}) => {
  await openFixture(page, "roles", 1440, "light");
  const root = page.locator(".hn-iam-roles");
  const permission = root.getByRole("checkbox", {
    name: "Quản lý danh mục SKU (sku.manage)",
    exact: true,
  });
  await permission.check();
  await root
    .getByRole("button", { name: "Xem lại & lưu", exact: true })
    .click();
  let review = page.getByRole("dialog", { name: /^Xem lại thay đổi quyền/ });
  await review
    .getByRole("button", { name: "Xác nhận lưu", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      window.__iamRequests.filter((request) => request.method === "POST"),
    ),
  ).toEqual([]);
  await review
    .getByRole("textbox", { name: "Lý do thay đổi", exact: false })
    .fill("  Cấp quyền quản lý SKU theo phân công  ");
  await review
    .getByRole("button", { name: "Xác nhận lưu", exact: true })
    .click();
  await expect(review).not.toBeVisible();
  const write = await page.evaluate(() =>
    window.__iamRequests.find(
      (request) =>
        request.method === "POST" &&
        request.url === "/roles/role-manager/permissions",
    ),
  );
  expect(write).toMatchObject({
    payload: { reason: "Cấp quyền quản lý SKU theo phân công" },
  });
  const ids = (write!.payload as { permission_ids: string[] }).permission_ids;
  expect(ids).toContain("permission-15");
  expect(ids).toEqual([...ids].sort());
  expect(write!.headers).toBeUndefined();
  const conflictPermission = root.getByRole("checkbox", {
    name: "Xuất báo cáo (report.export)",
    exact: true,
  });
  await conflictPermission.check();
  await root
    .getByRole("button", { name: "Xem lại & lưu", exact: true })
    .click();
  review = page.getByRole("dialog", { name: /^Xem lại thay đổi quyền/ });
  await review
    .getByRole("textbox", { name: "Lý do thay đổi", exact: false })
    .fill("Kiểm tra xung đột và giữ bản chỉnh sửa");
  await page.evaluate(() => {
    window.__iamConflictNext = true;
  });
  await review
    .getByRole("button", { name: "Xác nhận lưu", exact: true })
    .click();
  await expect(
    review.getByText("Vai trò đã được cập nhật ở phiên khác", { exact: true }),
  ).toBeVisible();
  await expect(
    review.getByRole("textbox", { name: "Lý do thay đổi", exact: false }),
  ).toHaveValue("Kiểm tra xung đột và giữ bản chỉnh sửa");
  await review
    .getByRole("button", { name: "Tải bản mới để đối chiếu", exact: true })
    .click();
  await expect(
    review.getByText("Dữ liệu mới nhất", { exact: true }),
  ).toBeVisible();
  await drawerGeometry(page, review);
  await page.screenshot({
    path: `${screenshotRoot}/roles-conflict-1440-light.png`,
    fullPage: false,
  });
  await review
    .getByRole("button", { name: "Dùng dữ liệu mới nhất", exact: true })
    .click();
  await expect(review).not.toBeVisible();
  await expect(conflictPermission).not.toBeChecked();
  await root
    .getByRole("button", { name: "Lịch sử thay đổi", exact: true })
    .click();
  const history = page.getByRole("dialog", {
    name: /^Lịch sử thay đổi phân quyền/,
  });
  await expect(
    history
      .getByText(
        "Điều chỉnh quyền nhập, xuất và đối soát tồn kho theo phân công vận hành",
        { exact: false },
      )
      .first(),
  ).toBeVisible();
  await drawerGeometry(page, history);
  await page.screenshot({
    path: `${screenshotRoot}/roles-history-1440-light.png`,
    fullPage: false,
  });
});

test("audit filters, server pagination, empty state and local selected export", async ({
  page,
}) => {
  await openFixture(page, "audit", 1440, "light");
  const root = page.locator(".hn-audit-settings");
  await expect(
    root.getByRole("button", { name: "Xem chi tiết nhật ký" }).first(),
  ).toBeVisible();
  await root.getByRole("combobox", { name: "Số dòng mỗi trang" }).click();
  await page.getByRole("option", { name: "20 / trang", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__iamRequests
            .filter((request) => request.url === "/audit-logs")
            .at(-1)?.params,
      ),
    )
    .toMatchObject({ per_page: "20", page: "1" });
  await root.getByRole("combobox", { name: "Lọc phân hệ" }).click();
  await page
    .getByRole("option", { name: "Hệ thống & danh mục", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__iamRequests
            .filter((request) => request.url === "/audit-logs")
            .at(-1)?.params,
      ),
    )
    .toMatchObject({ module: "SYSTEM" });
  await root
    .getByRole("textbox", { name: "Tìm nhật ký hệ thống" })
    .fill("khong-co-ket-qua");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__iamRequests
            .filter((request) => request.url === "/audit-logs")
            .at(-1)?.params,
      ),
    )
    .toMatchObject({ q: "khong-co-ket-qua", page: "1" });
  await expect(
    root.getByText("Không có nhật ký nào theo bộ lọc hiện tại"),
  ).toBeVisible();
  await root
    .getByRole("button", { name: /Đặt lại|Xóa bộ lọc|Xóa lọc/ })
    .click();
  await expect(
    root.getByRole("button", { name: "Xem chi tiết nhật ký" }).first(),
  ).toBeVisible();
  const exportButton = root.getByRole("button", { name: /Xuất Excel/ });
  await expect(exportButton).toBeDisabled();
  await root
    .getByRole("checkbox", { name: /Chọn nhật ký/ })
    .first()
    .check();
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /nhat-ky-he-thong-trang-1.*\.xlsx$/,
  );
  const workbook = XLSX.readFile((await download.path())!);
  expect(
    XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
      header: 1,
    }),
  ).toHaveLength(2);
  expect(
    await page.evaluate(() =>
      window.__iamRequests.filter((request) => request.method !== "GET"),
    ),
  ).toEqual([]);
});

for (const { width, theme } of cases) {
  test(`users ${width} ${theme}: list, grouped detail, additive permissions and staged editor`, async ({
    page,
  }) => {
    await openFixture(page, "users", width, theme);
    const root = page.locator(".hn-iam-screen");
    const arrow = root.locator(".hn-iam-row-actions button").first();
    await expect(arrow).toBeVisible();
    await expect(
      root.getByRole("heading", { name: "Người dùng", exact: true }),
    ).toBeVisible();
    await expect(
      root.getByRole("combobox", { name: "Lọc theo vai trò" }),
    ).toBeVisible();
    await expect(
      root.getByRole("combobox", { name: "Lọc theo phòng ban" }),
    ).toBeVisible();
    await expect(
      root.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    ).toBeVisible();
    await noPageOverflow(page);
    if (width >= 768)
      await expect(root.locator("thead th").last()).toHaveText("");
    await page.screenshot({
      path: `${screenshotRoot}/users-list-${width}-${theme}.png`,
      fullPage: false,
    });
    await arrow.click();
    const detail = page.getByRole("dialog", { name: /^Chi tiết người dùng/ });
    await drawerGeometry(page, detail);
    await expect(
      detail.getByRole("heading", {
        name: "Nguyễn Minh Anh — Điều phối vận hành kho và kiểm soát dữ liệu Hoa Nam",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      detail.getByText("minh.anh.dieu.phoi.van.hanh.kho@example.com", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(detail.locator(".hn-iam-assignment-card")).toHaveCount(2);
    await page.screenshot({
      path: `${screenshotRoot}/user-detail-${width}-${theme}.png`,
      fullPage: false,
    });
    await detail
      .getByRole("tab", { name: "Quyền hiệu lực", exact: true })
      .click();
    const directPermission = detail
      .locator(".hn-iam-effective-list article")
      .filter({ hasText: "report.export" });
    await expect(directPermission).toContainText("Xuất báo cáo");
    await expect(directPermission).toContainText("Theo dõi báo cáo");
    await expect(directPermission).toContainText(
      /Cấp riêng|Cấp trực tiếp|Cấp bổ sung/,
    );
    await drawerGeometry(page, detail);
    await page.screenshot({
      path: `${screenshotRoot}/user-effective-${width}-${theme}.png`,
      fullPage: false,
    });
    await detail.getByRole("button", { name: "Sửa", exact: true }).click();
    const editor = page.getByRole("dialog", { name: /^Sửa người dùng/ });
    await drawerGeometry(page, editor);
    if (width <= 390) {
      const steps = editor.locator(".hn-iam-editor-step-tabs");
      for (const label of [
        "Thông tin tài khoản",
        "Vai trò & phạm vi",
        "Xem lại & lưu",
      ]) {
        const tab = steps.getByRole("tab", { name: label, exact: true });
        await expect(tab).toBeVisible();
        const bounds = await tab.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        expect(
          await tab.evaluate(
            (node) =>
              node.scrollWidth <= node.clientWidth + 1 &&
              node.scrollHeight <= node.clientHeight + 1,
          ),
        ).toBe(true);
      }
      await expect(steps.locator(".MuiTabs-scrollButtons:visible")).toHaveCount(
        0,
      );
      await page.screenshot({
        path: `${screenshotRoot}/user-edit-account-${width}-${theme}.png`,
        fullPage: false,
      });
    }
    await expect(
      editor.getByLabel("Họ và tên", { exact: false }),
    ).toBeVisible();
    await expect(editor.locator("#iam-password")).not.toBeVisible();
    await editor
      .getByRole("tab", { name: "Vai trò & phạm vi", exact: true })
      .click();
    await expect(
      editor.getByRole("combobox", { name: "Vai trò", exact: true }),
    ).toBeVisible();
    await drawerGeometry(page, editor);
    await page.screenshot({
      path: `${screenshotRoot}/user-assignment-${width}-${theme}.png`,
      fullPage: false,
    });
    await editor
      .getByRole("tab", { name: "Xem lại & lưu", exact: true })
      .click();
    await expect(editor.locator("#iam-password")).toBeVisible();
    await expect(editor.locator("#iam-reason")).toBeVisible();
    await drawerGeometry(page, editor);
    const actionButtons = editor.locator("[data-ui-drawer-actions] > button");
    const cancelBounds = await actionButtons.first().boundingBox();
    const saveBounds = await actionButtons.last().boundingBox();
    expect(
      saveBounds!.x - cancelBounds!.x - cancelBounds!.width,
    ).toBeGreaterThanOrEqual(8);
    if (theme === "dark") {
      const contrast = await editor
        .getByRole("tab", { name: "Xem lại & lưu", exact: true })
        .evaluate((tab) => {
          const rgb = (color: string) =>
            (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const luminance = (channels: number[]) =>
            channels
              .map((channel) => {
                const value = channel / 255;
                return value <= 0.04045
                  ? value / 12.92
                  : ((value + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, value, index) =>
                  sum + value * [0.2126, 0.7152, 0.0722][index],
                0,
              );
          const text = luminance(rgb(getComputedStyle(tab).color));
          const background = luminance(
            rgb(
              getComputedStyle(tab.closest(".MuiDrawer-paper")!)
                .backgroundColor,
            ),
          );
          return (
            (Math.max(text, background) + 0.05) /
            (Math.min(text, background) + 0.05)
          );
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    await page.screenshot({
      path: `${screenshotRoot}/user-edit-review-${width}-${theme}.png`,
      fullPage: false,
    });
    await closeDrawer(page, editor);
    expect(
      await page.evaluate(() =>
        window.__iamRequests.filter((request) => request.method !== "GET"),
      ),
    ).toEqual([]);
  });
}
