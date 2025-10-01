const axios = require('axios');
const OAuthService = require('./oauth');

class SlackService {
  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.oauthService = new OAuthService();
    
    if (!this.botToken) {
      throw new Error('SLACK_BOT_TOKEN environment variable is required');
    }

    this.botApi = axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Create SCIM API client with user's OAuth token
  async createScimApi(userId) {
    const token = await this.oauthService.getToken(userId);
    if (!token) {
      throw new Error('No valid OAuth token found for user');
    }

    return axios.create({
      baseURL: 'https://api.slack.com/scim/v1',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // SCIM API Methods (require userId for OAuth token)
  async getScimUsers(userId, startIndex = 1, count = 200) {
    try {
      const scimApi = await this.createScimApi(userId);
      const response = await scimApi.get('/Users', {
        params: {
          startIndex,
          count,
          filter: 'active eq "true"',
        },
      });

      return {
        users: response.data.Resources || [],
        totalResults: response.data.totalResults || 0,
        startIndex: response.data.startIndex || 1,
        itemsPerPage: response.data.itemsPerPage || count,
      };
    } catch (error) {
      console.error('Error fetching SCIM users:', error.response?.data || error.message);
      throw new Error(`Failed to fetch SCIM users: ${error.response?.data?.detail || error.message}`);
    }
  }

  async getAllScimUsers(userId) {
    const allUsers = [];
    let startIndex = 1;
    const count = 200;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getScimUsers(userId, startIndex, count);
      allUsers.push(...result.users);
      
      hasMore = result.users.length === count;
      startIndex += count;
      
      // Add small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return allUsers;
  }

  async updateUserManager(userId, slackUserId, newManagerId) {
    try {
      const scimApi = await this.createScimApi(userId);
      const response = await scimApi.patch(`/Users/${slackUserId}`, {
        schemas: ['urn:scim:schemas:core:1.0'],
        manager: {
          value: newManagerId,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error updating user manager:', error.response?.data || error.message);
      throw new Error(`Failed to update manager: ${error.response?.data?.detail || error.message}`);
    }
  }

  // Web API Methods
  async getTeamProfile() {
    try {
      const response = await this.botApi.get('/team.profile.get');
      
      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data.profile.fields || [];
    } catch (error) {
      console.error('Error fetching team profile:', error.response?.data || error.message);
      throw new Error(`Failed to fetch team profile: ${error.response?.data?.error || error.message}`);
    }
  }

  async getUserProfile(slackUserId) {
    try {
      const response = await this.botApi.get('/users.profile.get', {
        params: { user: slackUserId },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data.profile;
    } catch (error) {
      console.error('Error fetching user profile:', error.response?.data || error.message);
      throw new Error(`Failed to fetch user profile: ${error.response?.data?.error || error.message}`);
    }
  }

  async updateUserProfile(slackUserId, profileFields) {
    try {
      const response = await this.botApi.post('/users.profile.set', {
        user: slackUserId,
        profile: {
          fields: profileFields,
        },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error.response?.data || error.message);
      throw new Error(`Failed to update profile: ${error.response?.data?.error || error.message}`);
    }
  }

  async getUserInfo(slackUserId) {
    try {
      const response = await this.botApi.get('/users.info', {
        params: { user: slackUserId },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data.user;
    } catch (error) {
      console.error('Error fetching user info:', error.response?.data || error.message);
      throw new Error(`Failed to fetch user info: ${error.response?.data?.error || error.message}`);
    }
  }

  // Utility methods
  async testConnection() {
    try {
      const response = await this.botApi.get('/auth.test');
      return response.data.ok;
    } catch (error) {
      console.error('Slack connection test failed:', error.message);
      return false;
    }
  }

  // Rate limiting helper
  async withBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error.response?.status === 429 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }
}

module.exports = SlackService;
