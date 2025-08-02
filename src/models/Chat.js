const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Chat = sequelize.define('Chat', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true // null for direct messages
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('direct', 'group'),
    allowNull: false,
    defaultValue: 'direct'
  },
  avatar: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      allowInvites: true,
      muteNotifications: false,
      disappearingMessages: false,
      disappearingMessagesDuration: null
    }
  }
}, {
  indexes: [
    { fields: ['type'] },
    { fields: ['createdBy'] },
    { fields: ['lastMessageAt'] },
    { fields: ['isActive'] }
  ]
});

module.exports = Chat;