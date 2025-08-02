const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user || !user.isActive) {
      return next(new Error('Authentication error: Invalid token or user not found'));
    }

    // Update user status to online
    await user.update({
      status: 'online',
      lastSeen: new Date()
    });

    socket.userId = user.id;
    socket.user = user;
    
    logger.info(`User ${user.username} connected via WebSocket`);
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = socketAuth;