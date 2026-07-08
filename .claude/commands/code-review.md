---
description: Full audit of Nhexa-API — controllers, routes, middleware, integrations, schemas, and types. Checks layer violations, naming conventions, Zod validation, auth guards, error handling, security, and test coverage. Produces a prioritized remediation plan.
---

You are the lead reviewer for Nhexa-API. Your job is to audit code against the project's architecture conventions and produce a prioritized remediation plan.

If `$ARGUMENTS` is provided, review that specific file or directory.
If no argument is given, ask the user what scope to review (single file, directory, or full project).

---

## Architecture

Nhexa-API is a Node.js/Express authentication and user management backend:

```
src/
  controllers/     Express Routers by resource — each file is a self-contained router
    user/          Sub-controllers split by action (detail.ts, password.ts, twoFactor.ts)
  routes/          Single aggregator router (index.ts)
  middleware/      auth.ts (JWT guard), validate.ts (Zod middleware)
  integrations/    External client initialization — one file per service
  schemas/         Zod validation schemas
  types/           Centralized TypeScript interfaces
  messages/        Centralized response string constants
  misc/            Static lists, constants, tenant data
```

**Layer rules:**
- Controllers handle HTTP routing only — no business logic beyond reading req, calling integrations, and sending res
- Integrations initialize clients once and export them — not re-instantiated per request
- Schemas (Zod) define the contract for all user input — no ad-hoc inline validation in controllers
- Messages centralize all response strings — no hardcoded strings in controllers
- Types centralize all interfaces — no inline interface declarations in controllers

---

## What to check

### A. Layer violations

- **Business logic in controllers:** flag any controller with complex data transformation, loops, or conditionals beyond a guard clause — extract to a helper or integration.
- **Re-instantiated clients:** flag any `new SomeClient()` or `createClient()` calls inside controller handlers — clients must be initialized in `integrations/` and imported.
- **Inline Zod schemas in controllers:** any `z.object({...})` defined inside a controller file — must be in `schemas/`.
- **Hardcoded response strings in controllers:** any string literal used as an API response message — must reference `messages/`.

### B. Naming conventions

| Context | Convention | Example |
|---|---|---|
| Controller files (top-level) | `kebab-case.ts` | `login-inner.ts`, `signup-google.ts` |
| Controller files (user/ subdir) | `camelCase.ts` | `twoFactor.ts`, `overview.ts` |
| Integration files | `camelCase.ts` | `jwt.ts`, `supabase.ts`, `totp.ts` |
| Zod schemas | `PascalCase` + `Schema` suffix | `AccountUpdateSchema` |
| TypeScript interfaces | `PascalCase` | `UserRecord`, `TokenPayload` |
| Union/literal types | `PascalCase` | `UserRole`, `AuthMethod` |
| Message keys | nested dot-notation object | `message.user.unauthorized` |

Flag any deviation.

### C. Auth and validation

- Every non-public route must apply the `auth` middleware from `middleware/auth.ts` — flag any route missing it that handles user data.
- Every route that accepts a request body must apply `validate(Schema)` from `middleware/validate.ts` — flag missing validation.
- Flag any manual JWT decode/verify outside of `integrations/jwt.ts`.
- Flag any password comparison not using `bcrypt.compare()`.

### D. Type safety

- Flag any `any` type in controller parameters, integration functions, or interface fields.
- Flag missing return type annotations on exported functions.
- Flag non-null assertions (`!`) without a preceding existence check.
- Flag untyped `req.body` access without prior Zod validation (i.e., `req.body.field` before `validate()` runs).

### E. Error handling

- Every async handler must be wrapped in try/catch or use an async wrapper that calls `next(err)`.
- Flag missing `next(err)` in catch blocks — unhandled promise rejections crash the server.
- Flag responses that send 200 on error conditions.
- Flag catch blocks that only `console.log` without re-throwing or sending an error response.

### F. Security

- Flag any JWT secret or OAuth credential hardcoded in source — must come from environment variables.
- Flag any route that exposes sensitive user data (hashed passwords, tokens, 2FA secrets) in responses.
- Flag TOTP/2FA logic outside of `integrations/totp.ts`.
- Flag any session cookie set without `httpOnly: true` and `secure: true` in production config.
- Flag missing rate limiting on auth endpoints (login, signup, password reset).

### G. Tests

No tests currently exist. Report what needs to be created:

- **High:** Auth middleware (JWT validation, session checks), login/signup flows, 2FA logic
- **Medium:** User update handlers, password change flow, Google OAuth callback
- **Low:** Static list controllers (app-list, menu-list), message formatting

Suggest framework: Vitest + Supertest for integration tests.

---

## Output format

For each file reviewed:

```
### src/controllers/login-inner.ts

Layer
✓ Delegates to integrations correctly
⚠ Lines 34–55: password hashing logic inline — move to integrations/bcrypt helper

Naming
✓ kebab-case filename correct

Auth & Validation
✓ validate(LoginSchema) applied
⚠ Line 8: manual JWT decode — use integrations/jwt.ts verify()

Type safety
⚠ Line 12: req.body typed as any — add type from schemas/auth.ts

Error handling
⚠ Line 67: catch block sends no response — add res.status(500).json(...)

Security
⚠ Line 23: JWT_SECRET hardcoded as fallback string — remove fallback

Tests
⚠ No test for login flow — HIGH priority (auth-critical)
```

---

## Remediation plan

```
## Remediation Plan

### P1 — Critical (security)
- [ ] Remove hardcoded secrets/fallbacks (list files + lines)
- [ ] Add httpOnly + secure flags to session cookies (list)
- [ ] Add rate limiting to auth endpoints (list)

### P2 — Quick wins
- [ ] Add missing validate() middleware to routes (list)
- [ ] Add missing auth middleware to protected routes (list)
- [ ] Fix catch blocks missing response or next(err) (list)
- [ ] Move inline Zod schemas to schemas/ (list)
- [ ] Move hardcoded response strings to messages/ (list)

### P3 — Architecture
- [ ] Extract business logic from controllers to helpers (list)
- [ ] Move re-instantiated clients to integrations/ (list)

### P4 — Test coverage
- [ ] Set up Vitest + Supertest
- [ ] Write tests for High-priority flows (list)
- [ ] Write tests for Medium-priority handlers (list)
```

Show counts: total findings, by severity (P1/P2/P3/P4), by category.
