/**
 * @deprecated SHIM tương thích — MUI theme thật ở `@/shared/ui/theme/mui-adapter`
 * (map từ canonical tokens `@/shared/ui/tokens`).
 *
 * Giữ path này để các import cũ `@/app/mui-theme` tiếp tục hoạt động trong lúc
 * chuyển tiếp; KHÔNG mount thêm theme provider mới — composition root duy nhất
 * là `AppThemeProvider` (guard: `yarn ui:architecture`).
 */
export { muiTheme } from "@/shared/ui/theme/mui-adapter";
