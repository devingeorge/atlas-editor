const axios = require('axios');
const { query } = require('../database');
const crypto = require('crypto');

class OAuthService {
  constructor() {
    this.clientId = process.env.SLACK_CLIENT_ID;
    this.clientSecret = process.env.SLACK_CLIENT_SECRET;
    this.redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/auth/slack/callback';
    this.encryptionKey = process.env.SESSION_SECRET || 'fallback-secret-key';
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('SLACK_CLIENT_ID and SLACK_CLIENT_SECRET environment variables are required');
    }
  }

  // Encrypt state parameter with timestamp
  encryptState(state) {
    const timestamp = Date.now();
    const data = JSON.stringify({ state, timestamp });
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // Decrypt state parameter and validate timestamp
  decryptState(encryptedState) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedState, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const { state, timestamp } = JSON.parse(decrypted);
      
      // Check if state is not older than 10 minutes
      if (Date.now() - timestamp > 10 * 60 * 1000) {
        throw new Error('State parameter expired');
      }
      
      return state;
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }

  // Generate OAuth authorization URL
  getAuthorizationUrl(state) {
    // Encrypt the state parameter
    const encryptedState = this.encryptState(state);
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: 'users:read,users:read.email,team:read',
      redirect_uri: this.redirectUri,
      state: encryptedState,
    });

    const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    
    console.log('=== OAuth URL Generation Debug ===');
    console.log('Client ID:', this.clientId);
    console.log('Redirect URI:', this.redirectUri);
    console.log('Original State:', state);
    console.log('Encrypted State:', encryptedState);
    console.log('Scopes:', 'users:read,users:read.email,team:read (bot scopes)');
    console.log('Generated URL:', authUrl);
    console.log('================================');
    
    return authUrl;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code) {
    try {
      console.log('=== OAuth Token Exchange Debug ===');
      console.log('Code:', code);
      console.log('Client ID:', this.clientId);
      console.log('Redirect URI:', this.redirectUri);
      
      // Use the correct OAuth endpoint for user tokens
      const response = await axios.post('https://slack.com/api/oauth.v2.access', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
      });

      console.log('Slack API Response:', JSON.stringify(response.data, null, 2));

      if (!response.data.ok) {
        console.error('OAuth token exchange failed:', response.data);
        throw new Error(response.data.error || 'OAuth token exchange failed');
      }

      const tokenData = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope,
        expiresIn: response.data.expires_in,
        userId: response.data.authed_user?.id,
        teamId: response.data.team?.id,
      };

      console.log('Token data extracted:', {
        userId: tokenData.userId,
        teamId: tokenData.teamId,
        scope: tokenData.scope,
        hasAccessToken: !!tokenData.accessToken,
      });
      console.log('================================');

      return tokenData;
    } catch (error) {
      console.error('OAuth token exchange error:', error.response?.data || error.message);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error || error.message}`);
    }
  }

  // Store OAuth token in database
  async storeToken(userId, tokenData) {
    const expiresAt = tokenData.expiresIn 
      ? new Date(Date.now() + tokenData.expiresIn * 1000)
      : null;

    try {
      await query(`
        INSERT INTO oauth_tokens (
          slack_user_id, access_token, refresh_token, token_type, scope, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slack_user_id) 
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_type = EXCLUDED.token_type,
          scope = EXCLUDED.scope,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      `, [
        userId,
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.tokenType,
        tokenData.scope,
        expiresAt,
      ]);
    } catch (error) {
      console.error('Error storing OAuth token:', error);
      throw new Error('Failed to store OAuth token');
    }
  }

  // Get stored OAuth token
  async getToken(userId) {
    try {
      const result = await query(
        'SELECT * FROM oauth_tokens WHERE slack_user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const token = result.rows[0];
      
      // Check if token is expired
      if (token.expires_at && new Date() > new Date(token.expires_at)) {
        // Try to refresh the token
        if (token.refresh_token) {
          return await this.refreshToken(userId, token.refresh_token);
        }
        return null;
      }

      return token;
    } catch (error) {
      console.error('Error getting OAuth token:', error);
      throw new Error('Failed to get OAuth token');
    }
  }

  // Refresh OAuth token
  async refreshToken(userId, refreshToken) {
    try {
      const response = await axios.post('https://slack.com/api/oauth.v2.access', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Token refresh failed');
      }

      const tokenData = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope,
        expiresIn: response.data.expires_in,
      };

      await this.storeToken(userId, tokenData);
      return await this.getToken(userId);
    } catch (error) {
      console.error('Token refresh error:', error.response?.data || error.message);
      throw new Error(`Failed to refresh token: ${error.response?.data?.error || error.message}`);
    }
  }

  // Revoke OAuth token
  async revokeToken(userId) {
    try {
      const token = await this.getToken(userId);
      if (!token) {
        return;
      }

      await axios.post('https://slack.com/api/auth.revoke', {
        token: token.access_token,
      });

      await query(
        'DELETE FROM oauth_tokens WHERE slack_user_id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Token revocation error:', error.response?.data || error.message);
      // Continue with deletion even if revocation fails
      await query(
        'DELETE FROM oauth_tokens WHERE slack_user_id = $1',
        [userId]
      );
    }
  }

  // Get user info using OAuth token
  async getUserInfo(userId) {
    try {
      const token = await this.getToken(userId);
      if (!token) {
        throw new Error('No valid OAuth token found');
      }

      const response = await axios.get('https://slack.com/api/users.identity', {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to get user info');
      }

      return response.data.user;
    } catch (error) {
      console.error('Get user info error:', error.response?.data || error.message);
      throw new Error(`Failed to get user info: ${error.response?.data?.error || error.message}`);
    }
  }

  // Test OAuth token validity
  async testToken(userId) {
    try {
      const token = await this.getToken(userId);
      if (!token) {
        return false;
      }

      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      });

      return response.data.ok;
    } catch (error) {
      console.error('Token test error:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = OAuthService;
