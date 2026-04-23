import passport from 'passport';
import { loginGoogle, signupGoogle } from './google';
import type { GoogleAuthResult } from '../types';

passport.use('login-google', loginGoogle);
passport.use('signup-google', signupGoogle);

passport.serializeUser<GoogleAuthResult>((user, done) => {
  done(null, user);
});

passport.deserializeUser<GoogleAuthResult>((user, done) => {
  done(null, user);
});
