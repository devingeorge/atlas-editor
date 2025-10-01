const { Pool } = require('pg');
const path = require('path');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }
  
  return pool;
}

async function initializeDatabase() {
  const pool = getPool();
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    
    // Create tables if they don't exist
    await createTables();
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function createTables() {
  const pool = getPool();
  
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slack_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      real_name TEXT,
      title TEXT,
      manager_slack_user_id TEXT,
      active BOOLEAN DEFAULT true,
      avatar_url TEXT,
      raw_scim JSONB,
      raw_profile JSONB,
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_slack_user_id ON users(slack_user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_slack_user_id);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
  `;

  const createProfileFieldsTable = `
    CREATE TABLE IF NOT EXISTS profile_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slack_field_id TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      hint TEXT,
      type TEXT NOT NULL,
      is_editable BOOLEAN DEFAULT true,
      raw JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_profile_fields_slack_field_id ON profile_fields(slack_field_id);
    CREATE INDEX IF NOT EXISTS idx_profile_fields_editable ON profile_fields(is_editable);
  `;

  const createDraftChangesTable = `
    CREATE TABLE IF NOT EXISTS draft_changes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_slack_user_id TEXT NOT NULL,
      slack_user_id TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK (change_type IN ('manager', 'profile')),
      payload_before JSONB NOT NULL,
      payload_after JSONB NOT NULL,
      status TEXT DEFAULT 'staged' CHECK (status IN ('staged', 'applied', 'failed', 'reverted')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      applied_at TIMESTAMPTZ,
      error_message TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_draft_changes_actor ON draft_changes(actor_slack_user_id);
    CREATE INDEX IF NOT EXISTS idx_draft_changes_user ON draft_changes(slack_user_id);
    CREATE INDEX IF NOT EXISTS idx_draft_changes_status ON draft_changes(status);
    CREATE INDEX IF NOT EXISTS idx_draft_changes_type ON draft_changes(change_type);
  `;

  const createAuditLogsTable = `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_slack_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_slack_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  `;

  const createLocksTable = `
    CREATE TABLE IF NOT EXISTS locks (
      resource TEXT PRIMARY KEY,
      locked_by TEXT NOT NULL,
      locked_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const createOAuthTokensTable = `
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slack_user_id TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT DEFAULT 'Bearer',
      scope TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_slack_user_id ON oauth_tokens(slack_user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
  `;

  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid VARCHAR NOT NULL COLLATE "default",
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_user_sessions_sid ON user_sessions(sid);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);
  `;

  await pool.query(createUsersTable);
  await pool.query(createProfileFieldsTable);
  await pool.query(createDraftChangesTable);
  await pool.query(createAuditLogsTable);
  await pool.query(createLocksTable);
  await pool.query(createOAuthTokensTable);
  await pool.query(createSessionsTable);
}

async function query(text, params = []) {
  const pool = getPool();
  return await pool.query(text, params);
}

async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getPool,
  initializeDatabase,
  query,
  transaction,
};
