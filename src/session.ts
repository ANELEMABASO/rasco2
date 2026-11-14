/** Treasurer session token (issued by the backend; lives only in this browser tab). */
const TOKEN_KEY = 'stokvel_treasurer_token';

export const getToken = (): string | null => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null): void => {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
