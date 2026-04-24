export type UserRole = 'user' | 'admin' | 'subscriptor';
export type AuthMethod = 'inner' | 'google' | 'admin-management';
export type UserStatus = 'active' | 'inactive';

export interface TokenPayload {
  id: string;
  role: UserRole;
}

export interface JWTClaims {
  data: TokenPayload;
  exp: number;
  iat?: number;
}

export interface GoogleUserData {
  username: string;
  email: string;
  photo: string;
  accessToken: string;
  displayName: string;
  googleId: string;
}

export interface GoogleAuthResult {
  userData: GoogleUserData;
  callback: string | null;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  method: AuthMethod;
  isVerified: boolean;
  googleId?: string;
  googlePic?: string | null;
  profilePic?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AccountResponse {
  id: string;
  username: string;
  email: string;
  isVerified: boolean;
  role: UserRole;
  profilePic: string | null;
}

export interface SessionStatus {
  loggedIn: boolean;
}

export interface RefreshSession {
  id: string;
  user_id: string;
  user_role: UserRole;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip: string | null;
}

export interface AppEntry {
  url: string;
  label: string;
  route: string;
  description: string;
  icon: string | null;
}

export interface MenuItem {
  label: string;
  submenu?: (AppEntry | SubMenuItem)[];
  href?: string | null;
  route?: string | null;
}

export interface SubMenuItem {
  label: string;
  description?: string;
  icon?: string | null;
  href?: string | null;
  route?: string | null;
}

declare global {
  namespace Express {
    interface User extends GoogleAuthResult {}
  }
}
