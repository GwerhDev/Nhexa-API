const { decodeToken } = require("./jwt");
const { createStreamByRouter } = require("streamby-core");
const { awsBucket, awsBucketRegion, awsAccessKey, awsSecretKey, mongodbString, supabaseString } = require("../config");
const { prisma } = require("./prisma");

const authProvider = async (req) => {
  try {
    const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')?.[1];
    if (!userToken) return null;

    const decoded = await decodeToken(userToken);
    if (!decoded?.data?.id) return null;

    const user = await prisma.users.findUnique({ where: { id: decoded.data.id } });
    if (!user) return null;

    const authObject = {
      role: user.role,
      userId: user.id,
      username: user.username,
      profilePic: user.profilePic || user.googlePic
    };
    return authObject;
  } catch (error) {
    console.error('Error in streamby auth provider:', error);
    return null;
  }
};

module.exports = () => createStreamByRouter({
  authProvider,
  databases: [
    {
      id: 'mongo',
      type: 'nosql',
      connectionString: mongodbString,
    }, {
      id: 'supabase',
      type: 'sql',
      main: true,
      connectionString: supabaseString + "?pgbouncer=true",
    }
  ],
  storageProviders: [
    {
      type: 's3',
      config: {
        bucket: awsBucket,
        region: awsBucketRegion,
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
      }
    }
  ],
});
