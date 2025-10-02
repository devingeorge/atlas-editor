const express = require('express');
const router = express.Router();

const { query, transaction } = require('../database');
const { del, CacheKeys } = require('../cache');
const SlackService = require('../services/slack');
const UserTokenService = require('../services/userToken');

// Helper function to get user token
function getUserToken(req) {
  return req.headers['x-slack-token'];
}

// Helper function to check authentication
function requireAuth(req, res, next) {
  console.log('🔍 requireAuth - All headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 requireAuth - Looking for x-slack-token header');
  
  const userToken = getUserToken(req);
  console.log('🔍 requireAuth - Token found:', !!userToken);
  console.log('🔍 requireAuth - Token prefix:', userToken ? userToken.substring(0, 10) + '...' : 'none');
  
  if (!userToken) {
    console.log('❌ requireAuth - No token found, returning 401');
    return res.status(401).json({
      status: 'error',
      message: 'User token required. Please provide your Slack user token.',
    });
  }
  req.userToken = userToken;
  next();
}

// Sync SCIM users
router.post('/scim-users', requireAuth, async (req, res) => {
  try {
    const slack = new SlackService();
    const users = await slack.getAllUsers(req.userToken);
    
    let synced = 0;
    let updated = 0;
    let created = 0;

    await transaction(async (client) => {
      for (const scimUser of users) {
        const slackUserId = scimUser.id;
        const email = scimUser.emails?.[0]?.value || '';
        const realName = scimUser.displayName || scimUser.name?.formatted || '';
        const title = scimUser.title || '';
        const managerId = scimUser.manager?.value || null;
        const active = scimUser.active !== false;

        // Check if user exists
        const existingResult = await client.query(
          'SELECT id FROM users WHERE slack_user_id = $1',
          [slackUserId]
        );

        if (existingResult.rows.length > 0) {
          // Update existing user
          await client.query(`
            UPDATE users SET
              email = $1,
              real_name = $2,
              title = $3,
              manager_slack_user_id = $4,
              active = $5,
              raw_scim = $6,
              synced_at = NOW(),
              updated_at = NOW()
            WHERE slack_user_id = $7
          `, [email, realName, title, managerId, active, JSON.stringify(scimUser), slackUserId]);
          updated++;
        } else {
          // Create new user
          await client.query(`
            INSERT INTO users (
              slack_user_id, email, real_name, title, 
              manager_slack_user_id, active, raw_scim
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [slackUserId, email, realName, title, managerId, active, JSON.stringify(scimUser)]);
          created++;
        }
        synced++;
      }
    });

    // Clear cache
    del(CacheKeys.users());
    del(CacheKeys.orgChart());

    res.json({
      status: 'success',
      data: {
        message: `Synced ${synced} users`,
        stats: {
          synced,
          created,
          updated,
        },
      },
    });
  } catch (error) {
    console.error('SCIM sync error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync SCIM users',
      error: error.message,
    });
  }
});

// Sync profile schema
router.post('/profile-schema', requireAuth, async (req, res) => {
  try {
    const slack = new SlackService();
    const fields = await slack.getTeamProfile(req.userToken);
    
    let synced = 0;
    let updated = 0;
    let created = 0;

    await transaction(async (client) => {
      for (const field of fields) {
        const slackFieldId = field.id;
        const label = field.label || '';
        const hint = field.hint || '';
        const type = field.type || 'text';
        
        // Determine if field is editable (basic heuristic)
        const isEditable = !field.options || field.options.length === 0;

        // Check if field exists
        const existingResult = await client.query(
          'SELECT id FROM profile_fields WHERE slack_field_id = $1',
          [slackFieldId]
        );

        if (existingResult.rows.length > 0) {
          // Update existing field
          await client.query(`
            UPDATE profile_fields SET
              label = $1,
              hint = $2,
              type = $3,
              is_editable = $4,
              raw = $5,
              updated_at = NOW()
            WHERE slack_field_id = $6
          `, [label, hint, type, isEditable, JSON.stringify(field), slackFieldId]);
          updated++;
        } else {
          // Create new field
          await client.query(`
            INSERT INTO profile_fields (
              slack_field_id, label, hint, type, is_editable, raw
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [slackFieldId, label, hint, type, isEditable, JSON.stringify(field)]);
          created++;
        }
        synced++;
      }
    });

    // Clear cache
    del(CacheKeys.profileFields());

    res.json({
      status: 'success',
      data: {
        message: `Synced ${synced} profile fields`,
        stats: {
          synced,
          created,
          updated,
        },
      },
    });
  } catch (error) {
    console.error('Profile schema sync error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync profile schema',
      error: error.message,
    });
  }
});

