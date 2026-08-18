# WWHN-268 · FE268-D02 — bằng chứng TRƯỚC khi sửa

Lượt chạy retest đầu tiên của `e2e/wwhn-268-defect-retest.spec.ts` trên nhánh
`m1`, trước khi áp `tableEmptyText` / `TableLoadingBanner` và trước khi bỏ
`ApiErrorAlert` cục bộ ở `/inbound`.

Lệnh: `npx playwright test e2e/wwhn-268-defect-retest.spec.ts --project=chromium`

Kết quả: **7 failed / 14 passed**.

| # | Ca kiểm | Selector không tìm thấy | Route |
|---|---------|-------------------------|-------|
| 1 | stock-inbound · loading → empty | `[data-ui-state="empty"]` | `/inbound` |
| 2 | stock-inbound · lỗi máy chủ và từ chối quyền | `[data-ui-state="error"]` | `/inbound` |
| 3 | stock-outbound · loading → empty | `[data-ui-state="empty"]` | `/outbound` |
| 4 | stock-inventory · loading → empty | `[data-ui-state="empty"]` | `/inventory` |
| 5 | reversal · loading → empty | `[data-ui-state="empty"]` | `/reverse` |
| 6 | warranty · loading → empty | `[data-ui-state="empty"]` | `/warranty` |
| 7 | report · loading → empty | `[data-ui-state="empty"]` | `/reports` |

Trích nguyên văn một lần fail:

```
Error: expect(locator).toBeVisible() failed
Locator: locator('[data-ui-state="empty"]').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found
> 421 |       await expect(page.locator(UI_STATE_SELECTOR.empty).first()).toBeVisible();
```

## Đọc kết quả

- Sáu màn trong phạm vi regression đều tự viết `locale.emptyText` bằng chuỗi
  ternary, nên trạng thái rỗng không đi qua `EmptyState` dùng chung.
- Riêng `/inbound` fail thêm ở nhánh lỗi: file khai báo một `ApiErrorAlert` cục
  bộ che component dùng chung, nên 500 hiện Alert tự chế và 403 hiện Alert vàng
  thay vì `NoPermissionState` — trái §8.2 (403 phải phân biệt với 500) và trái
  Annex D.
- Ca RBAC gõ thẳng URL (`FE268-D03`) PASS ngay từ lượt đầu ở cả sáu route: đó là
  kiểm chứng, không phải defect.

Lượt chạy SAU khi sửa: **20 passed / 1 failed**, trong đó ca fail duy nhất là
lỗi hạ tầng Playwright (`apiRequestContext._wrapApiCall: ENOENT ... traces/resources/*.jpeg`)
chứ không phải assertion nghiệp vụ. Lượt chạy chốt nằm trong
`docs/evidence/WWHN-268/RUN_MANIFEST.json`.
