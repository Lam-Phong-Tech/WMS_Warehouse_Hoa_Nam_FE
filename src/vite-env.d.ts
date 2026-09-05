/// <reference types="vite/client" />

/**
 * Định danh build, do `vite.config.ts` inject lúc build (define).
 *
 * Dùng ở HAI nơi và phải là CÙNG một giá trị:
 *  - `src/shared/cache/cache-namespace.ts` — deploy mới thì cache persisted của
 *    build cũ hết hiệu lực, tránh hydrate dữ liệu có shape không còn khớp API.
 *  - `public/service-worker.js` (qua `?v=` lúc đăng ký) — đổi tên CacheStorage
 *    nên chunk của build cũ bị dọn thay vì nằm lại vĩnh viễn.
 */
declare const __APP_BUILD_ID__: string;
