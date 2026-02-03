const { app, setupContactRoutes } = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const http = require('http');
const { Server } = require('socket.io');
const { initializeSocketHandlers } = require('./socket/socketHandler');

(async () => {
  await connectDB();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const presenceService = initializeSocketHandlers(io);

  setupContactRoutes(io, presenceService);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

