const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const { query, transaction } = require('../database');
const { del, CacheKeys } = require('../cache');

// Validation schemas
const managerMoveSchema = Joi.object({
  userId: Joi.string().required(),
  oldManagerId: Joi.string().allow(null).required(),
  newManagerId: Joi.string().allow(null).required(),
});

const profileUpdateSchema = Joi.object({
  userId: Joi.string().required(),
  fields: Joi.object().required(),
});

// Stage manager move
router.post('/stage/manager-move', async (req, res) => {
  try {
    const { error, value } = managerMoveSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request data',
        details: error.details,
      });
    }

    const { userId, oldManagerId, newManagerId } = value;
    const actorSlackUserId = req.session.slackUserId || 'system';

    // Check for cycles
    if (newManagerId && await wouldCreateCycle(userId, newManagerId)) {
      return res.status(400).json({
        status: 'error',
        message: 'This change would create a cycle in the org chart',
      });
    }

    // Check if user exists
    const userResult = await query(
      'SELECT slack_user_id FROM users WHERE slack_user_id = $1 AND active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Check if new manager exists (if provided)
    if (newManagerId) {
      const managerResult = await query(
        'SELECT slack_user_id FROM users WHERE slack_user_id = $1 AND active = true',
        [newManagerId]
      );

      if (managerResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'New manager not found',
        });
      }
    }

    // Create draft change
    const result = await query(`
      INSERT INTO draft_changes (
        actor_slack_user_id,
        slack_user_id,
        change_type,
        payload_before,
        payload_after,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      actorSlackUserId,
      userId,
      'manager',
      JSON.stringify({ manager: oldManagerId }),
      JSON.stringify({ manager: newManagerId }),
      'staged',
    ]);

    // Clear cache
    del(CacheKeys.draftChanges(actorSlackUserId));

    res.json({
      status: 'success',
      data: {
        changeId: result.rows[0].id,
        message: 'Manager change staged successfully',
      },
    });
  } catch (error) {
    console.error('Stage manager move error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to stage manager change',
      error: error.message,
    });
  }
});

// Stage profile update
router.post('/stage/profile-update', async (req, res) => {
  try {
    const { error, value } = profileUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request data',
        details: error.details,
      });
    }

    const { userId, fields } = value;
    const actorSlackUserId = req.session.slackUserId || 'system';

    // Validate that all fields are editable
    const editableFields = await query(`
      SELECT slack_field_id FROM profile_fields 
      WHERE slack_field_id = ANY($1) AND is_editable = true
    `, [Object.keys(fields)]);

    const editableFieldIds = editableFields.rows.map(row => row.slack_field_id);
    const nonEditableFields = Object.keys(fields).filter(id => !editableFieldIds.includes(id));

    if (nonEditableFields.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Some fields are not editable',
        nonEditableFields,
      });
    }

    // Get current profile values
    const currentResult = await query(
      'SELECT raw_profile FROM users WHERE slack_user_id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const currentProfile = currentResult.rows[0].raw_profile || {};
    const currentFields = currentProfile.fields || {};

    // Build before/after payloads
    const payloadBefore = { fields: {} };
    const payloadAfter = { fields: {} };

    Object.keys(fields).forEach(fieldId => {
      payloadBefore.fields[fieldId] = currentFields[fieldId] || { value: '' };
      payloadAfter.fields[fieldId] = fields[fieldId];
    });

    // Create draft change
    const result = await query(`
      INSERT INTO draft_changes (
        actor_slack_user_id,
        slack_user_id,
        change_type,
        payload_before,
        payload_after,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      actorSlackUserId,
      userId,
      'profile',
      JSON.stringify(payloadBefore),
      JSON.stringify(payloadAfter),
      'staged',
    ]);

    // Clear cache
    del(CacheKeys.draftChanges(actorSlackUserId));

    res.json({
      status: 'success',
      data: {
        changeId: result.rows[0].id,
        message: 'Profile update staged successfully',
      },
    });
  } catch (error) {
    console.error('Stage profile update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to stage profile update',
      error: error.message,
    });
  }
});

// Apply all staged changes
router.post('/apply', async (req, res) => {
  try {
    const actorSlackUserId = req.session.slackUserId || 'system';
    
    // Get all staged changes
    const changesResult = await query(`
      SELECT * FROM draft_changes 
      WHERE status = 'staged'
      ORDER BY change_type, created_at
    `);

    if (changesResult.rows.length === 0) {
      return res.json({
        status: 'success',
        data: {
          message: 'No staged changes to apply',
          results: [],
        },
      });
    }

    const results = await applyChanges(changesResult.rows, actorSlackUserId);

    res.json({
      status: 'success',
      data: {
        message: `Applied ${results.length} changes`,
        results,
      },
    });
  } catch (error) {
    console.error('Apply changes error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to apply changes',
      error: error.message,
    });
  }
});

// Revert a specific change
router.post('/revert/:changeId', async (req, res) => {
  try {
    const { changeId } = req.params;
    const actorSlackUserId = req.session.slackUserId || 'system';

    // Get the change
    const changeResult = await query(
      'SELECT * FROM draft_changes WHERE id = $1 AND status = $2',
      [changeId, 'applied']
    );

    if (changeResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Applied change not found',
      });
    }

    const change = changeResult.rows[0];
    const result = await revertChange(change, actorSlackUserId);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Revert change error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to revert change',
      error: error.message,
    });
  }
});

