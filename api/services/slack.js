const axios = require('axios');

class SlackService {
  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN;
    
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

  // Web API Methods (replacing SCIM API)
  async getAllUsers() {
    try {
      const allUsers = [];
      let cursor = '';
      
      do {
        const response = await this.botApi.get('/users.list', {
          params: {
            limit: 200,
            cursor: cursor,
          },
        });

        if (!response.data.ok) {
          throw new Error(response.data.error);
        }

        allUsers.push(...response.data.members);
        cursor = response.data.response_metadata?.next_cursor || '';
        
        // Add small delay to avoid rate limiting
        if (cursor) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (cursor);

      return allUsers.filter(user => !user.deleted && !user.is_bot);
    } catch (error) {
      console.error('Error fetching users:', error.response?.data || error.message);
      throw new Error(`Failed to fetch users: ${error.response?.data?.error || error.message}`);
    }
  }

  async updateUserManager(slackUserId, newManagerId) {
    try {
      // Get current profile to preserve other fields
      const currentProfile = await this.getUserProfile(slackUserId);
      
      // Find manager field ID from team profile
      const teamProfile = await this.getTeamProfile();
      const managerField = teamProfile.find(field => 
        field.label?.toLowerCase().includes('manager') || 
        field.label?.toLowerCase().includes('supervisor') ||
        field.id === 'Xf1234567890' // This would be the actual manager field ID
      );

      if (!managerField) {
        throw new Error('Manager field not found in team profile');
      }

      // Update manager field
      const updatedFields = {
        ...currentProfile.fields,
        [managerField.id]: {
          value: newManagerId,
        },
      };

      const response = await this.botApi.post('/users.profile.set', {
        user: slackUserId,
        profile: {
          fields: updatedFields,
        },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating user manager:', error.response?.data || error.message);
      throw new Error(`Failed to update manager: ${error.response?.data?.error || error.message}`);
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
