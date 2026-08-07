import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { api } from "@/shared/api/axios";
import {
  isErrorEnvelope,
  ApiEnvelopeError,
  type ApiMeta,
  type ApiResponse,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "@/shared/types/api-response";

function isAxiosError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "isAxiosError" in error &&
    (error as Record<string, unknown>).isAxiosError === true
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function warnUnexpectedShape(url: string, body: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(
      `[http] Response không đúng envelope ApiResponse<T> tại "${url}". Nhận:`,
      body,
    );
  }
}

/**
 * Unwrap a success envelope without dropping response metadata. Keeping meta is
 * critical for stock-changing WMS actions because BE writes request_id under
 * meta.request_id, while the business payload lives under data.
 */
function unwrapWithMeta<T>(
  res: AxiosResponse<ApiResponse<T>>,
  url: string,
): { data: T; meta: ApiMeta } {
  const body = res.data;

  if (
    res.status === 204 ||
    body === undefined ||
    body === null ||
    (body as unknown) === ""
  ) {
    return { data: undefined as T, meta: {} };
  }

  if (!isPlainObject(body)) {
    warnUnexpectedShape(url, body);
    return { data: body as unknown as T, meta: {} };
  }

  if (isErrorEnvelope(body)) {
    throw new ApiEnvelopeError(body as ApiErrorResponse);
  }

  if (!("data" in body)) {
    warnUnexpectedShape(url, body);
    return { data: body as unknown as T, meta: {} };
  }

  const success = body as ApiSuccessResponse<T>;
  return { data: success.data, meta: success.meta ?? {} };
}

function unwrap<T>(res: AxiosResponse<ApiResponse<T>>, url: string): T {
  return unwrapWithMeta(res, url).data;
}

/**
 * Blob downloads can surface JSON error envelopes as Blob objects. Parse any
 * Blob best-effort instead of relying on its Content-Type, because reverse
 * proxies may return application/octet-stream even for an API error body.
 */
async function parseBlobError(error: unknown): Promise<unknown> {
  if (!isAxiosError(error)) return error;
  const axiosErr = error as Record<string, unknown>;
  const response = axiosErr.response as Record<string, unknown> | undefined;
  const data = response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      (axiosErr.response as Record<string, unknown>).data = JSON.parse(text);
    } catch {
      // Keep the original Blob when it is not JSON.
    }
  }
  return error;
}

export const http = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await api.get<ApiResponse<T>>(url, config), url);
  },

  async getPage<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<{ data: T; meta: ApiMeta }> {
    return unwrapWithMeta(await api.get<ApiResponse<T>>(url, config), url);
  },

  async post<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return unwrap(await api.post<ApiResponse<T>>(url, body, config), url);
  },

  /**
   * Use for business actions whose audit/QA evidence requires meta.request_id.
   * Normal callers should keep using post() so metadata is not propagated
   * unnecessarily through application state.
   */
  async postWithMeta<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<{ data: T; meta: ApiMeta }> {
    return unwrapWithMeta(
      await api.post<ApiResponse<T>>(url, body, config),
      url,
    );
  },

  async put<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return unwrap(await api.put<ApiResponse<T>>(url, body, config), url);
  },

  async patch<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return unwrap(await api.patch<ApiResponse<T>>(url, body, config), url);
  },

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await api.delete<ApiResponse<T>>(url, config), url);
  },

  async downloadBlob(url: string, config?: AxiosRequestConfig): Promise<Blob> {
    try {
      const res = await api.get<Blob>(url, {
        ...config,
        responseType: "blob",
      });
      return res.data;
    } catch (error) {
      throw await parseBlobError(error);
    }
  },
};
