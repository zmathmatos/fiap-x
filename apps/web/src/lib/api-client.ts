import type { AuthResult, AuthUser, VideoDetail, VideoPage } from './types';

export const API_BASE = import.meta.env?.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  onUnauthorized?: () => void;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 401) {
    // Let the caller drop the session before the error propagates to the UI.
    options.onUnauthorized?.();
  }

  const raw = await response.text();
  const parsed: unknown = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const error = (parsed as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(
      error?.message ?? `Erro inesperado (${response.status})`,
      response.status,
      error?.code,
    );
  }

  return parsed as T;
}

export interface AuthedOptions {
  token: string;
  onUnauthorized?: () => void;
  signal?: AbortSignal;
}

export interface ListVideosOptions extends AuthedOptions {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const apiClient = {
  register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    return request<AuthResult>('/auth/register', { method: 'POST', body: input });
  },

  login(input: { email: string; password: string }): Promise<AuthResult> {
    return request<AuthResult>('/auth/login', { method: 'POST', body: input });
  },

  me(options: AuthedOptions): Promise<AuthUser> {
    return request<AuthUser>('/me', options);
  },

  listVideos(options: ListVideosOptions): Promise<VideoPage> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.search) params.set('search', options.search);
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));

    const query = params.toString();
    return request<VideoPage>(`/videos${query ? `?${query}` : ''}`, options);
  },

  getVideo(videoId: string, options: AuthedOptions): Promise<VideoDetail> {
    return request<VideoDetail>(`/videos/${videoId}`, options);
  },

  downloadUrl(videoId: string): string {
    return `${API_BASE}/videos/${videoId}/download`;
  },
};
