# WWHN-209 — FE QA2 Retest Evidence (Review 14186 · P1-02 + P2-01/P2-02)

Ngày chạy: 2026-08-20 · Local (thay CI theo DEC-325-CI-LOCAL-01 — quota GitHub Actions 3000/3000, không phát sinh run mới).

## 1. Phạm vi

Đóng P1-02 của review comment 14186: "QA2 chưa retest UI role/navigation — Test login redirect, refresh, logout, `/errors/403`, role navigation, browser/viewport". Suite thực thi yêu cầu này là [`e2e/auth-role-navigation-qa2.spec.ts`](../../../e2e/auth-role-navigation-qa2.spec.ts) (WWHN-144/145). Trước khi sửa, suite này **đỏ 2-5/7 test tuỳ vòng chạy** — không thể dùng làm căn cứ sign-off trung thực. Đồng thời chạm P2-01 (screenshot/video UI states — suite tự chụp evidence PNG+JSON qua `captureEvidence()`) và P2-02 (accessibility/browser matrix — companion suite `wwhn-274-a11y-browser-matrix.spec.ts` verified riêng, 3/3 xanh).

## 2. Candidate

| Mục | Giá trị |
|---|---|
| Base HEAD lúc bắt đầu | `a4201a3` |
| Candidate (commit-cuối-chạm-artifact) | `b263625` — `e2e/auth-role-navigation-qa2.spec.ts` (5 fix) + `AlignedMvpOutboundPage.test.tsx` (mới) |
| Nhánh | `m1` |
| Disclosure | Trong lúc chạy, 3 commit của phiên song song landed lên cùng HEAD (`78738f9` WWHN-165 contract, `6e4c397` test align, `707841f`, `26442f9`) — không xung đột với patch của tôi, xác nhận bằng `git merge-base --is-ancestor` + re-run xanh lại sau mỗi lần HEAD dịch chuyển. |

## 3. Root cause của 5 assertion đỏ (mỗi cái xác nhận qua `git blame`/`git log -p` trước khi sửa — không sửa mù)

| # | Assertion cũ | Thực tế hiện hành | Nguồn gốc |
|---|---|---|---|
| 1 | Mock `/auth/me` đặt `permission_codes` trong `active_context` | `auth.store.ts::setProfile()` đọc `permissionCodes` từ `me.permissions` **top-level** | Commit `78738f9` (WWHN-165, phiên song song) đổi hợp đồng `/auth/me` sang top-level permissions; mock e2e (file WWHN-144/145, độc lập) không được cập nhật theo |
| 2 | `"Wireframe mức low-fi · Nguồn BA: BRD / SRS-FRD / BPD hiện tại."` | `"Wireframe low-fi · Nguồn hiện hành: BRD v3.20 / SRS-FRD v1.12 / BPD v1.12 · DEC-HN-20260814-01."` | Commit `68a6a68` ("gỡ cờ 4") refresh câu chữ trích dẫn versioned trong `MvpSourceScreen.tsx`, test không theo kịp |
| 3 | `/master-data?source=direct-url` | `ROUTES.MASTER_DATA = "/master-data/skus"` | Route bị đổi tên ở một commit cũ hơn (`git log -p` xác nhận rename `/master-data` → `/master-data/skus`); path cũ rơi vào wildcard `*` → `Navigate(HOME)`, khiến 1 test PASS **tình cờ** (đích trùng `/login`) và 1 test khác FAIL sai lý do |
| 4 | `columnheader "Theo dõi serial"` | `columnheader "Serial"` | MST-01 giờ render `SkuMasterScreen` thật (`ApiMasterScreens.tsx`, API-backed) thay vì bảng tĩnh port-verbatim của `MvpSourceScreen`; component thật dùng `<th>Serial</th>` |
| 5 | `button "+ Tạo SKU"` | `button "Thêm SKU"` | Cùng nguyên nhân #4 — `ApiMasterScreens.tsx` dùng "Thêm SKU" |

