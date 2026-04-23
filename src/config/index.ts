import { production } from '../misc/consts';

export const environment = process.env.NODE_ENV;
export const port = process.env.PORT;
export const encryptionKey = process.env.STREAMBY_ENCRYPTION_KEY as string;

export const apiUrl = (
  process.env.NODE_ENV === production ? process.env.API_URL_PROD : process.env.API_URL
) as string;

export const clientAccountsUrl = (
  process.env.NODE_ENV === production
    ? process.env.CLIENT_ACCOUNTS_URL_PROD
    : process.env.CLIENT_ACCOUNTS_URL
) as string;

export const adminEmailList = process.env.ADMIN_EMAIL_LIST;

export const mongodbString = process.env.MONGODB_STRING as string;
export const supabaseUrl = process.env.SUPABASE_URL as string;
export const supabaseKey = process.env.SUPABASE_KEY as string;
export const supabaseString = process.env.SUPABASE_STRING as string;

export const privateSecret = process.env.PRIVATE_SECRET as string;
export const defaultPassword = process.env.DEFAULT_PASSWORD as string;
export const defaultUsername = process.env.DEFAULT_USERNAME as string;

export const awsSecret = process.env.AWS_SECRET;
export const awsBucket = process.env.AWS_BUCKET as string;
export const awsAccessKey = process.env.AWS_ACCESS_KEY as string;
export const awsSecretKey = process.env.AWS_SECRET_KEY as string;
export const awsBucketRegion = process.env.AWS_BUCKET_REGION as string;

export const authClientId = process.env.AUTH_CLIENT_ID as string;
export const authClientSecret = process.env.AUTH_CLIENT_SECRET as string;

export const allowedOrigins = (
  process.env.NODE_ENV === production
    ? process.env.ALLOWED_ORIGINS_PROD
    : process.env.ALLOWED_ORIGINS
) as string;
