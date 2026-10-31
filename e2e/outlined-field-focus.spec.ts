import { expect, test, type Locator } from "@playwright/test";

async function settle(field: Locator) {
  await field.evaluate(async (element) => {
    element.getBoundingClientRect();
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

async function expectSingleFocus(field: Locator) {
  const control = field.locator(".MuiOutlinedInput-root");
  await expect(control).toHaveClass(/Mui-focused/);
  await settle(field);
  const input = control
    .locator(
      "input:not([aria-hidden]), textarea:not([aria-hidden]), [role=combobox]",
    )
    .first();
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS("outline-style", "none");
  const borderWidth = await control
    .locator("fieldset")
    .evaluate((element) =>
      parseFloat(getComputedStyle(element).borderTopWidth),
    );
  expect(borderWidth).toBe(2);
  await expect(control).toHaveCSS("box-shadow", "none");
}

const skins = [
  "hn-settings-screen",
  "hn-settings-dialog",
  "hn-catalog-screen",
  "hn-sku-screen",
  "hn-defect-screen",
  "hn-rpt01",
  "hn-inbound-report",
  "hn-outbound-report",
  "hn-inbound-list",
  "hn-outbound-list",
  "hn-reversal-screen",
  "hn-inventory-dialog",
  "hn-iam-page",
  "hn-putaway-page",
  "ptw-dialog",
  "hn-war04",
];
for (const theme of ["light", "dark"]) {
  for (const skin of skins) {
    test(`${theme} ${skin}: one focus border across outlined controls`, async ({
      page,
    }) => {
      await page.goto(
        `/e2e/fixtures/outlined-fields.html?skin=${skin}&theme=${theme}`,
      );
      for (const id of [
        "filled",
        "empty",
        "select",
        "autocomplete",
        "multiline",
        "error",
      ]) {
        const field = page.getByTestId(id);
        await field.hover();
        await expect(field.locator(".MuiOutlinedInput-root")).not.toHaveClass(
          /Mui-focused/,
        );
        // Enter from keyboard modality, as well as the pointer interaction in the report.
        await page.keyboard.press("Tab");
        await field
          .locator(
            "input:not([aria-hidden]), textarea:not([aria-hidden]), [role=combobox]",
          )
          .first()
          .focus();
        await expectSingleFocus(field);
        await page.getByTestId("before").focus();
      }
      await expect(
        page.getByTestId("disabled").locator("input"),
      ).toBeDisabled();
      await expect(page.getByTestId("error").locator("input")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
  }
  for (const width of [360, 1440]) {
    test(`${theme} ${width}: floating labels fit inside the notch`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(`/e2e/fixtures/outlined-fields.html?theme=${theme}`);
      for (const id of [
        "filled",
        "long",
        "empty",
        "select",
        "multiline",
        "error",
      ]) {
        const field = page.getByTestId(id);
        await field
          .locator(
            "input:not([aria-hidden]), textarea:not([aria-hidden]), [role=combobox]",
          )
          .first()
          .focus();
        await settle(field);
        const label = await field.locator(".MuiInputLabel-root").boundingBox();
        const notch = await field.locator("legend").boundingBox();
        expect(label).not.toBeNull();
        expect(notch).not.toBeNull();
        expect(notch!.x).toBeLessThanOrEqual(label!.x - 2);
        expect(notch!.x + notch!.width).toBeGreaterThanOrEqual(
          label!.x + label!.width + 2,
        );
      }
    });
  }
}

test("keyboard focus stays visible on standalone controls and password actions", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/outlined-fields.html");
  await page.getByTestId("before").focus();
  await page.keyboard.press("Tab");
  await expectSingleFocus(page.getByTestId("filled"));
  await page.getByTestId("password").locator("input").focus();
  await page.keyboard.press("Tab");
  const toggle = page.getByRole("button", { name: "Hiện mật khẩu" });
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("password").locator("input")).toHaveAttribute(
    "type",
    "text",
  );
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Ô nhập gốc")).toBeFocused();
  await expect(page.getByLabel("Ô nhập gốc")).toHaveCSS(
    "outline-style",
    "solid",
  );
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("after")).toBeFocused();
  await expect(page.getByTestId("after")).toHaveCSS("outline-style", "solid");
});

test("pointer hover, click, editing and option selection keep a single border", async ({
  page,
}, testInfo) => {
  await page.goto("/e2e/fixtures/outlined-fields.html");
  const name = page.getByTestId("filled");
  await name.hover();
  await expect(name.locator("input")).toHaveCSS("outline-style", "none");
  await name.locator("input").click();
  await expectSingleFocus(name);
  await name.locator("input").fill("Kho tổng Hoa Nam cập nhật");
  await expect(name.locator("input")).toHaveValue("Kho tổng Hoa Nam cập nhật");
  await page.screenshot({
    path: testInfo.outputPath("warehouse-name-focus.png"),
    fullPage: true,
  });

  const select = page.getByTestId("select");
  await select.getByRole("combobox").click();
  await page.getByRole("option", { name: "Ngừng hoạt động" }).click();
  await expect(select.getByRole("combobox")).toHaveText("Ngừng hoạt động");
  await expectSingleFocus(select);

  const province = page.getByTestId("autocomplete");
  await province.getByRole("combobox").fill("Ha Noi");
  await page.getByRole("option", { name: "Hà Nội" }).click();
  await expect(province.getByRole("combobox")).toHaveValue("Hà Nội");
  await expectSingleFocus(province);
});

test("PV product edit label stays clear on hover and focus", async ({
  page,
}, testInfo) => {
  await page.goto("/e2e/fixtures/outlined-fields.html?skin=pv-catalog-dialog");
  const field = page.getByTestId("pv-display-name");
  const input = field.locator("input");
  await field.hover();
  await input.click();
  await expectSingleFocus(field);
  await expect(field.locator(".MuiOutlinedInput-root")).toHaveCSS(
    "box-shadow",
    "none",
  );
  const label = await field.locator(".MuiInputLabel-root").boundingBox();
  const notch = await field.locator("legend").boundingBox();
  expect(label).not.toBeNull();
  expect(notch).not.toBeNull();
  expect(notch!.x).toBeLessThanOrEqual(label!.x - 2);
  expect(notch!.x + notch!.width).toBeGreaterThanOrEqual(
    label!.x + label!.width + 2,
  );
  await field.screenshot({
    path: testInfo.outputPath("pv-display-name-focus.png"),
  });
});
