const express = require('express');
const router = express.Router();
const UserTokenService = require('../services/userToken');

const userTokenService = new UserTokenService();

// Store user token
router.post('/', async (req, res) => {
  try {
    const { token } = req.body;
    const sessionId = req.sessionID || 'default';

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required',
      });
    }

    // Test if token is valid
    const isValid = await userTokenService.testToken(token);
    
    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid token. Please check your Slack user token.',
      });
    }

    // Store token
    userTokenService.storeToken(sessionId, token);

    res.json({
      status: 'success',
      message: 'Token stored successfully',
      data: {
        valid: true,
      },
    });
  } catch (error) {
    console.error('Token storage error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to store token',
      error: error.message,
    });
  }
});

// Get token status
router.get('/status', (req, res) => {
  try {
    const sessionId = req.sessionID || 'default';
    const token = userTokenService.getToken(sessionId);

    res.json({
      status: 'success',
      data: {
        hasToken: !!token,
        valid: !!token,
      },
    });
  } catch (error) {
    console.error('Token status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get token status',
      error: error.message,
    });
  }
});

// Remove token
router.delete('/', (req, res) => {
  try {
    const sessionId = req.sessionID || 'default';
    userTokenService.removeToken(sessionId);

    res.json({
      status: 'success',
      message: 'Token removed successfully',
    });
  } catch (error) {
    console.error('Token removal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove token',
      error: error.message,
    });
  }
});

// Test token
router.post('/test', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required',
      });
    }

    const isValid = await userTokenService.testToken(token);

    res.json({
      status: 'success',
      data: {
        valid: isValid,
      },
    });
  } catch (error) {
    console.error('Token test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test token',
      error: error.message,
    });
  }
});

module.exports = router;
