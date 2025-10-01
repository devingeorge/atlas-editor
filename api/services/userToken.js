const axios = require('axios');

class UserTokenService {
  constructor() {
    this.userTokens = new Map(); // Store user tokens in memory
  }

  // Store user token for a session
  storeToken(sessionId, token) {
    this.userTokens.set(sessionId, {
      token,
      timestamp: Date.now(),
    });
  }

  // Get user token for a session
  getToken(sessionId) {
    const tokenData = this.userTokens.get(sessionId);
    if (!tokenData) {
      return null;
    }

    // Check if token is older than 24 hours
    if (Date.now() - tokenData.timestamp > 24 * 60 * 60 * 1000) {
      this.userTokens.delete(sessionId);
      return null;
    }

    return tokenData.token;
  }

  // Remove user token
  removeToken(sessionId) {
    this.userTokens.delete(sessionId);
  }

  // Test if token is valid
  async testToken(token) {
    try {
      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.data.ok;
    } catch (error) {
      console.error('Token test error:', error.response?.data || error.message);
      return false;
    }
  }

  // Create SCIM API client with user token
  createScimApi(token) {
    return axios.create({
      baseURL: 'https://api.slack.com/scim/v1',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Create Web API client with user token
  createWebApi(token) {
    return axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

module.exports = UserTokenService;
