export type Role = "user" | "admin" | "vip";
export type SessionContext = {
  userId: number;
  email?: string | null;
  displayName?: string | null;
  isAdmin?: boolean;
  roles?: Role[];
  uaHash?: string;
  issuedAt?: number;
  expiresAt?: number;
  csrfSecret?: string;
};
export type ClientSessionData = {
  userId?: string;
  email?: string | null;
  displayName?: string | null;
  isAdmin?: boolean;
  roles?: Role[];
  expiresAt?: number;
  uaHash?: string;
};
