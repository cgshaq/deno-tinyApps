import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

export interface NotesRecord {
  id: number;
  note_title: string;
  note_content: string;
  created_at: string;
  updated_at: string;
}

export class DatabaseManager {
  private client: Client | null = null;
  private isConnected = false;

  async connect(): Promise<boolean> {
    try {
      const databaseUrl = Deno.env.get("DATABASE_URL");
      if (!databaseUrl) {
        console.error("DATABASE_URL environment variable not set");
        return false;
      }

      this.client = new Client(databaseUrl);
      await this.client.connect();
      this.isConnected = true;
      
      await this.initSchema();
      console.log("Database schema initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
      this.client = null;
      this.isConnected = false;
      return false;
    }
  }

  private async initSchema(): Promise<void> {
    if (!this.client) throw new Error("Database not connected");

    await this.client.queryObject(`
      CREATE TABLE IF NOT EXISTS notes_records (
        id SERIAL PRIMARY KEY,
        note_title VARCHAR(255) NOT NULL,
        note_content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_notes_records_created_at ON notes_records(created_at DESC);
    `);
  }

  async reconnect(): Promise<boolean> {
    if (this.client && this.isConnected) {
      try {
        await this.client.end();
      } catch {
        // Ignore errors when closing
      }
    }
    this.client = null;
    this.isConnected = false;
    return await this.connect();
  }

  async ensureConnection(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return await this.reconnect();
    }
    
    try {
      // Test connection with a simple query
      await this.client.queryObject("SELECT 1");
      return true;
    } catch {
      // Connection lost, try to reconnect
      return await this.reconnect();
    }
  }

  async getAllNotes(): Promise<NotesRecord[]> {
    if (!await this.ensureConnection()) return [];

    try {
      const result = await this.client!.queryObject<NotesRecord>(
        "SELECT * FROM notes_records ORDER BY created_at DESC"
      );
      return result.rows;
    } catch (error) {
      console.error("Error fetching notes:", error);
      // Try to reconnect and retry once
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject<NotesRecord>(
            "SELECT * FROM notes_records ORDER BY created_at DESC"
          );
          return result.rows;
        } catch (retryError) {
          console.error("Error fetching notes after reconnect:", retryError);
        }
      }
      return [];
    }
  }

  async createNote(title: string, content: string): Promise<NotesRecord | null> {
    if (!await this.ensureConnection()) return null;

    try {
      const result = await this.client!.queryObject<NotesRecord>(
        "INSERT INTO notes_records (note_title, note_content) VALUES ($1, $2) RETURNING *",
        [title, content]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error creating note:", error);
      // Try to reconnect and retry once
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject<NotesRecord>(
            "INSERT INTO notes_records (note_title, note_content) VALUES ($1, $2) RETURNING *",
            [title, content]
          );
          return result.rows[0] || null;
        } catch (retryError) {
          console.error("Error creating note after reconnect:", retryError);
        }
      }
      return null;
    }
  }

  async updateNote(id: number, title: string, content: string): Promise<NotesRecord | null> {
    if (!await this.ensureConnection()) return null;

    try {
      const result = await this.client!.queryObject<NotesRecord>(
        "UPDATE notes_records SET note_title = $1, note_content = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
        [title, content, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error updating note:", error);
      // Try to reconnect and retry once
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject<NotesRecord>(
            "UPDATE notes_records SET note_title = $1, note_content = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
            [title, content, id]
          );
          return result.rows[0] || null;
        } catch (retryError) {
          console.error("Error updating note after reconnect:", retryError);
        }
      }
      return null;
    }
  }

  async deleteNote(id: number): Promise<boolean> {
    if (!await this.ensureConnection()) return false;

    try {
      const result = await this.client!.queryObject(
        "DELETE FROM notes_records WHERE id = $1",
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting note:", error);
      // Try to reconnect and retry once
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject(
            "DELETE FROM notes_records WHERE id = $1",
            [id]
          );
          return result.rowCount > 0;
        } catch (retryError) {
          console.error("Error deleting note after reconnect:", retryError);
        }
      }
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.end();
      } catch (error) {
        console.error("Error closing database connection:", error);
      }
      this.client = null;
      this.isConnected = false;
    }
  }
}