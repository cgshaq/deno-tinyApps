import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

export interface NotesRecord {
  id: number;
  note_title: string;
  note_content: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanTask {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
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
      
      CREATE TABLE IF NOT EXISTS kanban_tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'todo',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_kanban_tasks_created_at ON kanban_tasks(created_at DESC);
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

  // Kanban methods
  async getAllTasks(): Promise<KanbanTask[]> {
    if (!await this.ensureConnection()) return [];

    try {
      const result = await this.client!.queryObject<KanbanTask>(
        "SELECT * FROM kanban_tasks ORDER BY created_at DESC"
      );
      return result.rows;
    } catch (error) {
      console.error("Error fetching kanban tasks:", error);
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject<KanbanTask>(
            "SELECT * FROM kanban_tasks ORDER BY created_at DESC"
          );
          return result.rows;
        } catch (retryError) {
          console.error("Error fetching kanban tasks after reconnect:", retryError);
        }
      }
      return [];
    }
  }

  async createTask(title: string, description: string, status: string, priority: string): Promise<KanbanTask | null> {
    if (!await this.ensureConnection()) return null;

    try {
      const result = await this.client!.queryObject<KanbanTask>(
        "INSERT INTO kanban_tasks (title, description, status, priority) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description, status, priority]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error creating kanban task:", error);
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject<KanbanTask>(
            "INSERT INTO kanban_tasks (title, description, status, priority) VALUES ($1, $2, $3, $4) RETURNING *",
            [title, description, status, priority]
          );
          return result.rows[0] || null;
        } catch (retryError) {
          console.error("Error creating kanban task after reconnect:", retryError);
        }
      }
      return null;
    }
  }

  async updateTask(id: number, title: string, description: string, status: string, priority: string): Promise<KanbanTask | null> {
    if (!await this.ensureConnection()) return null;

    try {
      const result = await this.client!.queryObject<KanbanTask>(
        "UPDATE kanban_tasks SET title = $1, description = $2, status = $3, priority = $4, updated_at = NOW() WHERE id = $5 RETURNING *",
        [title, description, status, priority, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error updating kanban task:", error);
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject<KanbanTask>(
            "UPDATE kanban_tasks SET title = $1, description = $2, status = $3, priority = $4, updated_at = NOW() WHERE id = $5 RETURNING *",
            [title, description, status, priority, id]
          );
          return result.rows[0] || null;
        } catch (retryError) {
          console.error("Error updating kanban task after reconnect:", retryError);
        }
      }
      return null;
    }
  }

  async deleteTask(id: number): Promise<boolean> {
    if (!await this.ensureConnection()) return false;

    try {
      const result = await this.client!.queryObject(
        "DELETE FROM kanban_tasks WHERE id = $1",
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting kanban task:", error);
      if (await this.reconnect()) {
        try {
          const result = await this.client!.queryObject(
            "DELETE FROM kanban_tasks WHERE id = $1",
            [id]
          );
          return result.rowCount > 0;
        } catch (retryError) {
          console.error("Error deleting kanban task after reconnect:", retryError);
        }
      }
      return false;
    }
  }

  async getAllTables(): Promise<{ table_name: string; row_count: number }[]> {
    if (!await this.ensureConnection()) return [];

    try {
      const result = await this.client!.queryObject<{ table_name: string; row_count: bigint }>(
        `SELECT 
           t.table_name,
           COALESCE(s.n_tup_ins - s.n_tup_del, 0) as row_count
         FROM information_schema.tables t
         LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
         WHERE t.table_schema = 'public' 
         AND t.table_type = 'BASE TABLE'
         ORDER BY t.table_name`
      );
      
      // Convert BigInt to number for JSON serialization
      return result.rows.map(row => ({
        table_name: row.table_name,
        row_count: Number(row.row_count)
      }));
    } catch (error) {
      console.error("Error fetching table info:", error);
      return [];
    }
  }

  async getTableData(tableName: string): Promise<Record<string, any>[]> {
    if (!await this.ensureConnection()) return [];

    try {
      // Validate table name to prevent SQL injection
      const validTables = ['notes_records', 'kanban_tasks'];
      if (!validTables.includes(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
      }

      const result = await this.client!.queryObject(
        `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT 100`
      );
      
      // Convert BigInt values to strings for JSON serialization
      return result.rows.map((row: any) => {
        const convertedRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'bigint') {
            convertedRow[key] = value.toString();
          } else {
            convertedRow[key] = value;
          }
        }
        return convertedRow;
      });
    } catch (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      return [];
    }
  }
}