export interface TokenPayload {
  sub: string;
  email: string;
}

export interface TokenService {
  sign(payload: TokenPayload): string;
  /** Throws `UnauthorizedError` when the token is absent, expired or tampered with. */
  verify(token: string): TokenPayload;
}
