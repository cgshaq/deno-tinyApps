# Managing the Replit Key-Value Store

This project uses Replit's built-in Key-Value Store instead of a SQL database. You can inspect and manage the stored data from your browser.

## Viewing tables

1. Start the server with `deno task start` (or `deno task dev` during development).
2. Open `http://localhost:5000/database` in your browser.
3. The page lists all tables (keys) used by the app. Click a table to view its contents.

## Deleting data

### From the Database Viewer

- Within the table view, delete individual records by removing them from the array in the Replit database sidebar, or use the Key-Value Store tool in your Replit workspace.
- To clear an entire table, open the Replit workspace sidebar, locate the Key-Value Store, and delete the relevant key (`notes_records` or `kanban_tasks`).

### Using the HTTP API

You can also manipulate keys directly with HTTP requests when running inside Replit:

```bash
# Delete a specific key
curl -XDELETE "$REPLIT_DB_URL/notes_records"
```

Replace `notes_records` with the key you want to remove. Be careful&mdash;this cannot be undone.
