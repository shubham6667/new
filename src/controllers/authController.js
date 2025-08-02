const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, phone, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          { username },
          ...(phone ? [{ phone }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'User already exists with this email, username, or phone number' 
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      bio
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { login, password } = req.body; // login can be email, username, or phone

    // Find user by email, username, or phone
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: login },
          { username: login },
          { phone: login }
        ]
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update user status and last seen
    await user.update({
      status: 'online',
      lastSeen: new Date()
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new tokens
    const tokens = generateTokens(user.id);

    res.json({
      message: 'Token refreshed successfully',
      ...tokens
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

const logout = async (req, res) => {
  try {
    const user = req.user;
    
    // Update user status
    await user.update({
      status: 'offline',
      lastSeen: new Date()
    });

    logger.info(`User logged out: ${user.email}`);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = req.user;
    res.json({ user });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = req.user;
    const { firstName, lastName, bio, phone } = req.body;

    const updatedUser = await user.update({
      firstName,
      lastName,
      bio,
      phone
    });

    logger.info(`User profile updated: ${user.email}`);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile
};