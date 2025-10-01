# Atlas Editor

A Slack Atlas-style org chart editor that allows you to visualize and edit your Slack organization structure with drag-and-drop manager changes and profile field editing.

## Features

- **Interactive Org Chart**: Visualize your Slack organization as a hierarchical tree
- **Drag & Drop Manager Changes**: Move users under new managers by dragging nodes
- **Profile Field Editing**: Edit custom profile fields in a side panel
- **Staged Changes**: Preview changes before applying them to Slack
- **Audit Logging**: Track all changes with full audit trail
- **Undo Support**: Revert applied changes if needed
- **Real-time Sync**: Sync with Slack SCIM and Web API

## Prerequisites

### Slack Requirements
- **Plan**: Business+ or Enterprise Grid (SCIM required)
- **Admin Approval**: App must be approved with SCIM write permissions
- **Scopes**:
  - SCIM: `scim:read`, `scim:write` (org-level)
  - Web API: `users.profile:read`, `users.profile:write`
  - Optional: `users:read` (for photos/display names)

### Development Requirements
- Node.js 18+
- PostgreSQL (or SQLite for development)
- Slack app with proper tokens

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd atlas-editor
npm run setup
```

### 2. Environment Configuration

Copy the example environment file and configure your tokens:

```bash
cp env.example .env
```

Edit `.env` with your Slack tokens:

```env
# Slack API Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SCIM_TOKEN=your-scim-token-here

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/atlas_editor

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-here

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 3. Database Setup

The application will automatically create the required tables on first run. For PostgreSQL:

```bash
createdb atlas_editor
```

### 4. Start Development Servers

```bash
npm run dev
```

This will start:
- API server on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

## Usage

### 1. Initial Sync

Visit `http://localhost:5173` and click "Sync Data" to pull your Slack organization data.

### 2. Navigate the Org Chart

- **Search**: Use the search bar to find users by name, email, or title
- **Select**: Click on any user node to view their details
- **Zoom**: Use mouse wheel or controls to zoom in/out
- **Pan**: Drag the canvas to move around

### 3. Edit Manager Relationships

- **Drag & Drop**: Drag a user node onto another user to change their manager
- **Preview**: Changes are staged and shown in the diff bar at the bottom
- **Apply**: Click "Apply All Changes" to push changes to Slack

### 4. Edit Profile Fields

- **Select User**: Click on a user to open the profile panel
- **Edit Fields**: Modify editable profile fields
- **Save**: Changes are automatically staged
- **Apply**: Use the diff bar to apply all staged changes

### 5. Manage Changes

- **Staged Changes**: Preview all pending changes in the diff bar
- **Apply**: Push all staged changes to Slack
- **Revert**: Undo previously applied changes
- **Audit**: View change history and audit logs

## API Endpoints

### Core Endpoints
- `GET /api/bootstrap` - App initialization data
- `GET /api/org` - Organization chart data
- `GET /api/profile-schema` - Editable profile fields
- `GET /api/diff` - Staged changes
- `GET /api/audit` - Audit logs

### Staging Endpoints
- `POST /api/stage/manager-move` - Stage manager change
- `POST /api/stage/profile-update` - Stage profile update

### Action Endpoints
- `POST /api/apply` - Apply all staged changes
- `POST /api/revert/:changeId` - Revert specific change

### Sync Endpoints
- `POST /sync/scim-users` - Sync SCIM user data
- `POST /sync/profile-schema` - Sync profile field schema
- `POST /sync/full` - Full sync (both SCIM and schema)

## Architecture

### Backend (Node.js/Express)
- **Database**: PostgreSQL with automatic schema creation
- **Cache**: In-memory LRU cache for frequent lookups
- **API**: RESTful API with proper error handling
- **Auth**: Session-based authentication (extensible to OAuth)

### Frontend (React/Vite)
- **Org Chart**: ReactFlow for interactive tree visualization
- **Drag & Drop**: Native HTML5 drag and drop for manager changes
- **State Management**: React hooks for local state
- **UI**: Custom CSS with responsive design

### Data Flow
1. **Sync**: Pull data from Slack SCIM and Web API
2. **Stage**: User changes are stored as draft records
3. **Apply**: Batch apply changes with dependency resolution
4. **Audit**: Log all changes for compliance

## Security & Governance

- **Role-based Access**: Editor/Viewer roles (extensible)
- **Audit Logging**: Complete change history with actor tracking
- **Cycle Detection**: Prevents invalid manager relationships
- **HRIS Integration**: Respects field ownership policies
- **Rate Limiting**: Built-in API rate limiting
- **CSRF Protection**: Session-based CSRF protection

## Development

### Project Structure
```
atlas-editor/
├── api/                 # Backend API
│   ├── routes/         # API route handlers
│   ├── services/       # External service integrations
│   ├── database.js     # Database connection and schema
│   ├── cache.js        # Caching layer
│   └── server.js       # Express server setup
├── app/                # Frontend React app
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── App.jsx     # Main app component
│   │   └── App.css     # Styles
│   └── package.json    # Frontend dependencies
└── package.json        # Backend dependencies
```

### Adding New Features

1. **Backend**: Add routes in `api/routes/`
2. **Frontend**: Add components in `app/src/components/`
3. **Database**: Modify schema in `api/database.js`
4. **API**: Update service integrations in `api/services/`

### Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd app && npm test
```

## Deployment

### Production Environment

1. **Database**: Use PostgreSQL in production
2. **Environment**: Set `NODE_ENV=production`
3. **Security**: Use proper session secrets and HTTPS
4. **Monitoring**: Add logging and monitoring
5. **Scaling**: Consider Redis for session storage

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Slack Connection Failed**
   - Verify tokens are correct
   - Check Slack app permissions
   - Ensure SCIM is enabled

2. **Database Connection Error**
   - Verify DATABASE_URL format
   - Check PostgreSQL is running
   - Ensure database exists

3. **Sync Issues**
   - Check rate limiting
   - Verify SCIM permissions
   - Review error logs

### Debug Mode

Set `NODE_ENV=development` for detailed error messages and logging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review Slack API documentation
