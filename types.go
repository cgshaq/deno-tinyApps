package main

import (
	"database/sql"
	"time"
)

// AppMetadata holds information about discovered apps
type AppMetadata struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Created     time.Time `json:"created"`
	Modified    time.Time `json:"modified"`
	VisitCount  int       `json:"visit_count"`
	Color       string    `json:"color"`
	Category    string    `json:"category"`
	Tags        []string  `json:"tags"`
	Path        string    `json:"path"`
}

// NotesRecord represents a note in the database
type NotesRecord struct {
	ID          int       `json:"id"`
	NoteTitle   string    `json:"note_title"`
	NoteContent string    `json:"note_content"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// NotesDatabase manages PostgreSQL notes storage
type NotesDatabase struct {
	db *sql.DB
}

// AppHub manages the app discovery and notes database
type AppHub struct {
	apps       map[string]*AppMetadata
	appsFolder string
	notesDB    *NotesDatabase
}