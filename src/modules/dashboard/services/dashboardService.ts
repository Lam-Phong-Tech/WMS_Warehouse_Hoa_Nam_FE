import { http } from '@/shared/api/http';
import type { DashboardKPI, RecentDocument, ReconcileHealth, AlertItem } from '../types';
import { API_ENDPOINTS } from '@/shared/api/endpoints';

export async function fetchDashboardKPI(): Promise<DashboardKPI> {
  return http.get<DashboardKPI>(API_ENDPOINTS.DASHBOARD_KPI);
}

export async function fetchRecentDocuments(): Promise<RecentDocument[]> {
  return http.get<RecentDocument[]>(API_ENDPOINTS.DASHBOARD_RECENT_DOCUMENTS);
}

export async function fetchReconcileHealth(): Promise<ReconcileHealth> {
  return http.get<ReconcileHealth>(API_ENDPOINTS.DASHBOARD_RECONCILE_HEALTH);
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  return http.get<AlertItem[]>(API_ENDPOINTS.DASHBOARD_ALERTS);
}
