import axios, { AxiosHeaders, type AxiosError, type AxiosRequestConfig } from 'axios';
import { authStore } from '@/store/auth';
import type { AuthUser } from '@/store/auth';
import type { ApiResponse } from '@/types/api';

const STORAGE_KEY = 'tactical-education-auth';

type PersistedAuth = {
  state?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

const getPersistedTokens = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedAuth;
    return {
      accessToken: parsed.state?.accessToken,
      refreshToken: parsed.state?.refreshToken,
    };
  } catch {
    return {};
  }
};

const resolveApiBase = () => {
  // Dev + Vite proxy: API lewat origin yang sama (PC/HP cukup buka port 5173).
  if (import.meta.env.DEV) {
    return '/api/v1';
  }
  // Production: pakai VITE_API_URL (harus HTTPS di site HTTPS, hindari mixed content).
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      // Jangan pakai http://host:5000 di halaman HTTPS (browser akan block).
      if (window.location.protocol === 'https:') {
        return `${window.location.origin}/api/v1`;
      }
      return `http://${host}:5000/api/v1`;
    }
  }
  return 'http://localhost:5000/api/v1';
};

const resolveApiOrigin = () => {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin;
  }
  try {
    return new URL(resolveApiBase()).origin;
  } catch {
    return '';
  }
};

const apiBase = resolveApiBase();
export const API_BASE_URL = apiBase;
export const API_BASE_ORIGIN = resolveApiOrigin();

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
});

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken ?? getPersistedTokens().accessToken;
  if (token) {
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      const headers = new AxiosHeaders(config.headers);
      headers.set('Authorization', `Bearer ${token}`);
      config.headers = headers;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = authStore.getState().refreshToken ?? getPersistedTokens().refreshToken;
      if (!refreshToken) {
        authStore.logout();
        return Promise.reject(error);
      }

      try {
        originalRequest._retry = true;
        const { data } = await refreshClient.post<ApiResponse<{ accessToken: string; refreshToken: string; user: AuthUser }>>(
          '/auth/refresh',
          { refreshToken },
        );
        authStore.setSession(data.data);
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${data.data.accessToken}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        authStore.logout();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export async function apiGet<T>(url: string, config?: AxiosRequestConfig) {
  const { data } = await api.get<ApiResponse<T>>(url, config);
  return data.data;
}

export async function apiPost<T, B = Record<string, unknown>>(url: string, body?: B, config?: AxiosRequestConfig) {
  const { data } = await api.post<ApiResponse<T>>(url, body, config);
  return data.data;
}

export async function apiPatch<T, B = Record<string, unknown>>(url: string, body?: B, config?: AxiosRequestConfig) {
  const { data } = await api.patch<ApiResponse<T>>(url, body, config);
  return data.data;
}

export async function apiPut<T, B = Record<string, unknown>>(url: string, body?: B, config?: AxiosRequestConfig) {
  const { data } = await api.put<ApiResponse<T>>(url, body, config);
  return data.data;
}

export async function apiDelete(url: string, config?: AxiosRequestConfig) {
  await api.delete(url, config);
}

/** Upload FormData — jangan set Content-Type manual agar boundary multipart benar. */
export async function apiPostForm<T>(url: string, formData: FormData, config?: AxiosRequestConfig) {
  const { data } = await api.post<ApiResponse<T>>(url, formData, config);
  return data.data;
}

export async function apiPutForm<T>(url: string, formData: FormData, config?: AxiosRequestConfig) {
  const { data } = await api.put<ApiResponse<T>>(url, formData, config);
  return data.data;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } }).response;
    if (response?.data?.message) {
      const fieldErrors = response.data.details?.fieldErrors;
      const firstFieldError = fieldErrors ? Object.entries(fieldErrors)[0] : undefined;
      if (firstFieldError?.[1]?.[0]) {
        return `${response.data.message} (${firstFieldError[0]}: ${firstFieldError[1][0]})`;
      }
      return response.data.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
