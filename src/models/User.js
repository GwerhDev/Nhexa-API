const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: { type: String, required: true },
  email: { type: String, require: true },
  method: { type: String, required: true },
  password: { type: String, require: true },
  username: { type: String, require: true },
  googleId: { type: String, required: true },
  googlePic: { type: String, required: true },
  profilePic: { type: String, require: true },
  isVerified: { type: Boolean, require: true },
  projects: [{ type: String, ref: 'Project' }],
});

module.exports = mongoose.model('User', userSchema);