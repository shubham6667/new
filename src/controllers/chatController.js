const { Chat, ChatMember, User, Message } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const createChat = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, description, type = 'group', memberIds = [] } = req.body;
    const creatorId = req.user.id;

    // For direct messages, ensure only 2 members
    if (type === 'direct') {
      if (memberIds.length !== 1) {
        return res.status(400).json({ 
          error: 'Direct messages must have exactly one other member' 
        });
      }

      // Check if direct chat already exists between these users
      const existingChat = await Chat.findOne({
        where: { type: 'direct' },
        include: [{
          model: ChatMember,
          as: 'chatMembers',
          where: {
            userId: { [Op.in]: [creatorId, memberIds[0]] },
            isActive: true
          }
        }]
      });

      if (existingChat && existingChat.chatMembers.length === 2) {
        return res.status(409).json({ 
          error: 'Direct chat already exists between these users',
          chat: existingChat
        });
      }
    }

    // Create chat
    const chat = await Chat.create({
      name: type === 'direct' ? null : name,
      description: type === 'direct' ? null : description,
      type,
      createdBy: creatorId
    });

    // Add creator as admin
    await ChatMember.create({
      chatId: chat.id,
      userId: creatorId,
      role: 'admin',
      permissions: {
        canSendMessages: true,
        canSendMedia: true,
        canAddMembers: true,
        canRemoveMembers: true,
        canEditGroupInfo: true,
        canPinMessages: true,
        canDeleteMessages: true
      }
    });

    // Add other members
    const memberPromises = memberIds.map(userId => 
      ChatMember.create({
        chatId: chat.id,
        userId,
        role: 'member'
      })
    );

    await Promise.all(memberPromises);

    // Load chat with members
    const fullChat = await Chat.findByPk(chat.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: ChatMember,
          as: 'chatMembers',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status']
          }]
        }
      ]
    });

    logger.info(`Chat created: ${chat.id} by user ${creatorId}`);

    res.status(201).json({
      message: 'Chat created successfully',
      chat: fullChat
    });
  } catch (error) {
    logger.error('Error creating chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      userId,
      isActive: true
    };

    const chatWhereClause = {
      isActive: true
    };

    if (type) {
      chatWhereClause.type = type;
    }

    const chats = await ChatMember.findAndCountAll({
      where: whereClause,
      include: [{
        model: Chat,
        as: 'chat',
        where: chatWhereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
          },
          {
            model: Message,
            as: 'messages',
            limit: 1,
            order: [['createdAt', 'DESC']],
            include: [{
              model: User,
              as: 'sender',
              attributes: ['id', 'username', 'firstName', 'lastName']
            }]
          },
          {
            model: ChatMember,
            as: 'chatMembers',
            where: { isActive: true },
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status']
            }]
          }
        ]
      }],
      limit: parseInt(limit),
      offset,
      order: [['chat', 'lastMessageAt', 'DESC']]
    });

    res.json({
      chats: chats.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: chats.count,
        pages: Math.ceil(chats.count / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting user chats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

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

    const chat = await Chat.findByPk(chatId, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: ChatMember,
          as: 'chatMembers',
          where: { isActive: true },
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status', 'lastSeen']
          }]
        }
      ]
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    logger.error('Error getting chat by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateChat = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { chatId } = req.params;
    const userId = req.user.id;
    const { name, description, avatar } = req.body;

    // Check if user has permission to edit chat
    const membership = await ChatMember.findOne({
      where: {
        chatId,
        userId,
        isActive: true
      }
    });

    if (!membership || !membership.permissions.canEditGroupInfo) {
      return res.status(403).json({ error: 'You do not have permission to edit this chat' });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.type === 'direct') {
      return res.status(400).json({ error: 'Cannot edit direct message chats' });
    }

    const updatedChat = await chat.update({
      name,
      description,
      avatar
    });

    logger.info(`Chat ${chatId} updated by user ${userId}`);

    res.json({
      message: 'Chat updated successfully',
      chat: updatedChat
    });
  } catch (error) {
    logger.error('Error updating chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addChatMembers = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { chatId } = req.params;
    const userId = req.user.id;
    const { memberIds } = req.body;

    // Check if user has permission to add members
    const membership = await ChatMember.findOne({
      where: {
        chatId,
        userId,
        isActive: true
      }
    });

    if (!membership || !membership.permissions.canAddMembers) {
      return res.status(403).json({ error: 'You do not have permission to add members' });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.type === 'direct') {
      return res.status(400).json({ error: 'Cannot add members to direct message chats' });
    }

    // Check if users are already members
    const existingMembers = await ChatMember.findAll({
      where: {
        chatId,
        userId: { [Op.in]: memberIds },
        isActive: true
      }
    });

    const existingMemberIds = existingMembers.map(m => m.userId);
    const newMemberIds = memberIds.filter(id => !existingMemberIds.includes(id));

    if (newMemberIds.length === 0) {
      return res.status(400).json({ error: 'All specified users are already members' });
    }

    // Add new members
    const newMembers = await Promise.all(
      newMemberIds.map(memberId => 
        ChatMember.create({
          chatId,
          userId: memberId,
          role: 'member'
        })
      )
    );

    logger.info(`${newMembers.length} members added to chat ${chatId} by user ${userId}`);

    res.json({
      message: 'Members added successfully',
      addedMembers: newMembers.length
    });
  } catch (error) {
    logger.error('Error adding chat members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeChatMember = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const userId = req.user.id;

    // Check if user has permission to remove members
    const membership = await ChatMember.findOne({
      where: {
        chatId,
        userId,
        isActive: true
      }
    });

    if (!membership || (!membership.permissions.canRemoveMembers && userId !== memberId)) {
      return res.status(403).json({ error: 'You do not have permission to remove this member' });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.type === 'direct') {
      return res.status(400).json({ error: 'Cannot remove members from direct message chats' });
    }

    // Find the member to remove
    const memberToRemove = await ChatMember.findOne({
      where: {
        chatId,
        userId: memberId,
        isActive: true
      }
    });

    if (!memberToRemove) {
      return res.status(404).json({ error: 'Member not found in this chat' });
    }

    // Prevent removing the chat creator unless they're leaving themselves
    if (chat.createdBy === memberId && userId !== memberId) {
      return res.status(403).json({ error: 'Cannot remove the chat creator' });
    }

    // Remove member (soft delete)
    await memberToRemove.update({
      isActive: false,
      leftAt: new Date()
    });

    logger.info(`Member ${memberId} removed from chat ${chatId} by user ${userId}`);

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Error removing chat member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const leaveChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const membership = await ChatMember.findOne({
      where: {
        chatId,
        userId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of this chat' });
    }

    const chat = await Chat.findByPk(chatId);
    if (chat.type === 'direct') {
      return res.status(400).json({ error: 'Cannot leave direct message chats' });
    }

    // If user is the creator, transfer ownership to another admin or member
    if (chat.createdBy === userId) {
      const otherAdmins = await ChatMember.findAll({
        where: {
          chatId,
          userId: { [Op.ne]: userId },
          role: 'admin',
          isActive: true
        }
      });

      if (otherAdmins.length > 0) {
        // Transfer to first admin
        await chat.update({ createdBy: otherAdmins[0].userId });
      } else {
        // Promote a member to admin
        const otherMembers = await ChatMember.findAll({
          where: {
            chatId,
            userId: { [Op.ne]: userId },
            isActive: true
          },
          limit: 1
        });

        if (otherMembers.length > 0) {
          await otherMembers[0].update({ role: 'admin' });
          await chat.update({ createdBy: otherMembers[0].userId });
        } else {
          // No other members, deactivate the chat
          await chat.update({ isActive: false });
        }
      }
    }

    // Remove user from chat
    await membership.update({
      isActive: false,
      leftAt: new Date()
    });

    logger.info(`User ${userId} left chat ${chatId}`);

    res.json({ message: 'Left chat successfully' });
  } catch (error) {
    logger.error('Error leaving chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Only chat creator can delete the chat
    if (chat.createdBy !== userId) {
      return res.status(403).json({ error: 'Only the chat creator can delete this chat' });
    }

    // Soft delete the chat
    await chat.update({ isActive: false });

    // Deactivate all memberships
    await ChatMember.update(
      { 
        isActive: false,
        leftAt: new Date()
      },
      { where: { chatId } }
    );

    logger.info(`Chat ${chatId} deleted by user ${userId}`);

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    logger.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createChat,
  getUserChats,
  getChatById,
  updateChat,
  addChatMembers,
  removeChatMember,
  leaveChat,
  deleteChat
};