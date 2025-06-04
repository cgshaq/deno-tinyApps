import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

interface AppMetadata {
  title: string;
  description: string;
  icon: string;
  created: string;
  modified: string;
  visit_count: number;
  color: string;
  category: string;
  tags: string[];
  path: string;
}

interface NotesRecord {
  id: number;
  note_title: string;
  note_content: string;
  created_at: string;
  updated_at: string;
}

class AppHub {
  private apps: Map<string, AppMetadata> = new Map();
  private appsFolder = "tiny_Apps";
  private dbClient: Client | null = null;

  constructor() {
    this.initDatabase();
  }

  private async initDatabase() {
    try {
      const databaseUrl = Deno.env.get("DATABASE_URL");
      if (!databaseUrl) {
        console.error("DATABASE_URL environment variable not set");
        return;
      }

      this.dbClient = new Client(databaseUrl);
      await this.dbClient.connect();
      
      // Initialize schema
      await this.dbClient.queryObject(`
        CREATE TABLE IF NOT EXISTS notes_records (
          id SERIAL PRIMARY KEY,
          note_title VARCHAR(255) NOT NULL,
          note_content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_notes_records_created_at ON notes_records(created_at DESC);
      `);
      
      console.log("Database schema initialized successfully");
    } catch (error) {
      console.error("Failed to initialize database:", error);
      this.dbClient = null;
    }
  }

  async scanApps(): Promise<void> {
    this.apps.clear();

    try {
      const appsFolderExists = await Deno.stat(this.appsFolder).catch(() => null);
      if (!appsFolderExists) {
        console.log(`Creating ${this.appsFolder} directory`);
        await Deno.mkdir(this.appsFolder, { recursive: true });
        return;
      }

      for await (const dirEntry of Deno.readDir(this.appsFolder)) {
        if (dirEntry.isDirectory) {
          const appPath = `${this.appsFolder}/${dirEntry.name}`;
          const indexPath = `${appPath}/index.html`;
          const metadataPath = `${appPath}/app-metadata.json`;

          try {
            await Deno.stat(indexPath);
            
            // Default metadata
            let metadata: AppMetadata = {
              title: dirEntry.name,
              description: "A tiny app",
              icon: "mdi:application",
              created: new Date().toISOString(),
              modified: new Date().toISOString(),
              visit_count: 0,
              color: "#3498db",
              category: "General",
              tags: [],
              path: dirEntry.name,
            };

            // Try to load custom metadata
            try {
              const metadataContent = await Deno.readTextFile(metadataPath);
              const customMetadata = JSON.parse(metadataContent);
              metadata = { ...metadata, ...customMetadata, path: dirEntry.name };
            } catch {
              // Use default metadata if file doesn't exist or is invalid
            }

            this.apps.set(dirEntry.name, metadata);
            console.log(`Discovered app: ${dirEntry.name}`);
          } catch {
            // Skip directories without index.html
          }
        }
      }
    } catch (error) {
      console.error("Error scanning apps:", error);
    }
  }

  async getApps(): Promise<AppMetadata[]> {
    await this.scanApps();
    return Array.from(this.apps.values());
  }

  async visitApp(appName: string): Promise<string | null> {
    if (this.apps.has(appName)) {
      const app = this.apps.get(appName)!;
      app.visit_count++;
    }

    try {
      const appPath = `${this.appsFolder}/${appName}/index.html`;
      const content = await Deno.readTextFile(appPath);
      
      // Add base tag for relative paths
      const baseTag = `<base href="/app/${appName}/">`;
      if (content.includes("<head>")) {
        return content.replace("<head>", `<head>\n    ${baseTag}`);
      }
      
      return content;
    } catch {
      return null;
    }
  }

