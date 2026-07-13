import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const getStoredToken = (key: 'ib_access_token' | 'ib_refresh_token'): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(key);
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Custom type to avoid TS errors on _retry flag
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// ── Request interceptor: tự thêm Bearer token ──
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken('ib_access_token');
  if (token) {
    if (config.headers) {
      if (typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${token}`);
      } else {
        config.headers = {
          ...(config.headers as any),
          Authorization: `Bearer ${token}`,
        } as any;
      }
    } else {
      config.headers = {
        Authorization: `Bearer ${token}`,
      } as any;
    }
  }
  return config;
});

// ── Response interceptor: tự refresh khi 401 ──
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    const refreshToken = localStorage.getItem('ib_refresh_token');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Do not attempt refresh if we are already calling refresh or if there is no refresh token.
      if (!refreshToken || originalRequest.url?.endsWith('/auth/refresh') || originalRequest.url?.endsWith('/auth/login')) {
        localStorage.removeItem('ib_access_token');
        localStorage.removeItem('ib_refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            if (typeof (originalRequest.headers as any).set === 'function') {
              (originalRequest.headers as any).set('Authorization', `Bearer ${token}`);
            } else {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newAccessToken = data.data.accessToken;

        localStorage.setItem('ib_access_token', newAccessToken);
        localStorage.setItem('ib_refresh_token', data.data.refreshToken);

        failedQueue.forEach(({ resolve }) => resolve(newAccessToken));
        failedQueue = [];

        if (originalRequest.headers) {
          if (typeof (originalRequest.headers as any).set === 'function') {
            (originalRequest.headers as any).set('Authorization', `Bearer ${newAccessToken}`);
          } else {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
        }
        return apiClient(originalRequest);
      } catch (_error) {
        failedQueue.forEach(({ reject }) => reject(_error));
        failedQueue = [];
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(_error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
