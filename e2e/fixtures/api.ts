import { e2eEnv } from './env';

export const API_PREFIX = '/api/v1';

export function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_PREFIX}${normalized}`;
}

export function apiUrl(path: string): string {
  return `${e2eEnv.apiUrl}${apiPath(path)}`;
}
