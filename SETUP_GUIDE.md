# Atlas Editor - Complete Setup Guide

## 📋 **Variables You Need to Configure**

### **1. Slack App Configuration**

**App Name:** `Atlas Editor`
**Description:** `Interactive org chart editor for Slack organizations`

**Required Scopes:**
- **User Scopes:** `users.profile:read`, `users.profile:write`
- **Bot Scopes:** `users:read`, `users:read.email`, `team:read`, `users.profile:read`, `users.profile:write`

**Redirect URLs:**
- **Development:** `http://localhost:3001/auth/slack/callback`
- **Production:** `https://YOUR_PRODUCTION_DOMAIN.com/auth/slack/callback`

### **2. Environment Variables (.env file)**

```env
# Slack API Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:3001/auth/slack/callback

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/atlas_editor
# OR for SQLite development:
# DATABASE_URL=sqlite:./atlas_editor.db

# Session Configuration
SESSION_SECRET=your-random-session-secret-here

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cache Configuration
CACHE_TTL_SECONDS=300
```

### **3. Production Configuration**

**For Production, update these variables:**

```env
# Production Environment
NODE_ENV=production
FRONTEND_URL=https://YOUR_PRODUCTION_DOMAIN.com
SLACK_REDIRECT_URI=https://YOUR_PRODUCTION_DOMAIN.com/auth/slack/callback

# Production Database
DATABASE_URL=postgresql://prod_user:prod_password@prod_host:5432/atlas_editor

# Production Session Secret (generate a secure one)
SESSION_SECRET=your-super-secure-production-session-secret
```

## 🚀 **Step-by-Step Setup**

### **Step 1: Create Slack App**

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From an app manifest"**
3. Select your workspace
4. Copy and paste the manifest from `slack-app-manifest.json`
5. **Replace `YOUR_PRODUCTION_DOMAIN`** with your actual domain
6. Click **"Create"**

### **Step 2: Install App**

1. Go to **"Install App"** in the left sidebar
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**

### **Step 3: Get Credentials**

1. In **"OAuth & Permissions"**, copy:
   - **Client ID** → `SLACK_CLIENT_ID`
   - **Client Secret** → `SLACK_CLIENT_SECRET`
   - **Bot User OAuth Token** → `SLACK_BOT_TOKEN`

### **Step 4: Configure Environment**

1. Copy `env.example` to `.env`
2. Fill in your Slack credentials
3. Generate a session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### **Step 5: Set Up Database**

**Option A: PostgreSQL (Recommended)**
```bash
# Install PostgreSQL
brew install postgresql
brew services start postgresql

# Create database
createdb atlas_editor
```

**Option B: SQLite (Development)**
```bash
# Just update DATABASE_URL in .env
DATABASE_URL=sqlite:./atlas_editor.db
```

### **Step 6: Start Application**

```bash
# Install dependencies
npm run setup

# Start development servers
npm run dev
```

### **Step 7: Test OAuth Flow**

1. Visit `http://localhost:5173`
2. You should be redirected to Slack OAuth
3. Authorize the app
4. You'll be redirected back to Atlas Editor

## 🔧 **Configuration Checklist**

- [ ] Slack app created with manifest
- [ ] App installed to workspace
- [ ] OAuth credentials copied
- [ ] `.env` file configured
- [ ] Database set up
- [ ] Session secret generated
- [ ] Application started
- [ ] OAuth flow tested

## 🌐 **Production Deployment**

### **Required Changes for Production:**

1. **Update Redirect URLs:**
   - Add your production domain to Slack app settings
   - Update `SLACK_REDIRECT_URI` in `.env`

2. **Database:**
   - Use PostgreSQL in production
   - Set up proper connection string

3. **Security:**
   - Use HTTPS
   - Generate secure session secret
   - Set `NODE_ENV=production`

4. **Domain Configuration:**
   - Update `FRONTEND_URL` to your production domain
   - Update `SLACK_REDIRECT_URI` to your production domain

## 🐛 **Troubleshooting**

### **Common Issues:**

**OAuth Redirect Mismatch:**
- Ensure redirect URLs match exactly in Slack app settings
- Check `SLACK_REDIRECT_URI` in `.env`

**Database Connection:**
- Verify `DATABASE_URL` format
- Ensure database exists and is accessible

**Token Issues:**
- Check `SLACK_BOT_TOKEN` format (starts with `xoxb-`)
- Verify `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`

**Session Issues:**
- Ensure `SESSION_SECRET` is set
- Check session configuration

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section
2. Review error logs in the console
3. Verify all environment variables are set
4. Test OAuth flow step by step

## 🎉 **You're Ready!**

Once configured, Atlas Editor will:
- Authenticate users via Slack OAuth
- Sync organization data via SCIM
- Provide interactive org chart editing
- Handle profile field updates
- Track all changes with audit logging
