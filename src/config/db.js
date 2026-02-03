const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

module.exports = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected');
};
