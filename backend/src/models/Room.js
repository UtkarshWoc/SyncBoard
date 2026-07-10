const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String, // Username or user id
    },
    canvasState: {
      type: Array, // Array of canvas elements
      default: [],
    },
    chatHistory: {
      type: Array, // Array of chat messages
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', RoomSchema);
