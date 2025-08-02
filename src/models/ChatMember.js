const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatMember = sequelize.define('ChatMember', {
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
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'moderator', 'member'),
    defaultValue: 'member'
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  leftAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastReadMessageId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'messages',
      key: 'id'
    }
  },
  lastReadAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  nickname: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  permissions: {
    type: DataTypes.JSONB,
    defaultValue: {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: false,
      canRemoveMembers: false,
      canEditGroupInfo: false,
      canPinMessages: false,
      canDeleteMessages: false
    }
  }
}, {
  indexes: [
    { fields: ['chatId', 'userId'], unique: true },
    { fields: ['userId'] },
    { fields: ['role'] },
    { fields: ['isActive'] },
    { fields: ['lastReadMessageId'] }
  ]
});

module.exports = ChatMember;