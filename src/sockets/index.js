const { Server } = require('socket.io');
const { CLIENT_URL } = require('../config/env');
const registerScoringSocket = require('./scoringSocket');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  registerScoringSocket(io);
  return io;
};

module.exports = initSocket;
