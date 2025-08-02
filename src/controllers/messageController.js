const { Message, Chat, ChatMember, User } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 50, 
      before, 
      after, 
      search,
      type 
    } = req.query;

    // Check if user is a member of the chat
    const membership = await ChatMember.findOne({
      where: {
        chatId,
        userId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    const offset = (page - 1) * limit;
    const whereClause = { chatId };

    // Add date filters
    if (before) {
      whereClause.createdAt = { [Op.lt]: new Date(before) };
    }
    if (after) {
      whereClause.createdAt = { 
        ...whereClause.createdAt,
        [Op.gt]: new Date(after) 
      };
    }

    // Add search filter
    if (search) {
      whereClause.content = { [Op.iLike]: `%${search}%` };
    }

    // Add type filter
    if (type) {
      whereClause.type = type;
    }

    const messages = await Message.findAndCountAll({
      where: whereClause,
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
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Update user's last read message
    if (messages.rows.length > 0) {
      const latestMessage = messages.rows[0];
      await membership.update({
        lastReadMessageId: latestMessage.id,
        lastReadAt: new Date()
      });
    }

    res.json({
      messages: messages.rows.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: messages.count,
        pages: Math.ceil(messages.count / limit),
        hasMore: offset + messages.rows.length < messages.count
      }
    });
  } catch (error) {
    logger.error('Error getting chat messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMessageById = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findByPk(messageId, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Chat,
          as: 'chat'
        },
        {
          model: Message,
          as: 'replyTo',
          include: [{
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }]
        },
        {
          model: Message,
          as: 'replies',
          include: [{
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }]
        }
      ]
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a member of the chat
    const membership = await ChatMember.findOne({
      where: {
        chatId: message.chatId,
        userId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    res.json({ message });
  } catch (error) {
    logger.error('Error getting message by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const editMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { messageId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can edit their own message
    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    // Check if message is too old to edit (24 hours)
    const hoursSinceCreated = (new Date() - new Date(message.createdAt)) / (1000 * 60 * 60);
    if (hoursSinceCreated > 24) {
      return res.status(403).json({ error: 'Cannot edit messages older than 24 hours' });
    }

    // Update message
    const updatedMessage = await message.update({
      content,
      editedAt: new Date()
    });

    // Load updated message with associations
    const fullMessage = await Message.findByPk(messageId, {
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

    logger.info(`Message ${messageId} edited by user ${userId}`);

    res.json({
      message: 'Message updated successfully',
      message: fullMessage
    });
  } catch (error) {
    logger.error('Error editing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check permissions
    const membership = await ChatMember.findOne({
      where: {
        chatId: message.chatId,
        userId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    // Only sender or users with delete permission can delete messages
    const canDelete = message.senderId === userId || membership.permissions.canDeleteMessages;
    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this message' });
    }

    // Soft delete the message
    await message.destroy();

    logger.info(`Message ${messageId} deleted by user ${userId}`);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const forwardMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { messageId } = req.params;
    const userId = req.user.id;
    const { chatIds } = req.body;

    const originalMessage = await Message.findByPk(messageId);
    if (!originalMessage) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    // Check if user can access the original message
    const originalMembership = await ChatMember.findOne({
      where: {
        chatId: originalMessage.chatId,
        userId,
        isActive: true
      }
    });

    if (!originalMembership) {
      return res.status(403).json({ error: 'You cannot access the original message' });
    }

    // Validate target chats and user memberships
    const targetMemberships = await ChatMember.findAll({
      where: {
        chatId: { [Op.in]: chatIds },
        userId,
        isActive: true
      }
    });

    if (targetMemberships.length !== chatIds.length) {
      return res.status(403).json({ error: 'You are not a member of all target chats' });
    }

    // Check permissions for each target chat
    const invalidChats = targetMemberships.filter(membership => 
      !membership.permissions.canSendMessages
    );

    if (invalidChats.length > 0) {
      return res.status(403).json({ error: 'You do not have permission to send messages in some target chats' });
    }

    // Create forwarded messages
    const forwardedMessages = await Promise.all(
      chatIds.map(chatId => 
        Message.create({
          chatId,
          senderId: userId,
          content: originalMessage.content,
          type: originalMessage.type,
          metadata: originalMessage.metadata,
          isForwarded: true,
          forwardedFromId: messageId,
          status: 'sent'
        })
      )
    );

    // Update target chats' last message timestamp
    await Chat.update(
      { lastMessageAt: new Date() },
      { where: { id: { [Op.in]: chatIds } } }
    );

    logger.info(`Message ${messageId} forwarded to ${chatIds.length} chats by user ${userId}`);

    res.json({
      message: 'Message forwarded successfully',
      forwardedMessages: forwardedMessages.length
    });
  } catch (error) {
    logger.error('Error forwarding message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const searchMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      query, 
      chatId, 
      type, 
      senderId, 
      dateFrom, 
      dateTo, 
      page = 1, 
      limit = 20 
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters long' });
    }

    const offset = (page - 1) * limit;
    const whereClause = {
      content: { [Op.iLike]: `%${query.trim()}%` }
    };

    // Add filters
    if (chatId) {
      whereClause.chatId = chatId;
    }
    if (type) {
      whereClause.type = type;
    }
    if (senderId) {
      whereClause.senderId = senderId;
    }
    if (dateFrom) {
      whereClause.createdAt = { [Op.gte]: new Date(dateFrom) };
    }
    if (dateTo) {
      whereClause.createdAt = { 
        ...whereClause.createdAt,
        [Op.lte]: new Date(dateTo) 
      };
    }

    // Get user's accessible chats
    const userChats = await ChatMember.findAll({
      where: {
        userId,
        isActive: true
      },
      attributes: ['chatId']
    });

    const accessibleChatIds = userChats.map(membership => membership.chatId);

    // Add chat accessibility filter
    if (!chatId) {
      whereClause.chatId = { [Op.in]: accessibleChatIds };
    } else if (!accessibleChatIds.includes(chatId)) {
      return res.status(403).json({ error: 'You do not have access to this chat' });
    }

    const messages = await Message.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Chat,
          as: 'chat',
          attributes: ['id', 'name', 'type']
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      messages: messages.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: messages.count,
        pages: Math.ceil(messages.count / limit)
      },
      query: query.trim()
    });
  } catch (error) {
    logger.error('Error searching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUnreadMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.query;

    let whereClause = {};
    
    if (chatId) {
      // Get unread messages for specific chat
      const membership = await ChatMember.findOne({
        where: {
          chatId,
          userId,
          isActive: true
        }
      });

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this chat' });
      }

      whereClause = {
        chatId,
        senderId: { [Op.ne]: userId }
      };

      if (membership.lastReadMessageId) {
        // Get messages after last read message
        const lastReadMessage = await Message.findByPk(membership.lastReadMessageId);
        if (lastReadMessage) {
          whereClause.createdAt = { [Op.gt]: lastReadMessage.createdAt };
        }
      }
    } else {
      // Get unread messages from all chats
      const userChats = await ChatMember.findAll({
        where: {
          userId,
          isActive: true
        }
      });

      const unreadConditions = await Promise.all(
        userChats.map(async membership => {
          const condition = {
            chatId: membership.chatId,
            senderId: { [Op.ne]: userId }
          };

          if (membership.lastReadMessageId) {
            const lastReadMessage = await Message.findByPk(membership.lastReadMessageId);
            if (lastReadMessage) {
              condition.createdAt = { [Op.gt]: lastReadMessage.createdAt };
            }
          }

          return condition;
        })
      );

      whereClause = { [Op.or]: unreadConditions };
    }

    const unreadMessages = await Message.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Chat,
          as: 'chat',
          attributes: ['id', 'name', 'type']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    // Group by chat for easier frontend handling
    const unreadByChat = unreadMessages.reduce((acc, message) => {
      const chatId = message.chatId;
      if (!acc[chatId]) {
        acc[chatId] = {
          chat: message.chat,
          messages: [],
          count: 0
        };
      }
      acc[chatId].messages.push(message);
      acc[chatId].count++;
      return acc;
    }, {});

    res.json({
      unreadMessages: unreadByChat,
      totalUnread: unreadMessages.length
    });
  } catch (error) {
    logger.error('Error getting unread messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { messageIds } = req.body;

    const membership = await ChatMember.findOne({
      where: {
        chatId,
        userId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    // Update messages as read
    const updatedMessages = await Message.update(
      { 
        readAt: new Date(),
        status: 'read'
      },
      { 
        where: { 
          id: { [Op.in]: messageIds },
          chatId,
          senderId: { [Op.ne]: userId }
        }
      }
    );

    // Update user's last read message
    if (messageIds.length > 0) {
      const latestMessage = await Message.findOne({
        where: {
          id: { [Op.in]: messageIds },
          chatId
        },
        order: [['createdAt', 'DESC']]
      });

      if (latestMessage) {
        await membership.update({
          lastReadMessageId: latestMessage.id,
          lastReadAt: new Date()
        });
      }
    }

    logger.info(`${updatedMessages[0]} messages marked as read in chat ${chatId} by user ${userId}`);

    res.json({
      message: 'Messages marked as read',
      updatedCount: updatedMessages[0]
    });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getChatMessages,
  getMessageById,
  editMessage,
  deleteMessage,
  forwardMessage,
  searchMessages,
  getUnreadMessages,
  markMessagesAsRead
};