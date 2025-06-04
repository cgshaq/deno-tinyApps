package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// NotesRecord represents a note in the database
type NotesRecord struct {
	ID          int       `json:"id"`
	NoteTitle   string    `json:"note_title"`
	NoteContent string    `json:"note_content"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// NotesDatabase manages the notes storage with PostgreSQL
type NotesDatabase struct {
	db *sql.DB
}

// NewNotesDatabase creates a new notes database instance with PostgreSQL
func NewNotesDatabase() (*NotesDatabase, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable not set")
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %v", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %v", err)
	}

	notesDB := &NotesDatabase{db: db}
	
	// Initialize the database schema
	if err := notesDB.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %v", err)
	}

	return notesDB, nil
}

// initSchema creates the notes table if it doesn't exist
func (ndb *NotesDatabase) initSchema() error {
	query := `
	CREATE TABLE IF NOT EXISTS notes_records (
		id SERIAL PRIMARY KEY,
		note_title VARCHAR(255) NOT NULL,
		note_content TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_notes_records_created_at ON notes_records(created_at DESC);
	`

	_, err := ndb.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to create schema: %v", err)
	}

	log.Println("Database schema initialized successfully")
	return nil
}

// GetAll returns all notes
func (ndb *NotesDatabase) GetAll() ([]*NotesRecord, error) {
	query := `
	SELECT id, note_title, note_content, created_at, updated_at 
	FROM notes_records 
	ORDER BY updated_at DESC
	`

	rows, err := ndb.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query notes: %v", err)
	}
	defer rows.Close()

	var notes []*NotesRecord
	for rows.Next() {
		note := &NotesRecord{}
		err := rows.Scan(&note.ID, &note.NoteTitle, &note.NoteContent, &note.CreatedAt, &note.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %v", err)
		}
		notes = append(notes, note)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %v", err)
	}

	return notes, nil
}

// GetByID returns a note by ID
func (ndb *NotesDatabase) GetByID(id int) (*NotesRecord, error) {
	query := `
	SELECT id, note_title, note_content, created_at, updated_at 
	FROM notes_records 
	WHERE id = $1
	`

	note := &NotesRecord{}
	err := ndb.db.QueryRow(query, id).Scan(
		&note.ID, &note.NoteTitle, &note.NoteContent, &note.CreatedAt, &note.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("note with ID %d not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get note: %v", err)
	}

	return note, nil
}

// Create adds a new note
func (ndb *NotesDatabase) Create(noteTitle, noteContent string) (*NotesRecord, error) {
	query := `
	INSERT INTO notes_records (note_title, note_content, created_at, updated_at)
	VALUES ($1, $2, NOW(), NOW())
	RETURNING id, note_title, note_content, created_at, updated_at
	`

	note := &NotesRecord{}
	err := ndb.db.QueryRow(query, noteTitle, noteContent).Scan(
		&note.ID, &note.NoteTitle, &note.NoteContent, &note.CreatedAt, &note.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create note: %v", err)
	}

	return note, nil
}

// Update modifies an existing note
func (ndb *NotesDatabase) Update(id int, noteTitle, noteContent string) (*NotesRecord, error) {
	query := `
	UPDATE notes_records 
	SET note_title = $1, note_content = $2, updated_at = NOW()
	WHERE id = $3
	RETURNING id, note_title, note_content, created_at, updated_at
	`

	note := &NotesRecord{}
	err := ndb.db.QueryRow(query, noteTitle, noteContent, id).Scan(
		&note.ID, &note.NoteTitle, &note.NoteContent, &note.CreatedAt, &note.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("note with ID %d not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update note: %v", err)
	}

	return note, nil
}

// Delete removes a note
func (ndb *NotesDatabase) Delete(id int) error {
	query := `DELETE FROM notes_records WHERE id = $1`

	result, err := ndb.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete note: %v", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %v", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("note with ID %d not found", id)
	}

	return nil
}

// Close closes the database connection
func (ndb *NotesDatabase) Close() error {
	return ndb.db.Close()
}