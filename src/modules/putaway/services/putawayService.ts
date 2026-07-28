import { http } from '@/shared/api/http';
import type { PutawayTask, PutawayHistory } from '../types';
import { API_ENDPOINTS } from '@/shared/api/endpoints';

export async function fetchPutawayTasks(): Promise<PutawayTask[]> {
  return http.get<PutawayTask[]>(API_ENDPOINTS.PUTAWAY_TASKS);
}

export async function fetchPutawayHistory(): Promise<PutawayHistory[]> {
  return http.get<PutawayHistory[]>(API_ENDPOINTS.PUTAWAY_HISTORY);
}
