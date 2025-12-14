require("dotenv").config();
const { production } = require("../misc/consts");

module.exports = {
  environment: process.env.NODE_ENV,
  port: process.env.PORT,
  encryptionKey: process.env.STREAMBY_ENCRYPTION_KEY,
  apiUrl: process.env.NODE_ENV === production ? process.env.API_URL_PROD : process.env.API_URL,
  clientAccountsUrl: process.env.NODE_ENV === production ? process.env.CLIENT_ACCOUNTS_URL_PROD : process.env.CLIENT_ACCOUNTS_URL,

  adminEmailList: process.env.ADMIN_EMAIL_LIST,

  mongodbString: process.env.MONGODB_STRING,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  supabaseString: process.env.SUPABASE_STRING,

  privateSecret: process.env.PRIVATE_SECRET,
  defaultPassword: process.env.DEFAULT_PASSWORD,
  defaultUsername: process.env.DEFAULT_USERNAME,

  awsSecret: process.env.AWS_SECRET,
  awsBucket: process.env.AWS_BUCKET,
  awsAccessKey: process.env.AWS_ACCESS_KEY,
  awsSecretKey: process.env.AWS_SECRET_KEY,
  awsBucketRegion: process.env.AWS_BUCKET_REGION,
  
  authClientId: process.env.AUTH_CLIENT_ID,
  authClientSecret: process.env.AUTH_CLIENT_SECRET,
  allowedOrigins: process.env.NODE_ENV === production ? process.env.ALLOWED_ORIGINS_PROD : process.env.ALLOWED_ORIGINS,
}