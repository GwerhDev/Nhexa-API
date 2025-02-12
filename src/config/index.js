const { production } = require("../misc/consts");

module.exports = {
  environment: process.env.NODE_ENV,
  port: process.env.PORT,
  apiUrl: process.env.NODE_ENV === production ? process.env.API_URL_PROD : process.env.API_URL,
  clientUrl: process.env.NODE_ENV === production ? process.env.CLIENT_URL_PROD : process.env.CLIENT_URL,

  adminEmailList: process.env.ADMIN_EMAIL_LIST,

  privateSecret: process.env.PRIVATE_SECRET,
  defaultPassword: process.env.DEFAULT_PASSWORD,
  defaultUsername: process.env.DEFAULT_USERNAME,

  idVisorFolder: process.env.VISOR_FOLDER,
  idSliderFolder: process.env.SLIDER_FOLDER,
  
  mediaClientId: process.env.MEDIA_CLIENT_ID,
  mediaClientSecret: process.env.MEDIA_CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN,
  accessToken: process.env.ACCESS_TOKEN,
  redirectUri: process.env.REDIRECT_URI,
  
  authClientId: process.env.AUTH_CLIENT_ID,
  authClientSecret: process.env.AUTH_CLIENT_SECRET,
  
  sendgridApi: process.env.SENDGRID_API,
  sendgridSecret: process.env.SENDGRID_SECRET,
  
  aliasTest: process.env.ALIAS_TEST,
  emailTest: process.env.EMAIL_TEST, 
  passwordTest: process.env.PASSWORD_TEST, 
  
  postgreString: process.env.NODE_ENV === production ? process.env.POSTGRES_STRING_PROD : process.env.POSTGRES_STRING,
}