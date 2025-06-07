# Tiny Apps Hub - Deno TypeScript

A dynamic web application hub built with Deno and TypeScript that automatically discovers and serves HTML apps from a folder structure.

## Project Structure

```
├── backend/          # Deno TypeScript server
│   └── main.ts      # Main server application
├── frontend/         # Static frontend files
│   └── index.html   # Main hub interface
├── tiny_Apps/        # Apps directory (auto-discovered)
│   ├── notes/       
│   ├── bookmarks-hub/
│   └── ...
└── deno.json        # Deno configuration
```

## Features

- **Auto-discovery**: Automatically scans `tiny_Apps` folder for HTML applications
- **Replit Key-Value Store**: Notes and Kanban APIs backed by Replit's built-in database
- **TypeScript**: Full TypeScript support with Deno
- **CORS Support**: Cross-origin requests enabled
- **Static File Serving**: Serves app assets with proper MIME types
- **Visit Tracking**: Tracks app usage statistics

## API Endpoints

- `GET /api/apps` - List all discovered apps
- `GET /api/notes` - Get all notes
- `POST /api/notes` - Create a new note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note
- `GET /app/:appName` - Visit an app
- `GET /app/:appName/*` - Serve app static files

## Development

```bash
# Start the server
deno task start

# Start with auto-reload during development
deno task dev
```

## App Structure

Each app in `tiny_Apps` should have:
- `index.html` - Main app file (required)
- `app-metadata.json` - App metadata (optional)

Example metadata:
```json
{
  "title": "My App",
  "description": "A sample application",
  "icon": "mdi:application",
  "color": "#3498db",
  "category": "Tools",
  "tags": ["utility", "tool"]
}
```

## Environment Variables

When running on Replit the database URL is provided automatically as `REPLIT_DB_URL`. If running locally you can export this variable with the connection string from your Replit workspace.

