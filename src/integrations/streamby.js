const { createStreamByRouter } = require("streamby-core");
const userSchema = require("../models/User");
const projectSchema = require("../models/Project");
const { decodeToken } = require("./jwt");
const { awsBucket, awsBucketRegion, awsAccessKey, awsSecretKey } = require("../config");

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
      projects: user.projects,
      profilePic: user.profilePic || user.googlePic
    };
  },
  projectProvider: {
    getById: async (projectId) => {
      const project = await projectSchema.findById(projectId);
      if (!project) throw new Error('Project not found');

      return {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        image: project.image,
        rootFolders: project.rootFolders || [],
        settings: {
          allowUpload: project.allowUpload,
          allowSharing: project.allowSharing
        }
      };
    },

    create: async (data) => {
      try {
        const newProject = await projectSchema.create({
          name: data?.name,
          image: data?.image || '',
          description: data?.description || '',
          rootFolders: [],
          allowUpload: true,
          allowSharing: false
        });

        return {
          id: newProject._id.toString(),
          name: newProject.name,
          image: newProject.image,
          description: newProject.description,
          rootFolders: newProject.rootFolders,
          settings: {
            allowUpload: newProject.allowUpload,
            allowSharing: newProject.allowSharing
          }
        };
      } catch (err) {
        console.error('Error creating project:', err);
        throw err;
      }
    },
    update: async (projectId, updates) => {
      const updated = await projectSchema.findByIdAndUpdate(
        projectId,
        updates,
        { new: true }
      );
    
      if (!updated) throw new Error('Project not found');
    
      return {
        id: updated._id.toString(),
        name: updated.name,
        description: updated.description,
        image: updated.image,
        rootFolders: updated.rootFolders || [],
        settings: {
          allowUpload: updated.allowUpload,
          allowSharing: updated.allowSharing
        }
      };
    }    
  }
});
