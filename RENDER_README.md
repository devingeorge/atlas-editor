# Atlas Editor - Render Deployment

## 🚀 **Quick Deploy to Render**

### **Prerequisites**
- GitHub account
- Render account
- Slack workspace with admin access

### **1. Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/atlas-editor.git
git push -u origin main
```

### **2. Deploy to Render**

#### **Option A: Using render.yaml (Recommended)**
1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. Click **"Apply"**

#### **Option B: Manual Setup**
1. **Create PostgreSQL Database:**
   - **"New +"** → **"PostgreSQL"**
   - **Name:** `atlas-editor-db`
   - **Database:** `atlas_editor`
   - **User:** `atlas_user`

2. **Create Web Service:**
   - **"New +"** → **"Web Service"**
   - **Connect GitHub repository**
   - **Name:** `atlas-editor-api`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

3. **Create Static Site (Optional):**
   - **"New +"** → **"Static Site"**
   - **Connect GitHub repository**
   - **Name:** `atlas-editor-frontend`
   - **Build Command:** `cd app && npm install && npm run build`
   - **Publish Directory:** `app/dist`

### **3. Configure Environment Variables**

In your Render web service, add these environment variables:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=https://atlas-editor-api.onrender.com/auth/slack/callback
SESSION_SECRET=your-super-secure-session-secret-here
FRONTEND_URL=https://atlas-editor-frontend.onrender.com
```

**Note:** `DATABASE_URL` is automatically set by Render when you connect the database.

### **4. Update Slack App**

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Select your Atlas Editor app
3. Go to **"OAuth & Permissions"**
4. Update **Redirect URLs:**
   - `https://atlas-editor-api.onrender.com/auth/slack/callback`
   - `http://localhost:3001/auth/slack/callback` (for development)

### **5. Test Deployment**

1. Visit your Render web service URL
2. You should be redirected to Slack OAuth
3. Authorize the app
4. You'll be redirected back to Atlas Editor

## 🔧 **Render Configuration Details**

### **Web Service Settings**
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Port:** `3001`
- **Environment:** `Node`

### **Database Settings**
- **Type:** PostgreSQL
- **Plan:** Free (1GB storage)
- **Region:** Choose closest to your users

### **Static Site Settings**
- **Build Command:** `cd app && npm install && npm run build`
- **Publish Directory:** `app/dist`
- **Environment Variable:** `VITE_API_URL=https://atlas-editor-api.onrender.com`

## 🌐 **Render URLs**

After deployment:
- **API:** `https://atlas-editor-api.onrender.com`
- **Frontend:** `https://atlas-editor-frontend.onrender.com`
- **Database:** Internal connection (automatic)

## 💰 **Render Pricing**

### **Free Tier (Perfect for Testing)**
- **Web Service:** 750 hours/month
- **PostgreSQL:** 1GB storage
- **Static Site:** Unlimited bandwidth

### **Paid Plans (For Production)**
- **Starter:** $7/month per service
- **Standard:** $25/month per service
- **Pro:** $85/month per service

## 🔒 **Security Notes**

- Render provides HTTPS automatically
- Database connections are encrypted
- Environment variables are secure
- No public access to database

## 🐛 **Troubleshooting**

### **Common Issues:**

**Build Fails:**
- Check build logs in Render dashboard
- Ensure all dependencies are in `package.json`

**Database Connection Fails:**
- Verify `DATABASE_URL` is set correctly
- Check database is running

**OAuth Redirect Fails:**
- Ensure Slack app URLs match Render URLs
- Check `SLACK_REDIRECT_URI` environment variable

**Frontend Can't Connect to API:**
- Verify `VITE_API_URL` is set correctly
- Check CORS configuration

## 📊 **Monitoring**

Render provides built-in monitoring:
- **Logs:** Real-time application logs
- **Metrics:** CPU, memory, response times
- **Alerts:** Automatic error notifications

## 🚀 **Scaling**

Render automatically handles:
- **Load balancing**
- **SSL certificates**
- **CDN for static assets**
- **Database backups**

## 🎯 **Next Steps**

1. **Deploy to Render**
2. **Configure environment variables**
3. **Update Slack app URLs**
4. **Test OAuth flow**
5. **Set up custom domain (optional)**
6. **Configure monitoring alerts**

Your Atlas Editor will be live on Render with automatic scaling, SSL, and monitoring! 🎉
