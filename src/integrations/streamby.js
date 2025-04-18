const { createStreamByRouter } = require("streamby-core");
const userSchema = require("../models/User");
const projectSchema = require("../models/Project");
const { decodeToken } = require("./jwt");

module.exports = () => createStreamByRouter({
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
    const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
    const decoded = await decodeToken(userToken);
    const user = await userSchema.findById(decoded.data._id);
    return {
      role: user.role,
      userId: user._id,
      username: user.username,
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
});