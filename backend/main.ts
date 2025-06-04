import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { AppHub } from "./app-hub.ts";
import { DatabaseManager } from "./database.ts";
import { createRouter } from "./routes.ts";

// Initialize services
const appHub = new AppHub();
const db = new DatabaseManager();

// Initialize database connection
await db.connect();

// Create router
const router = createRouter(appHub, db);

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