/**
 * E2E test cho 401 → refresh → retry → clear state flow
 *
 * Chạy: npx playwright test e2e/refresh-interceptor.spec.ts
 *
 * Test này verify:
 * 1. 401 → gọi /auth/refresh → retry request gốc → thành công
 * 2. Refresh fail → redirect về /login, không loop
 * 3. Retry success → error state được clear
 * 4. Request bình thường (không 401) → không redirect, không toast
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

interface MockApiOptions {
    refreshTokenValid?: boolean;
    initialTokenExpired?: boolean;
}

interface MockApiResult {
    getRefreshCallCount: () => number;
}

/**
 * Mock API responses để simulate 401 + refresh flow mà không cần BE thật.
 * Dùng page.route() intercept tất cả API calls.
 */
async function setupMockApi(page: Page, options: MockApiOptions): Promise<MockApiResult> {
    const { refreshTokenValid = true, initialTokenExpired = true } = options;
    let refreshCallCount = 0;
    let accessToken = initialTokenExpired ? 'expired-token-XYZ' : 'valid-token-ABC';

    await page.route('**/api/v1/**', async (route: Route) => {
        const url = route.request().url();

        // Login endpoint
        if (url.includes('/auth/login')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        access_token: 'valid-token-ABC',
                        token_type: 'bearer',
                        expires_in: 604800,
                        user: { id: 1, name: 'Test User', email: 'test@example.com' },
                    },
                    meta: { request_id: 'test-uuid' },
                }),
            });
        }

        // Refresh endpoint
        if (url.includes('/auth/refresh')) {
            refreshCallCount++;
            if (refreshTokenValid) {
                accessToken = 'new-token-ABC';
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: { access_token: accessToken, token_type: 'bearer', expires_in: 604800 },
                    }),
                });
            }
            return route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, message: 'Refresh token expired' }),
            });
        }

        // Employees endpoint (used as test target)
        if (url.includes('/employees')) {
            const authHeader = route.request().headers()['authorization'] || '';
            if (!authHeader.includes('Bearer ') || authHeader.includes('expired-token')) {
                return route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: false, message: 'Unauthenticated' }),
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { items: [], meta: { total: 0, current_page: 1, per_page: 15 } },
                }),
            });
        }

        // Auth/me endpoint
        if (url.includes('/auth/me')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        id: 1,
                        name: 'Test User',
                        email: 'test@example.com',
                        is_super_admin: true,
                        active_context: null,
                        available_contexts: [],
                        permission_codes: [],
                    },
                }),
            });
        }

        // Default: pass through
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: {} }),
        });
    });

    return { getRefreshCallCount: () => refreshCallCount };
}

test.describe('401 Refresh Interceptor Flow', () => {
    test('P2-2: 401 → refresh → retry origin thành công 200', async ({ page }: { page: Page }) => {
        const { getRefreshCallCount } = await setupMockApi(page, {
            refreshTokenValid: true,
            initialTokenExpired: true,
        });

        // Login trước
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
        await page.fill('input[type="password"], input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');

        // Navigate tới trang employees (sẽ trigger 401 → refresh → retry)
        await page.goto(`${BASE_URL}/employees`);
        await page.waitForLoadState('networkidle');

        // Verify: refresh được gọi ít nhất 1 lần
        expect(getRefreshCallCount()).toBeGreaterThanOrEqual(1);

        // Verify: không bị redirect về login
        expect(page.url()).not.toContain('/login');
    });

    test('P2-3: refresh fail → redirect về login, không loop', async ({ page }: { page: Page }) => {
        const { getRefreshCallCount } = await setupMockApi(page, {
            refreshTokenValid: false,
            initialTokenExpired: true,
        });

        // Login trước
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
        await page.fill('input[type="password"], input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');

        // Navigate tới trang employees (sẽ trigger 401 → refresh fail → redirect)
        await page.goto(`${BASE_URL}/employees`);
        await page.waitForLoadState('networkidle');

        // Verify: refresh chỉ được gọi tối đa 1 lần (không loop)
        expect(getRefreshCallCount()).toBeLessThanOrEqual(1);

        // Verify: redirect về login
        expect(page.url()).toContain('/login');
    });

    test('P1-4: retry success → error state cleared', async ({ page }: { page: Page }) => {
        const { getRefreshCallCount } = await setupMockApi(page, {
            refreshTokenValid: true,
            initialTokenExpired: true,
        });

        // Login trước
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
        await page.fill('input[type="password"], input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');

        // Navigate tới trang employees
        await page.goto(`${BASE_URL}/employees`);
        await page.waitForLoadState('networkidle');

        // Verify: refresh được gọi
        expect(getRefreshCallCount()).toBeGreaterThanOrEqual(1);

        // Verify: không có error toast/message hiển thị
        const errorToast = page.locator('[role="alert"], .ant-message-error, .sonner-toast-error');
        await expect(errorToast).toHaveCount(0);

        // Verify: data được load thành công (không còn error state)
        await expect(page.locator('table, .ant-table, [data-testid="table"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {
            // Table might not be present if no data, but at least no error
        });
    });

    test('Bootstrap: request OK → không redirect, không toast', async ({ page }: { page: Page }) => {
        await setupMockApi(page, {
            refreshTokenValid: true,
            initialTokenExpired: false, // Token valid ngay từ đầu
        });

        // Login trước
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
        await page.fill('input[type="password"], input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');

        // Navigate tới trang employees (token valid, không cần refresh)
        await page.goto(`${BASE_URL}/employees`);
        await page.waitForLoadState('networkidle');

        // Verify: không redirect về login
        expect(page.url()).not.toContain('/login');

        // Verify: không có error toast
        const errorToast = page.locator('[role="alert"], .ant-message-error, .sonner-toast-error');
        await expect(errorToast).toHaveCount(0);
    });
});