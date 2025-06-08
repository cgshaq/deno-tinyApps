import Database from "npm:@replit/database@3.0.1";

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
  private db = new Database();

  private async setWithLog(key: string, value: any): Promise<void> {
    const result = await this.db.set(key, value);
    if (result && (result as any).ok === false) {
      console.error(`Failed to set ${key}:`, (result as any).error);
    }
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    // no-op for Replit DB
  }

  private async getArray<T>(key: string): Promise<T[]> {
    const result = await this.db.get(key);
    if (result && (result as any).ok !== undefined) {
      return Array.isArray((result as any).value)
        ? ((result as any).value as T[])
        : [];
    }
    return Array.isArray(result) ? (result as T[]) : [];
  }

  // Notes methods
  async getAllNotes(): Promise<NotesRecord[]> {
    return await this.getArray<NotesRecord>("notes_records");
  }

  async createNote(title: string, content: string): Promise<NotesRecord | null> {
    const notes = await this.getArray<NotesRecord>("notes_records");
    const now = new Date().toISOString();
    const note: NotesRecord = {
      id: Date.now(),
      note_title: title,
      note_content: content,
      created_at: now,
      updated_at: now,
    };
    notes.unshift(note);
    await this.setWithLog("notes_records", notes);
    return note;
  }

  async updateNote(
    id: number,
    title: string,
    content: string,
  ): Promise<NotesRecord | null> {
    const notes = await this.getArray<NotesRecord>("notes_records");
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;

    const note = notes[idx];
    note.note_title = title;
    note.note_content = content;
    note.updated_at = new Date().toISOString();
    notes[idx] = note;
    await this.setWithLog("notes_records", notes);
    return note;
  }

  async deleteNote(id: number): Promise<boolean> {
    const notes = await this.getArray<NotesRecord>("notes_records");
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    notes.splice(idx, 1);
    await this.setWithLog("notes_records", notes);
    return true;
  }

  // Kanban methods
  async getAllTasks(): Promise<KanbanTask[]> {
    return await this.getArray<KanbanTask>("kanban_tasks");
  }

  async createTask(
    title: string,
    description: string,
    status: string,
    priority: string,
  ): Promise<KanbanTask | null> {
    const tasks = await this.getArray<KanbanTask>("kanban_tasks");
    const now = new Date().toISOString();
    const task: KanbanTask = {
      id: Date.now(),
      title,
      description,
      status,
      priority,
      created_at: now,
      updated_at: now,
    };
    tasks.unshift(task);
    await this.setWithLog("kanban_tasks", tasks);
    return task;
  }

  async updateTask(
    id: number,
    title: string,
    description: string,
    status: string,
    priority: string,
  ): Promise<KanbanTask | null> {
    const tasks = await this.getArray<KanbanTask>("kanban_tasks");
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    const task = tasks[idx];
    task.title = title;
    task.description = description;
    task.status = status;
    task.priority = priority;
    task.updated_at = new Date().toISOString();
    tasks[idx] = task;
    await this.setWithLog("kanban_tasks", tasks);
    return task;
  }

  async deleteTask(id: number): Promise<boolean> {
    const tasks = await this.getArray<KanbanTask>("kanban_tasks");
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    tasks.splice(idx, 1);
    await this.setWithLog("kanban_tasks", tasks);
    return true;
  }

  // Database viewer helpers
  async getAllTables(): Promise<{ table_name: string; row_count: number }[]> {
    const notes = await this.getArray<NotesRecord>("notes_records");
    const tasks = await this.getArray<KanbanTask>("kanban_tasks");
    return [
      { table_name: "notes_records", row_count: notes.length },
      { table_name: "kanban_tasks", row_count: tasks.length },
    ];
  }

  async getTableData(tableName: string): Promise<Record<string, any>[]> {
    if (tableName === "notes_records") {
      return await this.getArray<NotesRecord>("notes_records") as Record<string, any>[];
    }
    if (tableName === "kanban_tasks") {
      return await this.getArray<KanbanTask>("kanban_tasks") as Record<string, any>[];
    }
    if (tableName === "tw_grid_links") {
      const links = await this.getTwGridLinks();
      return links as Record<string, any>[];
    }
    return [];
  }

  // TW Grid Links methods
  async getTwGridLinks(): Promise<any[]> {
    const defaultLinks = [
      { id: "1", name: "Replit Home", url: "https://replit.com", icon: "https://replit.com/favicon.ico" },
      { id: "2", name: "Replit Docs", url: "https://docs.replit.com", icon: "https://docs.replit.com/favicon.ico" },
      { id: "3", name: "Replit Community", url: "https://replit.com/community", icon: "https://replit.com/favicon.ico" },
      { id: "4", name: "Oak Framework", url: "https://deno.land/x/oak", icon: "https://deno.land/favicon.ico" },
    ];
    try {
      const result: any = await this.db.get("tw_grid_links");

      // Check if result is the raw value or an object wrapper
      if (result === null || result === undefined) {
        console.log("No 'tw_grid_links' found in DB, returning default links.");
        return defaultLinks;
      }

      // The Replit DB client sometimes returns the value directly,
      // and sometimes wraps it in an object like { ok: true, value: ... } or { ok: false, error: ... }
      // It seems this behavior might depend on the specific client version or operation.
      // The existing getArray method checks for `result.ok !== undefined`
      if (result && result.ok !== undefined) {
        if (result.ok && Array.isArray(result.value)) {
          return result.value;
        } else if (result.ok && result.value === null) { // Key exists but value is explicitly null
           console.log("'tw_grid_links' is null in DB, returning default links.");
           return defaultLinks;
        } else if (!result.ok) {
          console.error("Error fetching 'tw_grid_links' (wrapped error):", result.error);
          return defaultLinks; // Or throw error
        }
      }

      // If it's not wrapped and is an array, return it
      if (Array.isArray(result)) {
        return result;
      }

      // If it's not an array and not null/undefined by this point, it's unexpected.
      console.warn("Unexpected data format for 'tw_grid_links', returning default links. Data:", result);
      return defaultLinks;

    } catch (error) {
      console.error("Exception fetching 'tw_grid_links':", error);
      return defaultLinks; // Or throw error
    }
  }

  async setTwGridLinks(links: any[]): Promise<boolean> {
    try {
      // Using this.db.set directly as setWithLog is not typed for boolean return
      // and we want to provide direct feedback on success/failure of this specific operation.
      await this.db.set("tw_grid_links", links);
      // Replit DB's set typically doesn't throw for simple errors but might return a result object.
      // However, the client version 3.0.1 used here is simpler and usually returns undefined or throws on major issues.
      // For robustness, one might re-fetch the key to confirm it was set, but that's often overkill.
      return true;
    } catch (error) {
      console.error("Failed to set 'tw_grid_links':", error);
      return false;
    }
  }
}