// Helper functions
async function wouldCreateCycle(userId, newManagerId) {
  // Simple cycle detection: check if newManagerId is a descendant of userId
  const visited = new Set();
  const queue = [newManagerId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    
    if (currentId === userId) {
      return true; // Cycle detected
    }
    
    if (visited.has(currentId)) {
      continue;
    }
    
    visited.add(currentId);
    
    // Get direct reports
    const reportsResult = await query(
      'SELECT slack_user_id FROM users WHERE manager_slack_user_id = $1 AND active = true',
      [currentId]
    );
    
    queue.push(...reportsResult.rows.map(row => row.slack_user_id));
  }
  
  return false;
}

async function applyChanges(changes, actorSlackUserId) {
  const SlackService = require('../services/slack');
  const slack = new SlackService();
  const results = [];

  // Group changes by type
  const managerChanges = changes.filter(c => c.change_type === 'manager');
  const profileChanges = changes.filter(c => c.change_type === 'profile');

  // Apply manager changes first
  for (const change of managerChanges) {
    try {
      const payloadAfter = JSON.parse(change.payload_after);
      await slack.updateUserManager(actorSlackUserId, change.slack_user_id, payloadAfter.manager);
      
      // Update database
      await query(
        'UPDATE users SET manager_slack_user_id = $1, updated_at = NOW() WHERE slack_user_id = $2',
        [payloadAfter.manager, change.slack_user_id]
      );
      
      // Update change status
      await query(
        'UPDATE draft_changes SET status = $1, applied_at = NOW() WHERE id = $2',
        ['applied', change.id]
      );
      
      // Log audit
      await query(`
        INSERT INTO audit_logs (actor_slack_user_id, action, details)
        VALUES ($1, $2, $3)
      `, [
        actorSlackUserId,
        'apply_change',
        JSON.stringify({
          changeId: change.id,
          changeType: 'manager',
          userId: change.slack_user_id,
          details: payloadAfter,
        }),
      ]);

      results.push({
        changeId: change.id,
        status: 'success',
        message: 'Manager change applied successfully',
      });
    } catch (error) {
      // Update change status
      await query(
        'UPDATE draft_changes SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', error.message, change.id]
      );
      
      results.push({
        changeId: change.id,
        status: 'error',
        message: error.message,
      });
    }
  }

  // Apply profile changes
  for (const change of profileChanges) {
    try {
      const payloadAfter = JSON.parse(change.payload_after);
      await slack.updateUserProfile(change.slack_user_id, payloadAfter.fields);
      
      // Update database
      await query(
        'UPDATE users SET raw_profile = $1, updated_at = NOW() WHERE slack_user_id = $2',
        [JSON.stringify(payloadAfter), change.slack_user_id]
      );
      
      // Update change status
      await query(
        'UPDATE draft_changes SET status = $1, applied_at = NOW() WHERE id = $2',
        ['applied', change.id]
      );
      
      // Log audit
      await query(`
        INSERT INTO audit_logs (actor_slack_user_id, action, details)
        VALUES ($1, $2, $3)
      `, [
        actorSlackUserId,
        'apply_change',
        JSON.stringify({
          changeId: change.id,
          changeType: 'profile',
          userId: change.slack_user_id,
          details: payloadAfter,
        }),
      ]);

      results.push({
        changeId: change.id,
        status: 'success',
        message: 'Profile change applied successfully',
      });
    } catch (error) {
      // Update change status
      await query(
        'UPDATE draft_changes SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', error.message, change.id]
      );
      
      results.push({
        changeId: change.id,
        status: 'error',
        message: error.message,
      });
    }
  }

  // Clear caches
  del(CacheKeys.orgChart());
  del(CacheKeys.draftChanges(actorSlackUserId));

  return results;
}

async function revertChange(change, actorSlackUserId) {
  const SlackService = require('../services/slack');
  const slack = new SlackService();

  try {
    const payloadBefore = JSON.parse(change.payload_before);

    if (change.change_type === 'manager') {
      await slack.updateUserManager(actorSlackUserId, change.slack_user_id, payloadBefore.manager);
      
      // Update database
      await query(
        'UPDATE users SET manager_slack_user_id = $1, updated_at = NOW() WHERE slack_user_id = $2',
        [payloadBefore.manager, change.slack_user_id]
      );
    } else if (change.change_type === 'profile') {
      await slack.updateUserProfile(change.slack_user_id, payloadBefore.fields);
      
      // Update database
      await query(
        'UPDATE users SET raw_profile = $1, updated_at = NOW() WHERE slack_user_id = $2',
        [JSON.stringify(payloadBefore), change.slack_user_id]
      );
    }

    // Update change status
    await query(
      'UPDATE draft_changes SET status = $1 WHERE id = $2',
      ['reverted', change.id]
    );

    // Log audit
    await query(`
      INSERT INTO audit_logs (actor_slack_user_id, action, details)
      VALUES ($1, $2, $3)
    `, [
      actorSlackUserId,
      'revert_change',
      JSON.stringify({
        changeId: change.id,
        changeType: change.change_type,
        userId: change.slack_user_id,
        details: payloadBefore,
      }),
    ]);

    // Clear caches
    del(CacheKeys.orgChart());
    del(CacheKeys.draftChanges(actorSlackUserId));

    return {
      changeId: change.id,
      status: 'success',
      message: 'Change reverted successfully',
    };
  } catch (error) {
    throw new Error(`Failed to revert change: ${error.message}`);
  }
}

module.exports = router;