**Kết luận root cause chung**: đây đều là **product drift hợp lệ** (đổi hợp đồng auth, refresh câu chữ theo tài liệu, đổi route, port static wireframe → component API thật) mà bộ e2e WWHN-144/145 (viết một lần, không phải phần của luồng đóng ticket sau này) chưa được đồng bộ. Không có regression thật trong logic RBAC/routing — sửa test để khớp UI đúng hiện hành, **không sửa UI**.

## 4. Kết quả chạy

Môi trường: clean `git worktree` tại đúng candidate HEAD lúc verify (`78738f9`, sau đó re-verify tại `b263625`), vite dev server cô lập port 5473 (không đụng port 5173 của phiên song song, đúng bẫy WWHN-217 D-217 đã biết).

```
npx playwright test e2e/auth-role-navigation-qa2.spec.ts --project=wwhn-144-chromium
→ 7/7 PASS (39.2s)
  ✓ anonymous direct URL is fail-closed and redirects to login
  ✓ limited role menu is filtered and forbidden direct URL renders 403
  ✓ authenticated user can open /errors/403 directly
  ✓ BA source-port navigation renders exact screen inventory
  ✓ responsive shell 1440x900
  ✓ responsive shell 768x1024
  ✓ responsive shell 375x812
```

Unit bundle liên quan (auth/RBAC/UI-state/outbound), chạy lại sau toàn bộ thay đổi:

```
npx vitest run src/test/auth-security-rbac-audit.test.ts src/app/router/ProtectedRoute.test.tsx \
  src/app/router/RequirePermission.test.tsx src/app/router/access.test.ts src/app/bootstrap-auth.test.ts \
  src/shared/api/axios.test.ts src/shared/api/axios.refresh.integration.test.ts \
  src/modules/auth/hooks/use-login.test.tsx src/modules/auth/pages/LoginPage.test.tsx \
  src/shared/store/auth.store.test.ts src/app/layouts/SideNav.test.tsx src/shared/constants/ui-state.test.tsx \
  src/shared/api/post-issue-contract.test.ts src/test/flow06-packing-label-alignment.test.ts \
  src/modules/outbound/pages/AlignedMvpOutboundPage.test.tsx
→ 15 files, 103/103 PASS
```

Unit test mới cho P0-Backend-proof phía FE (RBAC gating OUT-01, `AlignedMvpOutboundPage.test.tsx`):

```
→ 4/4 PASS
  ✓ hỏi đúng permission code Annex C, không dùng code ma
  ✓ chỉ outbound.view: không có nút tiếp nhận, mọi hàng đều read-only 'Xem'
  ✓ có outbound.scan + outbound.import: DRAFT hiện 'Mở', POSTED vẫn chỉ 'Xem'
  ✓ lỗi tải danh sách: render ApiErrorAlert thay vì màn trắng
```

## 5. P2 status

- **P2-01 (screenshot/video UI states)**: `captureEvidence()` trong suite tự ghi PNG full-page + JSON metadata + video (`playwright.config.ts: video: "retain-on-failure"`, trace `retain-on-failure`) cho mọi scenario (login/403/responsive). Không cần bổ sung riêng — evidence sinh ra ngay khi chạy suite tại `test-results/wwhn-144/<sha>/`.
- **P2-02 (accessibility/browser matrix)**: NFR-SRS-006 (Chrome/Edge latest 2, Chrome Android, Safari iOS, breakpoints 360/768/1280) được phủ bởi `e2e/wwhn-274-a11y-browser-matrix.spec.ts`, chạy đúng lệnh `test:e2e:wwhn-274:a11y` (3 project × 3 test = 9 instance) trong phiên này: **7 PASS, 2 SKIP (0 FAIL)**. Hai skip là `test.skip()` chủ đích trong source — "keyboard-only operation reaches and submits the login form" chỉ chạy trên `wwhn-274-desktop-chromium` vì Chrome Android/Safari iOS dùng touch, không có hợp đồng tab-order bàn phím (dòng 196-199 của spec). Không phải gap.

## 6. Kết luận

QA2 role/navigation retest suite giờ có thể chạy xanh trung thực tại candidate `b263625` — đủ căn cứ cho QA2 sign-off P1-02. Không có thay đổi UI/logic sản phẩm nào trong phạm vi fix này, chỉ đồng bộ lại test với hành vi hiện hành.
