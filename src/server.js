const { app, setupContactRoutes } = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const http = require('http');
const { Server } = require('socket.io');
const { initializeSocketHandlers } = require('./socket/socketHandler');

(async () => {
  await connectDB();

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.IO with CORS
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Initialize Socket event handlers first to get presenceService
  const presenceService = initializeSocketHandlers(io);

  // Setup contact routes with io and presenceService dependency
  setupContactRoutes(io, presenceService);

  // Start server
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

