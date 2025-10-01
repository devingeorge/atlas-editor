const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const OAuthService = require('../services/oauth');

const oauthService = new OAuthService();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Auth service is working',
    timestamp: new Date().toISOString(),
  });
});

// Generate OAuth authorization URL
router.get('/slack/authorize', (req, res) => {
  try {
    const state = uuidv4();
    req.session.oauthState = state;
    
    const authUrl = oauthService.getAuthorizationUrl(state);
    
    console.log('Generated OAuth URL:', authUrl);
    console.log('State:', state);
    
    res.json({
      status: 'success',
      data: {
        authUrl,
        state,
      },
    });
  } catch (error) {
    console.error('OAuth authorization error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate authorization URL',
      error: error.message,
    });
  }
});

// Handle OAuth callback
router.get('/slack/callback', async (req, res) => {
  try {
    console.log('OAuth callback received');
    console.log('Query params:', req.query);
    console.log('Session state:', req.session.oauthState);
    
    const { code, state } = req.query;
    
    if (!code) {
      console.error('No authorization code received');
      return res.status(400).json({
        status: 'error',
        message: 'Authorization code is required',
        debug: {
          query: req.query,
          sessionState: req.session.oauthState,
        },
      });
    }

    // Verify state parameter
    if (state !== req.session.oauthState) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid state parameter',
      });
    }

    // Exchange code for token
    const tokenData = await oauthService.exchangeCodeForToken(code);
    
    // Store token in database
    await oauthService.storeToken(tokenData.userId, tokenData);
    
    // Get user info
    const userInfo = await oauthService.getUserInfo(tokenData.userId);
    
    // Set session
    req.session.slackUserId = tokenData.userId;
    req.session.teamId = tokenData.teamId;
    req.session.role = 'editor'; // Default role
    
    // Clear OAuth state
    delete req.session.oauthState;

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?auth=success&user=${tokenData.userId}`);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const userId = req.session.slackUserId;
    
    if (userId) {
      // Revoke OAuth token
      await oauthService.revokeToken(userId);
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to logout',
        });
      }

      res.json({
        status: 'success',
        message: 'Logged out successfully',
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to logout',
      error: error.message,
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    if (!req.session.slackUserId) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated',
      });
    }

    // Test token validity
    const isValid = await oauthService.testToken(req.session.slackUserId);
    
    if (!isValid) {
      // Token is invalid, clear session
      req.session.destroy();
      return res.status(401).json({
        status: 'error',
        message: 'Token expired or invalid',
      });
    }

    // Get user info
    const userInfo = await oauthService.getUserInfo(req.session.slackUserId);

    res.json({
      status: 'success',
      data: {
        userId: req.session.slackUserId,
        teamId: req.session.teamId,
        role: req.session.role || 'viewer',
        userInfo,
      },
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user info',
      error: error.message,
    });
  }
});

// Test OAuth token
router.get('/test-token', async (req, res) => {
  try {
    if (!req.session.slackUserId) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated',
      });
    }

    const isValid = await oauthService.testToken(req.session.slackUserId);
    
    res.json({
      status: 'success',
      data: {
        valid: isValid,
        userId: req.session.slackUserId,
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
