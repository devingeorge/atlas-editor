const express = require('express');
const router = express.Router();

// Bootstrap endpoint - returns feature flags, auth user, org name
router.get('/bootstrap', async (req, res) => {
  try {
    const SlackService = require('../services/slack');
    const slack = new SlackService();
    
    // Test Slack connection
    const isConnected = await slack.testConnection();
    
    res.json({
      status: 'success',
      data: {
        features: {
          scimEnabled: !!process.env.SCIM_TOKEN,
          profileEditing: true,
          managerChanges: true,
          auditLogging: true,
        },
        auth: {
          isAuthenticated: !!req.session.slackUserId,
          userId: req.session.slackUserId || null,
        },
        org: {
          name: process.env.SLACK_WORKSPACE_NAME || 'Slack Workspace',
        },
        connection: {
          slackConnected: isConnected,
        },
      },
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to bootstrap application',
      error: error.message,
    });
  }
});

// Get org chart data
router.get('/org', async (req, res) => {
  try {
    const { query } = require('../database');
    const { get, set, CacheKeys } = require('../cache');
    
    // Check cache first
    const cached = get(CacheKeys.orgChart());
    if (cached) {
      return res.json({
        status: 'success',
        data: cached,
      });
    }

    // Fetch from database
    const result = await query(`
      SELECT 
        slack_user_id as id,
        real_name as name,
        title,
        manager_slack_user_id as managerId,
        avatar_url as avatar,
        email
      FROM users 
      WHERE active = true
      ORDER BY real_name
    `);

    const orgData = result.rows.map(user => ({
      id: user.id,
      name: user.name,
      title: user.title,
      managerId: user.managerId,
      avatar: user.avatar,
      email: user.email,
    }));

    // Cache the result
    set(CacheKeys.orgChart(), orgData, 300); // 5 minutes

    res.json({
      status: 'success',
      data: orgData,
    });
  } catch (error) {
    console.error('Org chart error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch org chart',
      error: error.message,
    });
  }
});

// Get profile schema
router.get('/profile-schema', async (req, res) => {
  try {
    const { query } = require('../database');
    const { get, set, CacheKeys } = require('../cache');
    
    // Check cache first
    const cached = get(CacheKeys.profileFields());
    if (cached) {
      return res.json({
        status: 'success',
        data: cached,
      });
    }

    // Fetch from database
    const result = await query(`
      SELECT 
        slack_field_id as id,
        label,
        hint,
        type,
        is_editable,
        raw
      FROM profile_fields 
      ORDER BY label
    `);

    const schema = result.rows.map(field => ({
      id: field.id,
      label: field.label,
      hint: field.hint,
      type: field.type,
      isEditable: field.is_editable,
      raw: field.raw,
    }));

    // Cache the result
    set(CacheKeys.profileFields(), schema, 600); // 10 minutes

    res.json({
      status: 'success',
      data: schema,
    });
  } catch (error) {
    console.error('Profile schema error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch profile schema',
      error: error.message,
    });
  }
});

// Get staged changes diff
router.get('/diff', async (req, res) => {
  try {
    const { query } = require('../database');
    
    const result = await query(`
      SELECT 
        dc.*,
        u.real_name as user_name,
        u.email as user_email
      FROM draft_changes dc
      JOIN users u ON dc.slack_user_id = u.slack_user_id
      WHERE dc.status = 'staged'
      ORDER BY dc.created_at DESC
    `);

    const changes = result.rows.map(change => ({
      id: change.id,
      actorSlackUserId: change.actor_slack_user_id,
      userId: change.slack_user_id,
      userName: change.user_name,
      userEmail: change.user_email,
      changeType: change.change_type,
      payloadBefore: change.payload_before,
      payloadAfter: change.payload_after,
      status: change.status,
      createdAt: change.created_at,
      appliedAt: change.applied_at,
      errorMessage: change.error_message,
    }));

    res.json({
      status: 'success',
      data: changes,
    });
  } catch (error) {
    console.error('Diff error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch staged changes',
      error: error.message,
    });
  }
});

// Get audit logs
router.get('/audit', async (req, res) => {
  try {
    const { query } = require('../database');
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    
    const result = await query(`
      SELECT 
        al.*,
        u.real_name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_slack_user_id = u.slack_user_id
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [limit]);

    const logs = result.rows.map(log => ({
      id: log.id,
      actorSlackUserId: log.actor_slack_user_id,
      actorName: log.actor_name,
      action: log.action,
      details: log.details,
      createdAt: log.created_at,
    }));

    res.json({
      status: 'success',
      data: logs,
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch audit logs',
      error: error.message,
    });
  }
});

module.exports = router;
