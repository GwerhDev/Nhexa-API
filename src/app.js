const express = require("express");
const server = express();
const routes = require("./routes");

const morgan = require("morgan");
const session = require("express-session");

const passport = require("passport");
const bodyParser = require("body-parser");
const { privateSecret, allwedOrigins } = require("./config");
const cookieParser = require('cookie-parser');
const { createStreamByRouter } = require("streamby-core");
const { decodeToken } = require("./integrations/jwt");
const userSchema = require("./models/User");
const projectSchema = require("./models/Project");

server.use(bodyParser.json({ limit: '100mb' }));
server.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
server.use(cookieParser());
server.use(morgan('dev'));

server.use((req, res, next) => {
  console.log('request from:', req.headers.origin);
  console.log('method:', req.method);
  console.log('route:', req.url);

  const origin = req.headers.origin;

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

server.use('/streamby', createStreamByRouter({
  storageProvider: {
    type: 's3',
    config: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_KEY,
      secretAccessKey: process.env.S3_SECRET
    }
  },
  authProvider: async (req) => {
    const token = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
    const decoded = await decodeToken(token);
    const user = await userSchema.findById(decoded.data._id);
    return {
      userId: user._id,
      role: user.role,
      projects: user.projects,
      profilePic: user.profilePic || user.googlePic
    };
  },
  projectProvider: async (projectId) => {
    const project = await projectSchema.findById(projectId);
    if (!project) throw new Error('Project not found');

    return {
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      rootFolders: project.rootFolders || [],
      settings: {
        allowUpload: project.allowUpload,
        allowSharing: project.allowSharing
      }
    };
  }
}));

server.use(session({
  secret: privateSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'None',
    secure: true,
    domain: '.nhexa.cl'
  }
}));
server.use(passport.session());

server.use(bodyParser.json());
server.use(passport.initialize());
server.use('/', routes);

module.exports = server;
