import { QueryClient } from '@tanstack/react-query';

// Tách riêng khỏi query-provider.tsx (chỉ export component) — gộp chung sẽ
// vi phạm react-refresh/only-export-components (file export cả component lẫn
// hằng số làm mất Fast Refresh). Xuất ra ngoài để useSwitchContext gọi
// invalidateQueries() sau khi POST /auth/switch-context thành công, và
// auth.store gọi clear() khi logout — tránh hiển thị dữ liệu scope cũ sau khi
// user đổi vai trò/phạm vi hoặc đổi tài khoản (xem docs/TASK_BLOCKERS.md).
//
// Defaults thống nhất cho toàn ERP (P2 — trước đây dùng mặc định thư viện:
// retry 3 lần + staleTime 0 cho MỌI query, gây refetch thừa mỗi lần focus/mount):
// - staleTime 60s: hầu hết danh mục/danh sách không đổi liên tục, giảm gọi lại
//   API vô ích. Trang cần dữ liệu tươi hơn tự set staleTime riêng khi gọi useQuery.
// - gcTime 5 phút: giữ cache đủ lâu để chuyển tab qua lại không phải load lại.
// - retry 1: tránh chờ lâu vô ích khi API lỗi 4xx (lỗi nghiệp vụ) — request thật
//   sự đáng retry (timeout/network) đã có logic riêng ở use-me.ts.
// - refetchOnWindowFocus false: tránh tự refetch gây giật UI khi user chuyển
//   tab/app — invalidate chủ động (vd sau mutation, sau đổi context) vẫn hoạt động.
// - mutations retry 0: KHÔNG tự retry POST/PUT/DELETE — tránh lặp side-effect
//   (vd tạo trùng bản ghi) nếu request đầu đã tới BE nhưng response bị mất.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
