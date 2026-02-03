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

app.use(helmet());
app.use(cors());

app.use(loggingMiddleware);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);


app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const setupContactRoutes = (io, presenceService) => {
  const contactRoutesWithIO = require('./routes/contact.routes.js')(io, presenceService);
  app.use('/api/contacts', contactRoutesWithIO);
};

module.exports = { app, setupContactRoutes };

