const passport = require('passport');
const { loginGoogle, signupGoogle } = require('./google');

passport.use('login-google', loginGoogle);
passport.use('signup-google', signupGoogle);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
