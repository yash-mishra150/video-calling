const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  callHistory: [{
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    participantName: String,
    startTime: Date,
    endTime: Date,
    duration: Number, // in seconds
    callType: {
      type: String,
      enum: ['incoming', 'outgoing', 'missed'],
      default: 'outgoing'
    }
  }]
}, { timestamps: true });

// Index for faster favorite lookups
userSchema.index({ favorites: 1 });
userSchema.index({ 'callHistory.startTime': -1 });

module.exports = mongoose.model('User', userSchema);
