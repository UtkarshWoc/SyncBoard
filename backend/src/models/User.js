const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatarUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
