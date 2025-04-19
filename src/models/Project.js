const mongoose = require("mongoose");

const folderNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  children: [this]
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  description: { type: String },
  rootFolders: [folderNodeSchema],
  allowUpload: { type: Boolean, default: true },
  allowSharing: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
