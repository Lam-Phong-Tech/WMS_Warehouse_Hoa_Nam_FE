/**
 * Preload Manager - Quản lý việc preload các page chunks quan trọng
 *
 * Mục đích:
 * - Preload các trang phổ biến khi user đang ở trang khác
 * - Giảm thời gian chờ khi navigate
 * - Tận dụng browser idle time
 */

// Danh sách các routes cần preload (theo thứ tự ưu tiên)
const CRITICAL_ROUTES = [
  () => import('@/modules/org-units/pages/OrgUnitsPage'),
  () => import('@/modules/employees/pages/EmployeesPage'),
  () => import('@/modules/departments/pages/DepartmentsPage'),
] as const;

const SECONDARY_ROUTES = [
  () => import('@/modules/roles/pages/RolesPage'),
  () => import('@/modules/positions/pages/PositionsPage'),
  () => import('@/modules/tasks/pages/TasksPage'),
] as const;

type PreloadStatus = 'idle' | 'loading' | 'ready';

interface RoutePreloadState {
  status: PreloadStatus;
  promise: Promise<void> | null;
}

class PreloadManager {
  private criticalRoutes: Map<string, RoutePreloadState> = new Map();
  private secondaryRoutes: Map<string, RoutePreloadState> = new Map();
  private isIdleCallbackRegistered = false;

  /**
   * Preload tất cả critical routes ngay lập tức
   * Gọi khi app khởi động (sau khi login)
   */
  preloadCriticalRoutes(): void {
    if (typeof window === 'undefined') return;

    CRITICAL_ROUTES.forEach((importFn, index) => {
      const routeName = this.getRouteName(importFn);
      if (!this.criticalRoutes.has(routeName)) {
        this.criticalRoutes.set(routeName, {
          status: 'idle',
          promise: null,
        });

        // Stagger preload để không block network
        setTimeout(() => {
          this.preloadRoute(routeName, importFn, this.criticalRoutes);
        }, index * 200); // Delay 200ms giữa mỗi route
      }
    });
  }

  /**
   * Preload secondary routes khi browser idle
   */
  preloadSecondaryRoutesOnIdle(): void {
    if (typeof window === 'undefined' || this.isIdleCallbackRegistered) return;

    // Sử dụng requestIdleCallback nếu có, fallback to setTimeout
    const idleCallback =
      'requestIdleCallback' in window
        ? window.requestIdleCallback.bind(window)
        : (cb: IdleRequestCallback) => setTimeout(cb, 1000);

    this.isIdleCallbackRegistered = true;

    idleCallback(
      () => {
        SECONDARY_ROUTES.forEach((importFn) => {
          const routeName = this.getRouteName(importFn);
          if (!this.secondaryRoutes.has(routeName)) {
            this.secondaryRoutes.set(routeName, {
              status: 'idle',
              promise: null,
            });
            this.preloadRoute(routeName, importFn, this.secondaryRoutes);
          }
        });
      },
      { timeout: 2000 },
    );
  }

  /**
   * Preload một route cụ thể khi user hover vào link
   * @param routePath - Route path (ví dụ: '/org-units')
   */
  preloadOnHover(routePath: string): void {
    const importFn = this.getImportFnFromPath(routePath);
    if (!importFn) return;

    const routeName = this.getRouteName(importFn);
    const routesMap = this.criticalRoutes.has(routeName)
      ? this.criticalRoutes
      : this.secondaryRoutes;

    if (!routesMap.has(routeName)) {
      routesMap.set(routeName, {
        status: 'idle',
        promise: null,
      });
    }

    this.preloadRoute(routeName, importFn, routesMap);
  }

  /**
   * Kiểm tra xem route đã được preload chưa
   */
  isPreloaded(routePath: string): boolean {
    const importFn = this.getImportFnFromPath(routePath);
    if (!importFn) return false;

    const routeName = this.getRouteName(importFn);
    const state =
      this.criticalRoutes.get(routeName) || this.secondaryRoutes.get(routeName);
    return state?.status === 'ready';
  }

  /**
   * Preload một route
   */
  private preloadRoute(
    routeName: string,
    importFn: () => Promise<unknown>,
    routesMap: Map<string, RoutePreloadState>,
  ): void {
    const state = routesMap.get(routeName);
    if (!state || state.status === 'loading' || state.status === 'ready') {
      return;
    }

    state.status = 'loading';
    state.promise = importFn()
      .then(() => {
        state.status = 'ready';
      })
      .catch((error) => {
        console.warn(`Failed to preload route: ${routeName}`, error);
        state.status = 'idle';
        state.promise = null;
      });
  }

  /**
   * Lấy route name từ import function
   */
  private getRouteName(importFn: () => Promise<unknown>): string {
    return (
      importFn.toString().match(/@\/modules\/([^/]+)\/pages/)?.[1] || 'unknown'
    );
  }

  /**
   * Lấy import function từ route path
   */
  private getImportFnFromPath(
    routePath: string,
  ): (() => Promise<unknown>) | null {
    const routeMap: Record<string, () => Promise<unknown>> = {
      '/org-units': () => import('@/modules/org-units/pages/OrgUnitsPage'),
      '/departments': () =>
        import('@/modules/departments/pages/DepartmentsPage'),
      '/employees': () => import('@/modules/employees/pages/EmployeesPage'),
      '/roles': () => import('@/modules/roles/pages/RolesPage'),
      '/positions': () => import('@/modules/positions/pages/PositionsPage'),
      '/org-chart': () => import('@/modules/org-charts/pages/OrgChartPage'),
      '/employee-status': () =>
        import('@/modules/employee-status/pages/EmployeeStatusPage'),
      '/employee-assignments': () =>
        import('@/modules/employee-assignments/pages/EmployeeAssignmentsPage'),
      '/user-role-scopes': () =>
        import('@/modules/users/pages/UserRoleScopesPage'),
      '/tasks': () => import('@/modules/tasks/pages/TasksPage'),
    };

    return routeMap[routePath] || null;
  }

  /**
   * Clear tất cả preloaded routes (khi logout)
   */
  clear(): void {
    this.criticalRoutes.clear();
    this.secondaryRoutes.clear();
    this.isIdleCallbackRegistered = false;
  }
}

// Export singleton instance
export const preloadManager = new PreloadManager();

/**
 * Hook để sử dụng preload manager
 */
export function usePreload() {
  return {
    preloadCriticalRoutes: () => preloadManager.preloadCriticalRoutes(),
    preloadSecondaryRoutesOnIdle: () =>
      preloadManager.preloadSecondaryRoutesOnIdle(),
    preloadOnHover: (routePath: string) =>
      preloadManager.preloadOnHover(routePath),
    isPreloaded: (routePath: string) => preloadManager.isPreloaded(routePath),
  };
}
