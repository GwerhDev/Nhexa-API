import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { authClientId, authClientSecret, apiUrl } from '../config';
import type { GoogleUserData, GoogleAuthResult } from '../types';

const GOOGLE_SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/plus.me',
];

export const loginGoogle = new GoogleStrategy(
  {
    clientID: authClientId,
    clientSecret: authClientSecret,
    callbackURL: `${apiUrl}/login-google/callback`,
    scope: GOOGLE_SCOPES,
    passReqToCallback: true,
  },
  (req, accessToken, _refreshToken, profile, done) => {
    process.nextTick(async () => {
      try {
        const userData: GoogleUserData = {
          username: profile.name?.givenName ?? profile.displayName,
          email: profile.emails?.[0]?.value ?? '',
          photo: profile.photos?.[0]?.value ?? '',
          accessToken,
          displayName: profile.displayName,
          googleId: profile.id,
        };

        const callback = (req.query.state as string) || null;
        const result: GoogleAuthResult = { userData, callback };

        return done(null, result);
      } catch (err) {
        return done(err as Error);
      }
    });
  }
);

export const signupGoogle = new GoogleStrategy(
  {
    clientID: authClientId,
    clientSecret: authClientSecret,
    callbackURL: `${apiUrl}/signup-google/callback`,
    scope: GOOGLE_SCOPES,
    passReqToCallback: true,
  },
  (req, accessToken, _refreshToken, profile, done) => {
    process.nextTick(async () => {
      try {
        const userData: GoogleUserData = {
          username: profile.name?.givenName ?? profile.displayName,
          email: profile.emails?.[0]?.value ?? '',
          photo: profile.photos?.[0]?.value ?? '',
          accessToken,
          displayName: profile.displayName,
          googleId: profile.id,
        };

        const callback = (req.query.state as string) || null;
        const result: GoogleAuthResult = { userData, callback };

        return done(null, result);
      } catch (err) {
        return done(err as Error);
      }
    });
  }
);
