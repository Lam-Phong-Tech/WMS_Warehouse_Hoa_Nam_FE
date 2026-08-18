# WWHN-268 · FE268-D01 — bằng chứng TRƯỚC khi sửa

Kiểm kê toàn bộ test hook của FE tại thời điểm mở defect (nhánh `m1`, trước
commit sửa của WWHN-268).

Lệnh đã chạy:

```
grep -rno 'data-testid="[^"]*"' src/ | wc -l
grep -rhno 'data-testid="[^"]*"' src/ | sed 's/.*data-testid="//;s/"//' | sort -u
```

Kết quả thô:

```
5
component-issue-modal
detail-modal
intake-modal
navigation-toggle
primary-navigation
```

## Vì sao đây là defect

SRS/FRD v1.12 Annex D yêu cầu mỗi màn hình có đủ các trạng thái Loading / Empty
/ Error / Success / Disabled / Confirm / Permission-denied. Toàn bộ FE chỉ có
**5** test hook và **không có hook nào thuộc nhóm trạng thái** — cả 5 đều là id
của modal/nav.

Hệ quả trực tiếp lên yêu cầu P1 "UI evidence" của WWHN-268:

- Không có cách xác định một ảnh chụp đang ở trạng thái nào; bằng chứng trở
  thành ảnh chụp màn hình chung chung — đúng nhận xét của reviewer.
- Bằng chứng buộc phải dò theo chuỗi tiếng Việt hiển thị (`"Không có dữ liệu"`,
  `"Bạn không có quyền truy cập"`), nên đổi copy là hỏng toàn bộ bộ bằng chứng.
- Trạng thái `empty` và trạng thái `error` của thân bảng in ra hai chuỗi khác
  nhau nhưng cùng kiểu hiển thị, không phân biệt được trong ảnh chụp.

Bằng chứng SAU khi sửa: `src/shared/constants/ui-state.test.tsx` (8 test) và
`e2e/wwhn-268-defect-retest.spec.ts` (gallery 7 trạng thái × 3 viewport).
