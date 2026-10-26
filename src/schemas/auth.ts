import { z } from 'zod';

export const LoginInnerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SignupInnerSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

export const AccountUpdateSchema = z
  .object({
    username: z.string().min(1).max(50).optional(),
    password: z.string().min(8).optional(),
    profilePic: z.string().url().nullable().optional(),
  })
  .strict();

export type LoginInnerInput = z.infer<typeof LoginInnerSchema>;
export type SignupInnerInput = z.infer<typeof SignupInnerSchema>;
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>;

// ── OAuth 2 ──

// What accounts.nhexa.cl sends with the user's answer: the authorization request, as it came,
// and whether they approved it.
export const OAuthDecisionSchema = z.object({
  request: z.record(z.string(), z.string()),
  approve: z.boolean(),
});

// The token, revocation and registration requests are checked by the OAuth server itself,
// which answers with OAuth's own errors (RFC 6749 §5.2, RFC 7591 §3.2.2).
export const OAuthTokenSchema = z.object({}).passthrough();
export const OAuthRevokeSchema = z.object({}).passthrough();
export const OAuthRegisterSchema = z.object({}).passthrough();
