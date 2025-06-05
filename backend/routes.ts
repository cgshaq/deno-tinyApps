import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { AppHub } from "./app-hub.ts";
import { DatabaseManager } from "./database.ts";

export function createRouter(appHub: AppHub, db: DatabaseManager): Router {
  const router = new Router();

  // Apps API
  router.get("/api/apps", async (ctx) => {
    const apps = await appHub.getApps();
    ctx.response.body = apps;
  });

  // Notes API
  router.get("/api/notes", async (ctx) => {
    const notes = await db.getAllNotes();
    ctx.response.body = notes;
  });

  router.post("/api/notes", async (ctx) => {
    try {
      const body = await ctx.request.body({ type: "json" }).value;
      const { title, content, note_title, note_content } = body;
      
      // Support both field naming conventions
      const noteTitle = title || note_title;
      const noteContent = content || note_content;
      
      if (!noteTitle || !noteContent) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Title and content are required" };
        return;
      }
      
      const note = await db.createNote(noteTitle, noteContent);
      if (note) {
        ctx.response.status = 201;
        ctx.response.body = note;
      } else {
        ctx.response.status = 500;
        ctx.response.body = { error: "Failed to create note" };
      }
    } catch (error) {
      console.error("Error in POST /api/notes:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Internal server error" };
    }
  });

  router.put("/api/notes/:id", async (ctx) => {
    try {
      const id = parseInt(ctx.params.id);
      if (isNaN(id)) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid note ID" };
        return;
      }

      const body = await ctx.request.body({ type: "json" }).value;
      const { title, content, note_title, note_content } = body;
      
      // Support both field naming conventions
      const noteTitle = title || note_title;
      const noteContent = content || note_content;
      
      if (!noteTitle || !noteContent) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Title and content are required" };
        return;
      }
      
      const note = await db.updateNote(id, noteTitle, noteContent);
      if (note) {
        ctx.response.body = note;
      } else {
        ctx.response.status = 404;
        ctx.response.body = { error: "Note not found" };
      }
    } catch (error) {
      console.error("Error in PUT /api/notes/:id:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Internal server error" };
    }
  });

  router.delete("/api/notes/:id", async (ctx) => {
    try {
      const id = parseInt(ctx.params.id);
      if (isNaN(id)) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid note ID" };
        return;
      }

      const success = await db.deleteNote(id);
      
      if (success) {
        ctx.response.body = { message: "Note deleted successfully" };
      } else {
        ctx.response.status = 404;
        ctx.response.body = { error: "Note not found" };
      }
    } catch (error) {
      console.error("Error in DELETE /api/notes/:id:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Internal server error" };
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

  return router;
}