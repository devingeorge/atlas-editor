const axios = require('axios');
const UserTokenService = require('./userToken');

class SlackService {
  constructor() {
    this.userTokenService = new UserTokenService();
  }

  // Get API client with user token
  getApiClient(userToken) {
    return axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Get SCIM API client with user token
  getScimApiClient(userToken) {
    return axios.create({
      baseURL: 'https://api.slack.com/scim/v1',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Web API Methods for regular Slack workspaces (fallback when SCIM not available)
  async getAllUsersWebApi(userToken) {
    try {
      const api = this.getApiClient(userToken);
      const allUsers = [];
      let cursor = '';
      
      do {
        const params = {
          limit: 200,
          cursor: cursor,
        };
        
        // For Enterprise Grid, we might need to specify team_id
        // Try without team_id first, then with it if it fails
        let response;
        try {
          response = await api.get('/users.list', { params });
        } catch (error) {
          if (error.response?.data?.error === 'missing_argument') {
            console.log('🔍 Web API - missing_argument, trying with team_id');
            // Get team info first to get team_id
            const teamResponse = await api.get('/team.info');
            if (teamResponse.data.ok) {
              params.team_id = teamResponse.data.team.id;
              response = await api.get('/users.list', { params });
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }

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
      console.error('Error fetching Web API users:', error.response?.data || error.message);
      throw new Error(`Failed to fetch users: ${error.response?.data?.error || error.message}`);
    }
  }

  // SCIM API Methods (using user token)
  async getAllUsers(userToken) {
    try {
      console.log('🔍 SlackService.getAllUsers - Starting SCIM API call');
      // First try SCIM API
      const scimApi = this.getScimApiClient(userToken);
      const allUsers = [];
      let startIndex = 1;
      const count = 100;

      do {
        console.log(`🔍 SlackService.getAllUsers - SCIM API call, startIndex: ${startIndex}`);
        const response = await scimApi.get('/Users', {
          params: {
            startIndex,
            count,
          },
        });

        console.log('🔍 SlackService.getAllUsers - SCIM API response status:', response.status);
        console.log('🔍 SlackService.getAllUsers - SCIM API response data:', JSON.stringify(response.data, null, 2));

        if (response.data.Resources) {
          allUsers.push(...response.data.Resources);
          console.log(`🔍 SlackService.getAllUsers - Added ${response.data.Resources.length} users, total: ${allUsers.length}`);
        }

        startIndex += count;
      } while (response.data.Resources && response.data.Resources.length === count);

      console.log('🔍 SlackService.getAllUsers - SCIM API completed, total users:', allUsers.length);
      return allUsers;
        } catch (error) {
          console.error('❌ SCIM API failed, falling back to Web API:', error.response?.data || error.message);
          console.error('❌ SCIM API error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
          });
          
          // Fallback to Web API for regular Slack workspaces
          return await this.getAllUsersWebApi(userToken);
        }
  }

  async updateUserManager(userToken, slackUserId, newManagerId) {
    try {
      const scimApi = this.getScimApiClient(userToken);
      
      // Get current user data
      const userResponse = await scimApi.get(`/Users/${slackUserId}`);
      const userData = userResponse.data;

      // Update manager
      userData.manager = {
        value: newManagerId,
      };

      const response = await scimApi.put(`/Users/${slackUserId}`, userData);

      return response.data;
    } catch (error) {
      console.error('Error updating user manager:', error.response?.data || error.message);
      throw new Error(`Failed to update manager: ${error.response?.data?.error || error.message}`);
    }
  }

  // Web API Methods (using user token)
  async getTeamProfile(userToken) {
    try {
      const api = this.getApiClient(userToken);
      const response = await api.get('/team.profile.get');
      
      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data.profile.fields || [];
    } catch (error) {
      console.error('Error fetching team profile:', error.response?.data || error.message);
      throw new Error(`Failed to fetch team profile: ${error.response?.data?.error || error.message}`);
    }
  }

  async getUserProfile(userToken, slackUserId) {
    try {
      const api = this.getApiClient(userToken);
      const response = await api.get('/users.profile.get', {
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

  async updateUserProfile(userToken, slackUserId, profileFields) {
    try {
      const api = this.getApiClient(userToken);
      const response = await api.post('/users.profile.set', {
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

  async getUserInfo(userToken, slackUserId) {
    try {
      const api = this.getApiClient(userToken);
      const response = await api.get('/users.info', {
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

  // Test if token is valid (works for both user and bot tokens)
  async testToken(token) {
    try {
      const api = this.getApiClient(token);
      const response = await api.get('/auth.test');
      return response.data.ok;
    } catch (error) {
      console.error('Token test error:', error.response?.data || error.message);
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
