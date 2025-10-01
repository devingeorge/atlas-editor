# Slack App Setup Guide for Atlas Editor

This guide will walk you through creating and configuring your Slack app with all the required permissions for Atlas Editor.

## Prerequisites

- Slack workspace with **Business+** or **Enterprise Grid** plan (SCIM required)
- Admin access to your Slack workspace
- Domain where you'll host the app (or localhost for development)

## Step 1: Create Your Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From an app manifest"**
4. Select your workspace
5. Copy and paste the contents of `slack-app-manifest.yaml` (or `slack-app-manifest.json`)
6. Click **"Next"** and review the configuration
7. Click **"Create"**

## Step 2: Configure Your App Settings

### 2A: Update Redirect URLs

In your app settings, go to **"OAuth & Permissions"** and update the redirect URLs:

**For Development:**
- `http://localhost:3001/auth/slack/callback`

**For Production:**
- `https://your-domain.com/auth/slack/callback`

### 2B: Install App to Workspace

1. Go to **"Install App"** in the left sidebar
2. Click **"Install to Workspace"**
3. Review the permissions and click **"Allow"**

## Step 3: Get Your Tokens

After installation, you'll find your tokens in the **"OAuth & Permissions"** section:

### Bot User OAuth Token
- Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)
- This goes in your `.env` file as `SLACK_BOT_TOKEN`

### SCIM Token
1. Go to **"SCIM"** in the left sidebar
2. Click **"Generate Token"** (if not already generated)
3. Copy the SCIM token
4. This goes in your `.env` file as `SCIM_TOKEN`

## Step 4: Required Permissions Explained

### Bot Token Scopes
- `users:read` - Read user information
- `users:read.email` - Read user email addresses
- `team:read` - Read team information
- `users.profile:read` - Read user profile fields
- `users.profile:write` - Write user profile fields

### User Token Scopes
- `users.profile:read` - Read current user's profile
- `users.profile:write` - Write current user's profile

### OAuth Configuration
The app uses OAuth for user authentication and SCIM access:

1. **OAuth Scopes in Manifest**:
   - User scopes: `users.profile:read`, `users.profile:write`
   - Bot scopes: `users:read`, `users:read.email`, `team:read`, `users.profile:read`, `users.profile:write`
   - No admin scopes needed - SCIM access is handled through user OAuth tokens

2. **OAuth Flow**:
   - Users authenticate through Slack OAuth
   - App receives access tokens for SCIM API calls
   - Tokens are stored securely in the database
   - Automatic token refresh when needed

3. **SCIM Access**:
   - SCIM API calls use the user's OAuth token
   - No separate SCIM token required
   - Direct API calls for better performance and control

## Step 5: OAuth Configuration

**No admin approval needed!** The OAuth-based approach eliminates the need for admin approval.

1. **Install App to Workspace**:
   - Go to **"Install App"** in the left sidebar
   - Click **"Install to Workspace"**
   - Review the permissions and click **"Allow"**

2. **Get OAuth Credentials**:
   - In **"OAuth & Permissions"**, copy your **Client ID** and **Client Secret**
   - These go in your `.env` file as `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`

## Step 6: Test Your Setup

### 6A: Test Bot Token
```bash
curl -H "Authorization: Bearer YOUR_BOT_TOKEN" \
     https://slack.com/api/auth.test
```

### 6B: Test OAuth Flow
1. Start your application: `npm run dev`
2. Visit `http://localhost:5173`
3. You should be redirected to Slack OAuth
4. After authorization, you'll be redirected back to the app

## Step 7: Update Your Environment

Add your credentials to your `.env` file:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:3001/auth/slack/callback
```

## Troubleshooting

### Common Issues

**"Missing required scope"**
- Ensure all scopes are properly configured in the manifest
- Reinstall the app after making scope changes

**"SCIM not available"**
- Verify your workspace has Business+ or Enterprise Grid
- Check that SCIM is enabled in admin settings

**"App not approved"**
- Contact your workspace admin for Enterprise Grid approval
- Ensure SCIM permissions are granted

**"Invalid token"**
- Regenerate tokens if they're expired
- Check token format (Bot tokens start with `xoxb-`)

### Testing Commands

Test your SCIM access:
```bash
# Get first 10 users
curl -H "Authorization: Bearer YOUR_SCIM_TOKEN" \
     "https://api.slack.com/scim/v1/Users?count=10"
```

Test your Bot API access:
```bash
# Get team profile fields
curl -H "Authorization: Bearer YOUR_BOT_TOKEN" \
     "https://slack.com/api/team.profile.get"
```

## Security Notes

- **Never commit tokens** to version control
- **Use environment variables** for all sensitive data
- **Rotate tokens regularly** in production
- **Monitor API usage** for unusual activity
- **Use HTTPS** in production environments

## Next Steps

Once your Slack app is configured:

1. Update your `.env` file with the tokens
2. Set up your database (PostgreSQL or SQLite)
3. Run `npm run dev` to start the application
4. Visit `http://localhost:5173`
5. Click "Sync Data" to pull your organization

## Support

If you encounter issues:

1. Check the Slack API documentation
2. Verify your workspace plan includes SCIM
3. Ensure admin approval is granted
4. Review the troubleshooting section above
5. Check the application logs for detailed error messages
