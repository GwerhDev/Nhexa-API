const mongoose = require("mongoose");
const { decodeToken } = require("./jwt");
const { createStreamByRouter, createMongoProjectProvider, initProjectModel, createS3Adapter } = require("streamby-core");
const { awsBucket, awsBucketRegion, awsAccessKey, awsSecretKey } = require("../config");
const userSchema = require("../models/User");

const ProjectModel = initProjectModel(mongoose.connection);

const adapter = createS3Adapter({
  bucket: awsBucket,
  region: awsBucketRegion,
  accessKeyId: awsAccessKey,
  secretAccessKey: awsSecretKey,
});

const projectProvider = createMongoProjectProvider(ProjectModel, adapter);

module.exports = () => createStreamByRouter({
  storageProvider: {
    type: 's3',
    config: {
      bucket: awsBucket,
      region: awsBucketRegion,
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretKey,
    }
  },
  authProvider: async (req) => {
    const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
    const decoded = await decodeToken(userToken);
    const user = await userSchema.findById(decoded.data._id);

    return {
      role: user.role,
      userId: user._id,
      username: user.username,
      profilePic: user.profilePic || user.googlePic
    };
  },
  projectProvider
});
