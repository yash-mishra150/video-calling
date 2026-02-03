const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const loggingMiddleware = require('./middleware/logging.middleware');
const { validateAuth } = require('./middleware/validation.middleware');
const authRoutes = require('./routes/auth.route.js');
const userRoutes = require('./routes/user.route.js');
const contactRoutes = require('./routes/contact.routes.js');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Request logging
app.use(loggingMiddleware);

// Body parsing
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Contact routes will be set up after io is available
// app.use('/api/contacts', contactRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Function to setup contact routes with io dependency
const setupContactRoutes = (io, presenceService) => {
  // Re-initialize contact routes with io and presenceService context
  const contactRoutesWithIO = require('./routes/contact.routes.js')(io, presenceService);
  app.use('/api/contacts', contactRoutesWithIO);
};

module.exports = { app, setupContactRoutes };

