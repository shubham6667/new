const express = require('express');
const { body, param } = require('express-validator');
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Chat creation validation
const createChatValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Chat name must be between 1 and 255 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
    .trim(),
  body('type')
    .optional()
    .isIn(['direct', 'group'])
    .withMessage('Chat type must be either direct or group'),
  body('memberIds')
    .isArray({ min: 1 })
    .withMessage('At least one member ID is required')
    .custom((memberIds) => {
      if (!memberIds.every(id => typeof id === 'string' && id.length > 0)) {
        throw new Error('All member IDs must be valid strings');
      }
      return true;
    })
];

// Chat update validation
const updateChatValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Chat name must be between 1 and 255 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
    .trim(),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
];

// Add members validation
const addMembersValidation = [
  body('memberIds')
    .isArray({ min: 1 })
    .withMessage('At least one member ID is required')
    .custom((memberIds) => {
      if (!memberIds.every(id => typeof id === 'string' && id.length > 0)) {
        throw new Error('All member IDs must be valid strings');
      }
      return true;
    })
];

// UUID parameter validation
const uuidValidation = [
  param('chatId')
    .isUUID()
    .withMessage('Invalid chat ID format'),
  param('memberId')
    .optional()
    .isUUID()
    .withMessage('Invalid member ID format')
];

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.post('/', createChatValidation, chatController.createChat);
router.get('/', chatController.getUserChats);
router.get('/:chatId', uuidValidation, chatController.getChatById);
router.put('/:chatId', uuidValidation, updateChatValidation, chatController.updateChat);
router.post('/:chatId/members', uuidValidation, addMembersValidation, chatController.addChatMembers);
router.delete('/:chatId/members/:memberId', uuidValidation, chatController.removeChatMember);
router.post('/:chatId/leave', uuidValidation, chatController.leaveChat);
router.delete('/:chatId', uuidValidation, chatController.deleteChat);

module.exports = router;