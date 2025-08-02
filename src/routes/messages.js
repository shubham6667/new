const express = require('express');
const { body, param, query } = require('express-validator');
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Message edit validation
const editMessageValidation = [
  body('content')
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 4000 })
    .withMessage('Message content must be less than 4000 characters')
    .trim()
];

// Forward message validation
const forwardMessageValidation = [
  body('chatIds')
    .isArray({ min: 1 })
    .withMessage('At least one chat ID is required')
    .custom((chatIds) => {
      if (!chatIds.every(id => typeof id === 'string' && id.length > 0)) {
        throw new Error('All chat IDs must be valid strings');
      }
      return true;
    })
];

// Mark as read validation
const markAsReadValidation = [
  body('messageIds')
    .isArray({ min: 1 })
    .withMessage('At least one message ID is required')
    .custom((messageIds) => {
      if (!messageIds.every(id => typeof id === 'string' && id.length > 0)) {
        throw new Error('All message IDs must be valid strings');
      }
      return true;
    })
];

// UUID parameter validation
const uuidValidation = [
  param('chatId')
    .optional()
    .isUUID()
    .withMessage('Invalid chat ID format'),
  param('messageId')
    .optional()
    .isUUID()
    .withMessage('Invalid message ID format')
];

// Search validation
const searchValidation = [
  query('query')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters')
    .trim()
];

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.get('/search', searchValidation, messageController.searchMessages);
router.get('/unread', messageController.getUnreadMessages);
router.get('/:chatId', uuidValidation, messageController.getChatMessages);
router.get('/message/:messageId', uuidValidation, messageController.getMessageById);
router.put('/:messageId', uuidValidation, editMessageValidation, messageController.editMessage);
router.delete('/:messageId', uuidValidation, messageController.deleteMessage);
router.post('/:messageId/forward', uuidValidation, forwardMessageValidation, messageController.forwardMessage);
router.post('/:chatId/mark-read', uuidValidation, markAsReadValidation, messageController.markMessagesAsRead);

module.exports = router;