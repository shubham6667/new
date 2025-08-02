const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  chatId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'chats',
      key: 'id'
    }
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'system'),
    defaultValue: 'text'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  replyToId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'messages',
      key: 'id'
    }
  },
  editedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('sending', 'sent', 'delivered', 'read', 'failed'),
    defaultValue: 'sending'
  },
  isForwarded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  forwardedFromId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'messages',
      key: 'id'
    }
  },
  reactions: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  indexes: [
    { fields: ['chatId', 'createdAt'] },
    { fields: ['senderId'] },
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['replyToId'] },
    { fields: ['forwardedFromId'] }
  ]
});

module.exports = Message;