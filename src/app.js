const express = require("express");
const server = express();
const routes = require("./routes");

const morgan = require("morgan");
const session = require("express-session");

const passport = require("passport");
const bodyParser = require("body-parser");
const { privateSecret, allwedOrigins } = require("./config");
const cookieParser = require('cookie-parser');

server.use(bodyParser.json({ limit: '100mb' }));
server.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
server.use(cookieParser());
server.use(morgan('dev'));

server.use((req, res, next) => {
  console.log('request from:', req.headers.origin);
  console.log('method:', req.method);
  console.log('route:', req.url);

  const origin = req.headers.origin;

  console.log(allwedOrigins)

  if (allwedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  };

  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

server.use(session({
  secret: privateSecret,
  resave: false,
  saveUninitialized: false
}));

server.use(passport.initialize());
server.use(bodyParser.json());
server.use(passport.session());
server.use('/', routes);

module.exports = server;
