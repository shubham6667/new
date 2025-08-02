const Queue = require('bull');
const { redisClient } = require('../config/redis');
const { Message, ChatMember, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Create message queues
const messageDeliveryQueue = new Queue('message delivery', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

const notificationQueue = new Queue('notifications', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

// Message delivery job processor
messageDeliveryQueue.process('deliver-message', async (job) => {
  const { messageId, chatId, senderId } = job.data;
  
  try {
    logger.info(`Processing message delivery for message ${messageId}`);

    // Get all chat members except sender
    const chatMembers = await ChatMember.findAll({
      where: {
        chatId,
        userId: { [Op.ne]: senderId },
        isActive: true
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'status']
      }]
    });

    // Update message status to delivered for online users
    const onlineMembers = chatMembers.filter(member => 
      member.user.status === 'online'
    );

    if (onlineMembers.length > 0) {
      await Message.update(
        { 
          deliveredAt: new Date(),
          status: 'delivered'
        },
        { where: { id: messageId } }
      );
    }

    // Queue push notifications for offline users
    const offlineMembers = chatMembers.filter(member => 
      member.user.status === 'offline'
    );

    for (const member of offlineMembers) {
      if (member.notifications) {
        await notificationQueue.add('push-notification', {
          userId: member.userId,
          messageId,
          chatId,
          type: 'message'
        }, {
          delay: 5000, // 5 second delay for offline notifications
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });
      }
    }

    logger.info(`Message ${messageId} delivery processed successfully`);
  } catch (error) {
    logger.error(`Error processing message delivery for ${messageId}:`, error);
    throw error;
  }
});

// Notification job processor
notificationQueue.process('push-notification', async (job) => {
  const { userId, messageId, chatId, type } = job.data;
  
  try {
    logger.info(`Processing push notification for user ${userId}`);

    // Get message and chat details
    const message = await Message.findByPk(messageId, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName']
        }
      ]
    });

    if (!message) {
      logger.warn(`Message ${messageId} not found for notification`);
      return;
    }

    // Here you would integrate with a push notification service
    // like Firebase Cloud Messaging, Apple Push Notification Service, etc.
    
    // For now, we'll just log the notification
    logger.info(`Push notification sent to user ${userId}: New message from ${message.sender.firstName} ${message.sender.lastName}`);

    // You can also store notifications in database for later retrieval
    // await Notification.create({
    //   userId,
    //   title: `New message from ${message.sender.firstName}`,
    //   body: message.content.substring(0, 100),
    //   data: { messageId, chatId, type }
    // });

  } catch (error) {
    logger.error(`Error processing push notification for user ${userId}:`, error);
    throw error;
  }
});

// Message queue service methods
class MessageQueueService {
  async addMessageDeliveryJob(data, options = {}) {
    try {
      const job = await messageDeliveryQueue.add('deliver-message', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        ...options
      });
      
      logger.info(`Message delivery job added: ${job.id}`);
      return job;
    } catch (error) {
      logger.error('Error adding message delivery job:', error);
      throw error;
    }
  }

  async addNotificationJob(data, options = {}) {
    try {
      const job = await notificationQueue.add('push-notification', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        ...options
      });
      
      logger.info(`Notification job added: ${job.id}`);
      return job;
    } catch (error) {
      logger.error('Error adding notification job:', error);
      throw error;
    }
  }

  async addBulkMessageDeliveryJobs(jobs) {
    try {
      const bulkJobs = jobs.map(data => ({
        name: 'deliver-message',
        data,
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      }));

      const addedJobs = await messageDeliveryQueue.addBulk(bulkJobs);
      logger.info(`${addedJobs.length} bulk message delivery jobs added`);
      return addedJobs;
    } catch (error) {
      logger.error('Error adding bulk message delivery jobs:', error);
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const [messageStats, notificationStats] = await Promise.all([
        messageDeliveryQueue.getJobCounts(),
        notificationQueue.getJobCounts()
      ]);

      return {
        messageDelivery: messageStats,
        notifications: notificationStats
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      throw error;
    }
  }

  async pauseQueues() {
    await Promise.all([
      messageDeliveryQueue.pause(),
      notificationQueue.pause()
    ]);
    logger.info('All queues paused');
  }

  async resumeQueues() {
    await Promise.all([
      messageDeliveryQueue.resume(),
      notificationQueue.resume()
    ]);
    logger.info('All queues resumed');
  }

  async cleanQueues() {
    await Promise.all([
      messageDeliveryQueue.clean(24 * 60 * 60 * 1000, 'completed'), // Clean completed jobs older than 24 hours
      messageDeliveryQueue.clean(24 * 60 * 60 * 1000, 'failed'),
      notificationQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      notificationQueue.clean(24 * 60 * 60 * 1000, 'failed')
    ]);
    logger.info('Queues cleaned');
  }
}

// Error handling
messageDeliveryQueue.on('error', (error) => {
  logger.error('Message delivery queue error:', error);
});

notificationQueue.on('error', (error) => {
  logger.error('Notification queue error:', error);
});

// Job completion logging
messageDeliveryQueue.on('completed', (job) => {
  logger.info(`Message delivery job ${job.id} completed`);
});

notificationQueue.on('completed', (job) => {
  logger.info(`Notification job ${job.id} completed`);
});

// Job failure logging
messageDeliveryQueue.on('failed', (job, error) => {
  logger.error(`Message delivery job ${job.id} failed:`, error);
});

notificationQueue.on('failed', (job, error) => {
  logger.error(`Notification job ${job.id} failed:`, error);
});

const messageQueueService = new MessageQueueService();

module.exports = messageQueueService;