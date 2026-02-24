import { apiFetch } from './client';
import { AuthResponse, LoginBody, RegisterBody } from '@streamtime/shared';

export function getMe() {
  return apiFetch<AuthResponse>('/api/auth/me');
}

export function login(body: LoginBody) {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function register(body: RegisterBody) {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function logout() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}
