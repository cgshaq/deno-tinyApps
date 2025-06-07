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

  async connect(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    // no-op for Replit DB
  }

  private async getArray<T>(key: string): Promise<T[]> {
    const value = await this.db.get(key);
    return Array.isArray(value) ? value as T[] : [];
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
    await this.db.set("notes_records", notes);
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
    await this.db.set("notes_records", notes);
    return note;
  }

  async deleteNote(id: number): Promise<boolean> {
    const notes = await this.getArray<NotesRecord>("notes_records");
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    notes.splice(idx, 1);
    await this.db.set("notes_records", notes);
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
    await this.db.set("kanban_tasks", tasks);
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
    await this.db.set("kanban_tasks", tasks);
    return task;
  }

  async deleteTask(id: number): Promise<boolean> {
    const tasks = await this.getArray<KanbanTask>("kanban_tasks");
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    tasks.splice(idx, 1);
    await this.db.set("kanban_tasks", tasks);
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
    return [];
  }
}