  async serveStaticFile(appName: string, filePath: string): Promise<{ content: Uint8Array; contentType: string } | null> {
    try {
      const fullPath = `${this.appsFolder}/${appName}/${filePath}`;
      const content = await Deno.readFile(fullPath);
      
      // Determine content type
      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
      };
      
      const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';
      
      return { content, contentType };
    } catch {
      return null;
    }
  }

  // Notes API methods
  async getAllNotes(): Promise<NotesRecord[]> {
    if (!this.dbClient) return [];

    try {
      const result = await this.dbClient.queryObject<NotesRecord>(
        "SELECT * FROM notes_records ORDER BY created_at DESC"
      );
      return result.rows;
    } catch (error) {
      console.error("Error fetching notes:", error);
      return [];
    }
  }

  async createNote(title: string, content: string): Promise<NotesRecord | null> {
    if (!this.dbClient) return null;

    try {
      const result = await this.dbClient.queryObject<NotesRecord>(
        "INSERT INTO notes_records (note_title, note_content) VALUES ($1, $2) RETURNING *",
        [title, content]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error creating note:", error);
      return null;
    }
  }

  async updateNote(id: number, title: string, content: string): Promise<NotesRecord | null> {
    if (!this.dbClient) return null;

    try {
      const result = await this.dbClient.queryObject<NotesRecord>(
        "UPDATE notes_records SET note_title = $1, note_content = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
        [title, content, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error updating note:", error);
      return null;
    }
  }

  async deleteNote(id: number): Promise<boolean> {
    if (!this.dbClient) return false;

    try {
      const result = await this.dbClient.queryObject(
        "DELETE FROM notes_records WHERE id = $1",
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting note:", error);
      return false;
    }
  }
}

// Initialize app hub
const appHub = new AppHub();

// Create router
const router = new Router();

// Apps API
router.get("/api/apps", async (ctx) => {
  const apps = await appHub.getApps();
  ctx.response.body = apps;
});

// Notes API
router.get("/api/notes", async (ctx) => {
  const notes = await appHub.getAllNotes();
  ctx.response.body = notes;
});

router.post("/api/notes", async (ctx) => {
  const body = await ctx.request.body().value;
  const { title, content } = body;
  
  if (!title || !content) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Title and content are required" };
    return;
  }
  
  const note = await appHub.createNote(title, content);
  if (note) {
    ctx.response.body = note;
  } else {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create note" };
  }
});

router.put("/api/notes/:id", async (ctx) => {
  const id = parseInt(ctx.params.id);
  const body = await ctx.request.body().value;
  const { title, content } = body;
  
  if (!title || !content) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Title and content are required" };
    return;
  }
  
  const note = await appHub.updateNote(id, title, content);
  if (note) {
    ctx.response.body = note;
  } else {
    ctx.response.status = 404;
    ctx.response.body = { error: "Note not found" };
  }
});

router.delete("/api/notes/:id", async (ctx) => {
  const id = parseInt(ctx.params.id);
  const success = await appHub.deleteNote(id);
  
  if (success) {
    ctx.response.body = { message: "Note deleted successfully" };
  } else {
    ctx.response.status = 404;
    ctx.response.body = { error: "Note not found" };
  }
});

// App routes
router.get("/app/:appName", async (ctx) => {
  const appName = ctx.params.appName;
  const content = await appHub.visitApp(appName);
  
  if (content) {
    ctx.response.headers.set("Content-Type", "text/html");
    ctx.response.body = content;
  } else {
    ctx.response.status = 404;
    ctx.response.body = "App not found";
  }
});

router.get("/app/:appName/:filePath+", async (ctx) => {
  const appName = ctx.params.appName;
  const filePath = ctx.params.filePath;
  
  const file = await appHub.serveStaticFile(appName, filePath);
  
  if (file) {
    ctx.response.headers.set("Content-Type", file.contentType);
    ctx.response.body = file.content;
  } else {
    ctx.response.status = 404;
    ctx.response.body = "File not found";
  }
});

// Create application
const app = new Application();

// Add CORS middleware
app.use(oakCors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

// Add router
app.use(router.routes());
app.use(router.allowedMethods());

// Serve frontend static files
app.use(async (ctx, next) => {
  if (ctx.request.url.pathname === "/") {
    try {
      const content = await Deno.readTextFile("frontend/index.html");
      ctx.response.headers.set("Content-Type", "text/html");
      ctx.response.body = content;
    } catch {
      ctx.response.status = 404;
      ctx.response.body = "Frontend not found";
    }
  } else if (ctx.request.url.pathname.startsWith("/static/")) {
    const filePath = ctx.request.url.pathname.replace("/static/", "frontend/");
    try {
      const content = await Deno.readFile(filePath);
      
      // Determine content type
      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
      };
      
      const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';
      ctx.response.headers.set("Content-Type", contentType);
      ctx.response.body = content;
    } catch {
      await next();
    }
  } else {
    await next();
  }
});

const port = 5000;
console.log(`Starting server on http://0.0.0.0:${port}`);
console.log(`App hub will scan for apps in: tiny_Apps`);

await app.listen({ hostname: "0.0.0.0", port });