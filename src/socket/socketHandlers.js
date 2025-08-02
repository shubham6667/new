const { Message, Chat, ChatMember, User } = require('../models');
const logger = require('../utils/logger');
const messageQueue = require('../services/messageQueue');
const { Op } = require('sequelize');

class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId mapping
  }

  handleConnection(socket) {
    const userId = socket.userId;
    const user = socket.user;

    // Store user connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Join user to all their chat rooms
    this.joinUserChats(socket, userId);

    // Notify contacts about user coming online
    this.broadcastUserStatus(userId, 'online');

    // Handle incoming messages
    socket.on('send_message', (data) => this.handleSendMessage(socket, data));

    // Handle message status updates
    socket.on('message_delivered', (data) => this.handleMessageDelivered(socket, data));
    socket.on('message_read', (data) => this.handleMessageRead(socket, data));

    // Handle typing indicators
    socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));

    // Handle chat operations
    socket.on('join_chat', (data) => this.handleJoinChat(socket, data));
    socket.on('leave_chat', (data) => this.handleLeaveChat(socket, data));

    // Handle message reactions
    socket.on('add_reaction', (data) => this.handleAddReaction(socket, data));
    socket.on('remove_reaction', (data) => this.handleRemoveReaction(socket, data));

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnection(socket));

    logger.info(`Socket handlers initialized for user ${user.username}`);
  }

  async joinUserChats(socket, userId) {
    try {
      const userChats = await ChatMember.findAll({
        where: { 
          userId,
          isActive: true 
        },
        include: [{
          model: Chat,
          as: 'chat',
          where: { isActive: true }
        }]
      });

      userChats.forEach(membership => {
        socket.join(`chat:${membership.chatId}`);
      });

      logger.info(`User ${userId} joined ${userChats.length} chat rooms`);
    } catch (error) {
      logger.error('Error joining user chats:', error);
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { chatId, content, type = 'text', metadata = {}, replyToId } = data;
      const senderId = socket.userId;

      // Validate chat membership
      const membership = await ChatMember.findOne({
        where: {
          chatId,
          userId: senderId,
          isActive: true
        }
      });

      if (!membership) {
        socket.emit('error', { message: 'You are not a member of this chat' });
        return;
      }

      // Check permissions
      if (!membership.permissions.canSendMessages) {
        socket.emit('error', { message: 'You do not have permission to send messages' });
        return;
      }

      // Create message
      const message = await Message.create({
        chatId,
        senderId,
        content,
        type,
        metadata,
        replyToId,
        status: 'sent'
      });

      // Load message with associations
      const fullMessage = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
          },
          {
            model: Message,
            as: 'replyTo',
            include: [{
              model: User,
              as: 'sender',
              attributes: ['id', 'username', 'firstName', 'lastName']
            }]
          }
        ]
      });

      // Update chat's last message timestamp
      await Chat.update(
        { lastMessageAt: new Date() },
        { where: { id: chatId } }
      );

      // Broadcast message to chat room
      this.io.to(`chat:${chatId}`).emit('new_message', fullMessage);

      // Add to message queue for delivery processing
      await messageQueue.addMessageDeliveryJob({
        messageId: message.id,
        chatId,
        senderId
      });

      logger.info(`Message sent in chat ${chatId} by user ${senderId}`);
    } catch (error) {
      logger.error('Error handling send message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  async handleMessageDelivered(socket, data) {
    try {
      const { messageId } = data;
      const userId = socket.userId;

      await Message.update(
        { 
          deliveredAt: new Date(),
          status: 'delivered'
        },
        { where: { id: messageId } }
      );

      // Notify sender about delivery
      const message = await Message.findByPk(messageId);
      if (message) {
        this.io.to(`user:${message.senderId}`).emit('message_status_updated', {
          messageId,
          status: 'delivered',
          userId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error('Error handling message delivered:', error);
    }
  }

  async handleMessageRead(socket, data) {
    try {
      const { messageId, chatId } = data;
      const userId = socket.userId;

      // Update message read status
      await Message.update(
        { 
          readAt: new Date(),
          status: 'read'
        },
        { where: { id: messageId } }
      );

      // Update user's last read message in chat
      await ChatMember.update(
        { 
          lastReadMessageId: messageId,
          lastReadAt: new Date()
        },
        { 
          where: { 
            chatId,
            userId 
          }
        }
      );

      // Notify sender about read receipt
      const message = await Message.findByPk(messageId);
      if (message) {
        this.io.to(`user:${message.senderId}`).emit('message_status_updated', {
          messageId,
          status: 'read',
          userId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error('Error handling message read:', error);
    }
  }

  handleTypingStart(socket, data) {
    const { chatId } = data;
    const userId = socket.userId;
    
    socket.to(`chat:${chatId}`).emit('user_typing', {
      userId,
      chatId,
      isTyping: true
    });
  }

  handleTypingStop(socket, data) {
    const { chatId } = data;
    const userId = socket.userId;
    
    socket.to(`chat:${chatId}`).emit('user_typing', {
      userId,
      chatId,
      isTyping: false
    });
  }

  async handleJoinChat(socket, data) {
    try {
      const { chatId } = data;
      const userId = socket.userId;

      // Verify membership
      const membership = await ChatMember.findOne({
        where: {
          chatId,
          userId,
          isActive: true
        }
      });

      if (membership) {
        socket.join(`chat:${chatId}`);
        socket.emit('chat_joined', { chatId });
        logger.info(`User ${userId} joined chat ${chatId}`);
      } else {
        socket.emit('error', { message: 'You are not a member of this chat' });
      }
    } catch (error) {
      logger.error('Error handling join chat:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  }

  handleLeaveChat(socket, data) {
    const { chatId } = data;
    socket.leave(`chat:${chatId}`);
    socket.emit('chat_left', { chatId });
  }

  async handleAddReaction(socket, data) {
    try {
      const { messageId, emoji } = data;
      const userId = socket.userId;

      const message = await Message.findByPk(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Add reaction to message
      const reactions = message.reactions || {};
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
        
        await message.update({ reactions });

        // Broadcast reaction to chat
        this.io.to(`chat:${message.chatId}`).emit('reaction_added', {
          messageId,
          emoji,
          userId,
          reactions
        });
      }
    } catch (error) {
      logger.error('Error handling add reaction:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  }

  async handleRemoveReaction(socket, data) {
    try {
      const { messageId, emoji } = data;
      const userId = socket.userId;

      const message = await Message.findByPk(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Remove reaction from message
      const reactions = message.reactions || {};
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(id => id !== userId);
        
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
        
        await message.update({ reactions });

        // Broadcast reaction removal to chat
        this.io.to(`chat:${message.chatId}`).emit('reaction_removed', {
          messageId,
          emoji,
          userId,
          reactions
        });
      }
    } catch (error) {
      logger.error('Error handling remove reaction:', error);
      socket.emit('error', { message: 'Failed to remove reaction' });
    }
  }

  async handleDisconnection(socket) {
    const userId = socket.userId;
    const user = socket.user;

    if (userId) {
      // Remove from connected users
      this.connectedUsers.delete(userId);

      // Update user status to offline
      try {
        await User.update(
          { 
            status: 'offline',
            lastSeen: new Date()
          },
          { where: { id: userId } }
        );

        // Notify contacts about user going offline
        this.broadcastUserStatus(userId, 'offline');

        logger.info(`User ${user?.username || userId} disconnected`);
      } catch (error) {
        logger.error('Error updating user status on disconnect:', error);
      }
    }
  }

  async broadcastUserStatus(userId, status) {
    try {
      // Get user's chats to notify other members
      const userChats = await ChatMember.findAll({
        where: { 
          userId,
          isActive: true 
        },
        include: [{
          model: Chat,
          as: 'chat',
          where: { isActive: true }
        }]
      });

      // Broadcast status to all chat rooms
      userChats.forEach(membership => {
        this.io.to(`chat:${membership.chatId}`).emit('user_status_changed', {
          userId,
          status,
          timestamp: new Date()
        });
      });
    } catch (error) {
      logger.error('Error broadcasting user status:', error);
    }
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

module.exports = SocketHandlers;