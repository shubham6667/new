const sequelize = require('../config/database');
const User = require('./User');
const Chat = require('./Chat');
const Message = require('./Message');
const ChatMember = require('./ChatMember');

// Define associations
User.hasMany(Chat, { foreignKey: 'createdBy', as: 'createdChats' });
Chat.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

Chat.hasMany(Message, { foreignKey: 'chatId', as: 'messages' });
Message.belongsTo(Chat, { foreignKey: 'chatId', as: 'chat' });

// Self-referencing associations for Message replies and forwards
Message.belongsTo(Message, { foreignKey: 'replyToId', as: 'replyTo' });
Message.hasMany(Message, { foreignKey: 'replyToId', as: 'replies' });

Message.belongsTo(Message, { foreignKey: 'forwardedFromId', as: 'forwardedFrom' });
Message.hasMany(Message, { foreignKey: 'forwardedFromId', as: 'forwards' });

// Many-to-many relationship between Users and Chats through ChatMember
User.belongsToMany(Chat, { 
  through: ChatMember, 
  foreignKey: 'userId', 
  otherKey: 'chatId',
  as: 'chats' 
});

Chat.belongsToMany(User, { 
  through: ChatMember, 
  foreignKey: 'chatId', 
  otherKey: 'userId',
  as: 'members' 
});

// Direct associations for ChatMember
ChatMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ChatMember.belongsTo(Chat, { foreignKey: 'chatId', as: 'chat' });
ChatMember.belongsTo(Message, { foreignKey: 'lastReadMessageId', as: 'lastReadMessage' });

User.hasMany(ChatMember, { foreignKey: 'userId', as: 'memberships' });
Chat.hasMany(ChatMember, { foreignKey: 'chatId', as: 'chatMembers' });

module.exports = {
  sequelize,
  User,
  Chat,
  Message,
  ChatMember
};