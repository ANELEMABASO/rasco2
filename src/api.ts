import type { AttemptResult, ServerClaim, ServerState } from './types.ts';
import { demoApi } from './demoApi.ts';
import { ApiError, getToken, setToken } from './session.ts';

export { ApiError, getToken, setToken };

/**
 * Two modes, chosen at build time:
 *
 *  LIVE  (VITE_API_BASE set, or `npm run dev` with the Python backend on :8000)
 *        Every call goes to the FastAPI gateway. If it is unreachable the UI says so;
 *        nothing is faked.
 *
 *  DEMO  (VITE_DEMO_MODE=true, or a production build with no VITE_API_BASE)
 *        Everything runs in the browser against a clearly labelled simulation.
 *        No XRPL transactions are made and the UI shows a banner saying so.
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '');
export const DEMO_MODE: boolean =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  (import.meta.env.VITE_DEMO_MODE !== 'false' && import.meta.env.PROD && !API_BASE);

const BASE = API_BASE ?? '/api';
function describe(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { reason?: string; message?: string };
    return d.reason || d.message || JSON.stringify(detail);
  }
  return 'Request failed';
}

const FAST = 20_000; // reads and small writes
const SLOW = 90_000; // anything that waits for the XRP Ledger to validate

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = FAST): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'AbortError';
    throw new ApiError(
      0,
      timedOut
        ? 'The backend took too long to answer. If it is on a free host it may be waking up; try again in a moment.'
        : 'Cannot reach the backend. Check that it is running and that VITE_API_BASE and CORS_ORIGINS are set correctly.'
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, describe(detail));
  }
  return (await res.json()) as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export interface Api {
  login(pin: string, name: string): Promise<void>;
  logout(): Promise<void>;
  getState(): Promise<ServerState>;
  getClaims(memberId?: string): Promise<ServerClaim[]>;
  setCaps(caps: { perPaymentCap?: number; monthlyCap?: number }): Promise<unknown>;
  addRecipient(address: string, label: string): Promise<unknown>;
  removeRecipient(address: string): Promise<unknown>;
  revokeAgent(): Promise<{ hash: string }>;
  reauthorizeAgent(): Promise<{ hash: string }>;
  attempt(body: { destination: string; amount: number; reason: string; skipPolicy?: boolean }): Promise<AttemptResult>;
  runAgentCycle(): Promise<{
    claims?: unknown[];
    obligations?: { id: string; status: string; reason: string }[];
    skipped?: string;
  }>;
  submitClaim(claim: {
    memberId: string;
    memberName: string;
    amount: number;
    recipient: string;
    category: string;
    reason: string;
  }): Promise<ServerClaim>;
}

const liveApi: Api = {
  async login(pin, name) {
    const res = await request<{ token: string }>('/auth/login', json('POST', { pin, name }));
    setToken(res.token);
  },
  async logout() {
    try {
      await request('/auth/logout', json('POST'));
    } catch {
      /* the session is dropped locally either way */
    } finally {
      setToken(null);
    }
  },
  getState: () => request<ServerState>('/state'),
  getClaims: (memberId) =>
    request<ServerClaim[]>(`/claims${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''}`),
  setCaps: (caps) => request('/mandate', json('PUT', caps)),
  addRecipient: (address, label) => request('/mandate/recipients', json('POST', { address, label })),
  removeRecipient: (address) => request(`/mandate/recipients/${encodeURIComponent(address)}`, json('DELETE')),
  revokeAgent: () => request<{ hash: string }>('/agent/revoke', json('POST'), SLOW),
  reauthorizeAgent: () => request<{ hash: string }>('/agent/reauthorize', json('POST'), SLOW),
  attempt: (body) => request<AttemptResult>('/agent/attempt', json('POST', body), SLOW),
  runAgentCycle: () => request('/agent/run', json('POST'), SLOW),
  submitClaim: (claim) => request<ServerClaim>('/claims', json('POST', claim), SLOW),
};

export const api: Api = DEMO_MODE ? demoApi : liveApi;
