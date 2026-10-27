export type UserRole = 'user' | 'admin';
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

export interface MfaClaims {
  mfa: true;
  sub: string;
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
  password?: string | null;
  role: UserRole;
  method: AuthMethod;
  isVerified: boolean;
  googleId?: string;
  googlePic?: string | null;
  profilePic?: string | null;
  created_at?: string;
  updated_at?: string;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  countryId?: string | null;
  phone?: string | null;
  phoneCode?: string | null;
  passwordSetAt?: string | null;
  twoFactorSecret?: string | null;
  twoFactorEnabled?: boolean;
  backupCodes?: string[] | null;
}

export interface AccountResponse {
  id: string;
  username: string;
  email: string;
  isVerified: boolean;
  role: UserRole;
  profilePic: string | null;
}

export interface UserDetail {
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  countryId: string | null;
  phone: string | null;
  phoneCode: string | null;
  passwordSetAt: string | null;
}

export interface DeviceSession {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
  ip: string | null;
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

// ── OAuth 2 (Nhexa as the authorization server; see integrations/oauthServer) ──

export type OAuthScope = 'profile' | 'email' | 'streamby:read' | 'streamby:write';
export type OAuthClientType = 'public' | 'confidential';

export interface OAuthClient {
  client_id: string;
  client_secret_hash: string | null;
  type: OAuthClientType;
  name: string;
  logo_uri: string | null;
  client_uri: string | null;
  redirect_uris: string[];
  scopes: OAuthScope[];
  // 'manual': registered by Nhexa; 'dynamic': by itself (RFC 7591); 'metadata': its client_id
  // is the URL of its metadata document (Client ID Metadata Documents), never stored.
  registration: 'manual' | 'dynamic' | 'metadata';
}

export interface OAuthCode {
  code_hash: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scopes: OAuthScope[];
  resource: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  expires_at: string;
  used_at: string | null;
}

export interface OAuthRefreshToken {
  token_hash: string;
  family_id: string;
  client_id: string;
  user_id: string;
  scopes: OAuthScope[];
  resource: string;
  expires_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
}

export interface OAuthConsent {
  user_id: string;
  client_id: string;
  scopes: OAuthScope[];
  // The app as the user saw it when they approved it.
  client_name?: string | null;
  client_logo_uri?: string | null;
  // Set by the store: when the user last approved it, and when the app last used it.
  updated_at?: string;
  last_used_at?: string | null;
}

/** An app of the Nhexa environment, as its catalog lists it. */
export interface NhexaApp { label: string; url: string; icon?: string; color?: string; description?: string; route?: string }
export interface NhexaAppCategory { id: string; name: string; apps: NhexaApp[] }

/** An app the user connected, as accounts lists it. */
export interface ConnectedApp {
  clientId: string;
  name: string;
  logoUri: string | null;
  // Registered by Nhexa (not by itself, nor known only by its metadata URL).
  verified: boolean;
  scopes: OAuthScope[];
  authorizedAt: string | null;
  lastUsedAt: string | null;
}

/** What an authorization request asks for, once checked. */
export interface OAuthAuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  scopes: OAuthScope[];
  state: string | null;
  resource: string;
  codeChallenge: string;
}

/** An access token's claims (RS256, see integrations/oauthKeys). */
export interface OAuthAccessClaims {
  iss: string;
  sub: string;
  aud: string;
  client_id: string;
  scope: string;
  jti: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface User extends GoogleAuthResult {}
  }
}