// Full sync (both SCIM and profile schema)
router.post('/full', requireAuth, async (req, res) => {
  try {
    console.log('🔍 Full sync request received');
    console.log('🔍 Full sync - Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔍 Full sync - Token prefix:', req.userToken ? req.userToken.substring(0, 10) + '...' : 'none');
    
    const slack = new SlackService();
    
    // Test connection first
    const isConnected = await slack.testToken(req.userToken);
    console.log('🔍 Full sync - Slack connection test result:', isConnected);
    if (!isConnected) {
      console.log('❌ Full sync - Slack connection failed');
      return res.status(500).json({
        status: 'error',
        message: 'Slack connection failed',
      });
    }

    const results = {
      scim: { synced: 0, created: 0, updated: 0 },
      profile: { synced: 0, created: 0, updated: 0 },
    };

    // Sync SCIM users
    try {
      console.log('🔍 Full sync - Starting SCIM user sync');
      console.log('🔍 Full sync - Calling slack.getAllUsers with token:', req.userToken.substring(0, 10) + '...');
      const users = await slack.getAllUsers(req.userToken);
      console.log('🔍 Full sync - SCIM users fetched:', users.length);
      console.log('🔍 Full sync - First user sample:', users.length > 0 ? JSON.stringify(users[0], null, 2) : 'No users');
      
      await transaction(async (client) => {
        for (const scimUser of users) {
          const slackUserId = scimUser.id;
          const email = scimUser.emails?.[0]?.value || '';
          
          // Handle Slack Atlas SCIM data structure
          let realName = '';
          if (scimUser.name?.givenName && scimUser.name?.familyName) {
            realName = `${scimUser.name.givenName} ${scimUser.name.familyName}`.trim();
          } else if (scimUser.name?.givenName) {
            realName = scimUser.name.givenName;
          } else if (scimUser.displayName) {
            realName = scimUser.displayName;
          } else if (scimUser.name?.formatted) {
            realName = scimUser.name.formatted;
          } else if (scimUser.userName) {
            realName = scimUser.userName;
          }
          
          const title = scimUser.title || '';
          const managerId = scimUser.manager?.value || null;
          const active = scimUser.active !== false;

          console.log(`🔍 Full sync - Processing user: ${realName} (${slackUserId})`);

          const existingResult = await client.query(
            'SELECT id FROM users WHERE slack_user_id = $1',
            [slackUserId]
          );

          if (existingResult.rows.length > 0) {
            await client.query(`
              UPDATE users SET
                email = $1, real_name = $2, title = $3,
                manager_slack_user_id = $4, active = $5,
                raw_scim = $6, synced_at = NOW(), updated_at = NOW()
              WHERE slack_user_id = $7
            `, [email, realName, title, managerId, active, JSON.stringify(scimUser), slackUserId]);
            results.scim.updated++;
            console.log(`🔍 Full sync - Updated user: ${realName}`);
          } else {
            await client.query(`
              INSERT INTO users (
                slack_user_id, email, real_name, title, 
                manager_slack_user_id, active, raw_scim
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [slackUserId, email, realName, title, managerId, active, JSON.stringify(scimUser)]);
            results.scim.created++;
            console.log(`🔍 Full sync - Created user: ${realName}`);
          }
          results.scim.synced++;
        }
      });
      console.log('🔍 Full sync - SCIM sync completed:', results.scim);
      
      // Note: Web API manager sync disabled due to scope issues with user tokens
      // Manager relationships will need to be handled through SCIM API or bot tokens
      console.log('🔍 Full sync - Skipping Web API manager sync (scope limitations)');
      
    } catch (error) {
      console.error('❌ SCIM sync failed:', error);
      results.scim.error = error.message;
    }

    // Sync profile schema
    try {
      console.log('🔍 Full sync - Starting profile schema sync');
      const fields = await slack.getTeamProfile(req.userToken);
      console.log('🔍 Full sync - Profile fields fetched:', fields.length);
      
      await transaction(async (client) => {
        for (const field of fields) {
          const slackFieldId = field.id;
          const label = field.label || '';
          const hint = field.hint || '';
          const type = field.type || 'text';
          const isEditable = !field.options || field.options.length === 0;

          const existingResult = await client.query(
            'SELECT id FROM profile_fields WHERE slack_field_id = $1',
            [slackFieldId]
          );

          if (existingResult.rows.length > 0) {
            await client.query(`
              UPDATE profile_fields SET
                label = $1, hint = $2, type = $3,
                is_editable = $4, raw = $5, updated_at = NOW()
              WHERE slack_field_id = $6
            `, [label, hint, type, isEditable, JSON.stringify(field), slackFieldId]);
            results.profile.updated++;
          } else {
            await client.query(`
              INSERT INTO profile_fields (
                slack_field_id, label, hint, type, is_editable, raw
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [slackFieldId, label, hint, type, isEditable, JSON.stringify(field)]);
            results.profile.created++;
          }
          results.profile.synced++;
        }
      });
      console.log('🔍 Full sync - Profile schema sync completed:', results.profile);
    } catch (error) {
      console.error('❌ Profile schema sync failed:', error);
      results.profile.error = error.message;
    }

    // Clear all caches
    del(CacheKeys.users());
    del(CacheKeys.orgChart());
    del(CacheKeys.profileFields());

    console.log('🔍 Full sync - Final results:', results);
    res.json({
      status: 'success',
      data: {
        message: 'Full sync completed',
        results,
      },
    });
  } catch (error) {
    console.error('❌ Full sync error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform full sync',
      error: error.message,
    });
  }
});

module.exports = router;
