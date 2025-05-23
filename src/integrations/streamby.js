const { decodeToken } = require("./jwt");
const { createStreamByRouter } = require("streamby-core");
const { awsBucket, awsBucketRegion, awsAccessKey, awsSecretKey, mongodbString } = require("../config");
const userSchema = require("../models/User");

const authProvider = async (req) => {
  const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
  const decoded = await decodeToken(userToken);
  const user = await userSchema.findById(decoded.data._id);

  return {
    role: user.role,
    userId: user._id,
    username: user.username,
    profilePic: user.profilePic || user.googlePic
  };
};

module.exports = () => createStreamByRouter({
  authProvider,
  databases: [
    {
      dbType: 'mongo',
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
  ]
});
