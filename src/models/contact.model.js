const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // Who sent request
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // Who receives request
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Prevent duplicate friend requests
contactSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Index for quick queries
contactSchema.index({ requester: 1, status: 1 });
contactSchema.index({ recipient: 1, status: 1 });

module.exports = mongoose.model('Contact', contactSchema);
