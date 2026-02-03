const bcrypt = require('bcryptjs');
const User = require('../models/users.model');
const { generateToken } = require('../utils/token');

exports.register = async (req, res) => {
  const { username, password } = req.body;

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ message: 'User exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ username, password: hashed });

  res.status(201).json({ message: 'Registered' });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = generateToken({ userId: user._id });

  res.json({ token, userId: user._id, username: user.username });
};
