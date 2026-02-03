const User = require('../models/users.model.js');

exports.searchUsers = async (req, res) => {
  const q = req.query.q || '';
  const users = await User.find({
    username: { $regex: q, $options: 'i' },
    _id: { $ne: req.user.userId }
  }).select('username');

  res.json(users);
};

exports.getCallHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('callHistory');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Sort by most recent first
    const history = user.callHistory.sort((a, b) => b.startTime - a.startTime);
    
    res.json({
      callHistory: history,
      total: history.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching call history', error: err.message });
  }
};

exports.clearCallHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.callHistory = [];
    await user.save();

    res.json({ message: 'Call history cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Error clearing call history', error: err.message });
  }
};
