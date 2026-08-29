import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";

/**
 * Route /reports.
 *
 * Trước đây màn này là một lớp tab thứ hai ("Báo cáo theo từng thị trường" /
 * "Báo cáo vận hành") bọc ngoài 7 tab nghiệp vụ, tức người dùng phải đi qua hai
 * tầng tab để tới báo cáo. Nhóm "theo từng thị trường" đã được gỡ khỏi phạm vi,
 * nên lớp bọc không còn lý do tồn tại — render thẳng trang Báo cáo vận hành.
 */
export default function ReportsPage() {
  return <AlignedReportsPage />;
}
