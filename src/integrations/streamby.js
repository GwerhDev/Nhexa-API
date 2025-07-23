const { decodeToken } = require("./jwt");
const { createStreamByRouter } = require("streamby-core");
const { awsBucket, awsBucketRegion, awsAccessKey, awsSecretKey, mongodbString, supabaseString } = require("../config");
const { prisma } = require("./prisma");

const authProvider = async (req) => {
  const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')?.[1];
  const decoded = await decodeToken(userToken);
  const user = await prisma.users.findUnique({ where: { id: decoded.data.id } });

  const authObject = {
    role: user.role,
    userId: user.id,
    username: user.username,
    profilePic: user.profilePic || user.googlePic
  };
  return authObject;
};

module.exports = () => createStreamByRouter({
  authProvider,
  databases: [
    {
      id: 'mongo',
      type: 'nosql',
      connectionString: mongodbString,
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
