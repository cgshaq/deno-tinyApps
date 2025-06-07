import { join, normalize } from "https://deno.land/std@0.200.0/path/mod.ts";

export interface AppMetadata {
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

export class AppHub {
  private apps: Map<string, AppMetadata> = new Map();
  private appsFolder = "tiny_Apps";

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
      const basePath = join(this.appsFolder, appName);
      const fullPath = normalize(join(basePath, filePath));

      // Prevent directory traversal
      if (!fullPath.startsWith(basePath)) {
        return null;
      }

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
}