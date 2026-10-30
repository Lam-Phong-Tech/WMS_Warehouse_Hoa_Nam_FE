# Quy tắc kiểm tra, commit và push

Áp dụng cho repository `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`.

## 1. Xác định phạm vi và nhánh gốc

- Đọc yêu cầu, `AGENTS.md` nếu có, `package.json`, các hook trong `.husky/` và `.github/workflows/ci.yml`.
- Kiểm tra cả staged và unstaged trước khi sửa. Không đưa thay đổi có sẵn của người khác vào commit của mình.
- Dùng nhánh riêng, tên mô tả công việc: `fix/dashboard-warehouse-header`, `feat/...`, `docs/...`.
- Không commit trực tiếp lên `dev`, `m1` hoặc nhánh được bảo vệ. Không tự merge hay triển khai khi yêu cầu chỉ là commit/push.

```powershell
git status --short --branch
git diff --stat
git diff --cached --stat
git remote -v
git fetch origin
```

Nếu workspace sạch và bắt đầu công việc mới từ `dev`:

```powershell
git switch -c fix/ten-thay-doi origin/dev
```

Nếu workspace đang có việc dở, tạo worktree riêng từ commit nền phù hợp; không tự stash, reset hoặc xoá thay đổi:

```powershell
git worktree add -b fix/ten-thay-doi ../ten-worktree HEAD
Set-Location ../ten-worktree
```

Chọn `HEAD` khi cần giữ nền hiện tại, chọn `origin/dev` khi bắt đầu từ bản dev mới nhất. Kiểm tra chênh lệch nền trước khi mở PR.

## 2. Chuẩn bị môi trường

- CI dùng Node.js 22 và Yarn với `yarn.lock`. Giữ nguyên lockfile nếu không đổi dependencies.
- Khi cần cài dependencies, dùng `yarn install --frozen-lockfile --non-interactive`.
- Không tự tạo thêm `package-lock.json` hoặc `pnpm-lock.yaml` cho công việc chỉ sửa giao diện.
- Không commit `.env`, thông tin đăng nhập, token, `node_modules`, `dist`, log hoặc bằng chứng sinh tự động trong `test-results`.

## 3. Sửa đúng nguyên nhân và kiểm thử

- Giữ thay đổi nhỏ, đúng phạm vi; tránh format lại file không liên quan.
- Với giao diện, kiểm tra desktop, tablet, mobile, hai phía breakpoint, tên/nội dung dài, overflow, bàn phím và tương tác liên quan.
- Bổ sung kiểm tra hồi quy khi nó tái hiện được lỗi thật. Không đổi assertion hoặc tắt gate chỉ để lấy kết quả xanh.
- Chạy các lệnh dưới đây và ghi nhận exit code. `build` đã bao gồm `tsc -b`.

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run ui:guards
npm run build
npm run health:check
```

Với dashboard MAP-01, chạy thêm các kiểm tra layout bằng Chromium:

```powershell
node scripts/verify-dashboard-heading-layout.mjs
node scripts/verify-dashboard-priority-layout.mjs
```

Nếu thiếu browser, cài bằng `npx playwright install chromium`. Harness layout dùng fixture và CSS thật; không thay thế kiểm tra đăng nhập/dữ liệu trên hệ thống thật.

Chạy E2E liên quan nếu có spec, dữ liệu và môi trường phù hợp:

```powershell
npm run test:e2e
```

Một test bị skip vì thiếu credentials không được tính là pass. Không ghi “test đầy đủ đều pass” khi còn gate lỗi, chưa chạy hoặc bị skip. Các gate contract/security trong CI vẫn phải xanh trước khi merge.

Nếu gate đỏ, xác định lỗi do thay đổi hay có sẵn ở commit nền. Sửa lỗi trong phạm vi; ghi rõ lỗi nền và bước tái hiện nếu chưa xử lý. Không bỏ qua hook bằng `--no-verify` hoặc `HUSKY=0`.

Nếu đã được yêu cầu chia sẻ nhánh trong khi còn lỗi nền, chỉ push nhánh làm việc và công bố rõ các gate chưa đạt. Nhánh đó chưa đủ điều kiện merge; không đánh dấu kiểm thử thành công toàn bộ.

## 4. Review diff và commit

```powershell
git diff --check
git diff
git status --short
```

Stage từng đường dẫn đã review; tránh `git add .` và `git add -A` trong workspace có thay đổi khác:

```powershell
git add -- src/modules/dashboard/dashboard-overview.css
git add -- scripts/verify-dashboard-heading-layout.mjs docs/COMMIT_WORKFLOW.md
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "fix(dashboard): keep warehouse card at top right of header"
```

- Cấu trúc: `<type>(<scope>): <hành vi thay đổi>`. Type thường dùng: `fix`, `feat`, `docs`, `refactor`, `test`, `chore`.
- Một commit phải có mục đích rõ ràng và khả năng review/hoàn tác độc lập.
- Pre-commit quét credentials và chạy typecheck nếu có TypeScript. Pre-push chạy typecheck. Để hook chạy bình thường.
- Sau commit, kiểm tra nội dung thực sự đã commit; nếu hook sửa file thì review và kiểm thử lại phần thay đổi.

```powershell
git show --stat --oneline HEAD
git status --short --branch
```

## 5. Push và xác minh GitHub

Đọc tên nhánh từ `git branch --show-current`, rồi dùng đúng tên đó trong lệnh push. Không push nhầm sang `dev`/`m1`.

```powershell
git branch --show-current
git push -u origin fix/ten-thay-doi
git rev-parse HEAD
git ls-remote --heads origin refs/heads/fix/ten-thay-doi
```

SHA local và remote phải trùng nhau. Nếu remote từ chối vì đã có commit mới, fetch và review trước khi tích hợp; không force push mặc định.

Khi mở PR, mô tả vấn đề, hành vi sau sửa, phạm vi, bằng chứng kiểm thử và giới hạn còn lại. Với UI, đính kèm ảnh trước/sau khi phù hợp. Kiểm tra mọi required check; chưa merge khi CI đỏ hoặc pending. Push nhánh riêng không đồng nghĩa đã triển khai lên website.

## 6. Thông tin bàn giao

- Nhánh, SHA và link GitHub.
- File chính đã sửa và tài liệu mới.
- Lệnh kiểm tra đã chạy cùng kết quả thực tế, test bị skip và lỗi nền nếu có.
- Vị trí worktree nếu dùng worktree riêng, để người tiếp theo làm việc trên đúng mã nguồn.
