package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

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

type NotesRecord struct {
	ID          int       `json:"id"`
	NoteTitle   string    `json:"note_title"`
	NoteContent string    `json:"note_content"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type NotesDatabase struct {
	db *sql.DB
}

type AppHub struct {
	apps       map[string]*AppMetadata
	appsFolder string
	notesDB    *NotesDatabase
}

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
	
	if err := notesDB.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %v", err)
	}

	return notesDB, nil
}

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

func (ndb *NotesDatabase) Close() error {
	return ndb.db.Close()
}

func NewAppHub() *AppHub {
	notesDB, err := NewNotesDatabase()
	if err != nil {
		log.Printf("Warning: Failed to initialize notes database: %v", err)
		notesDB = nil
	}
	return &AppHub{
		apps:       make(map[string]*AppMetadata),
		appsFolder: "tiny_Apps",
		notesDB:    notesDB,
	}
}

func (hub *AppHub) scanApps() error {
	hub.apps = make(map[string]*AppMetadata)

	if _, err := os.Stat(hub.appsFolder); os.IsNotExist(err) {
		log.Printf("Creating %s directory", hub.appsFolder)
		if err := os.MkdirAll(hub.appsFolder, 0755); err != nil {
			return fmt.Errorf("failed to create %s directory: %v", hub.appsFolder, err)
		}
		return nil
	}

	err := filepath.WalkDir(hub.appsFolder, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if path == hub.appsFolder {
			return nil
		}

		relPath, _ := filepath.Rel(hub.appsFolder, path)
		if strings.Contains(relPath, string(filepath.Separator)) {
			return nil
		}

		if d.IsDir() {
			appPath := path
			indexPath := filepath.Join(appPath, "index.html")
			metadataPath := filepath.Join(appPath, "app-metadata.json")

			if _, err := os.Stat(indexPath); err == nil {
				appName := filepath.Base(appPath)
				
				metadata := &AppMetadata{
					Title:       appName,
					Description: "A tiny app",
					Icon:        "mdi:application",
					Created:     time.Now(),
					Modified:    time.Now(),
					VisitCount:  0,
					Color:       "#3498db",
					Category:    "General",
					Tags:        []string{},
					Path:        appName,
				}

				if metadataBytes, err := os.ReadFile(metadataPath); err == nil {
					if err := json.Unmarshal(metadataBytes, metadata); err != nil {
						log.Printf("Warning: Failed to parse metadata for %s: %v", appName, err)
					}
				}

				metadata.Path = appName
				hub.apps[appName] = metadata
				log.Printf("Discovered app: %s", appName)
			}
		}
		return nil
	})

	return err
}

func (hub *AppHub) handleAppsAPI(w http.ResponseWriter, r *http.Request) {
	if err := hub.scanApps(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to scan apps: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	apps := make([]*AppMetadata, 0, len(hub.apps))
	for _, app := range hub.apps {
		apps = append(apps, app)
	}

	if err := json.NewEncoder(w).Encode(apps); err != nil {
		http.Error(w, fmt.Sprintf("Failed to encode JSON: %v", err), http.StatusInternalServerError)
		return
	}
}

func (hub *AppHub) handleAppVisit(w http.ResponseWriter, r *http.Request) {
	appName := strings.TrimPrefix(r.URL.Path, "/app/")
	if app, exists := hub.apps[appName]; exists {
		app.VisitCount++
	}
	
	appPath := filepath.Join(hub.appsFolder, appName, "index.html")
	content, err := os.ReadFile(appPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	
	htmlContent := string(content)
	baseTag := fmt.Sprintf(`<base href="/app/%s/">`, appName)
	
	if strings.Contains(htmlContent, "<head>") {
		htmlContent = strings.Replace(htmlContent, "<head>", "<head>\n    "+baseTag, 1)
	}
	
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlContent))
}

func (hub *AppHub) handleAppStatic(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/app/")
	parts := strings.SplitN(path, "/", 2)
	
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}

	appName := parts[0]
	filePath := parts[1]

	if _, exists := hub.apps[appName]; !exists {
		http.NotFound(w, r)
		return
	}

	fullPath := filepath.Join(hub.appsFolder, appName, filePath)
	
	if !strings.HasPrefix(filepath.Clean(fullPath), filepath.Clean(filepath.Join(hub.appsFolder, appName))) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	ext := filepath.Ext(filePath)
	switch ext {
	case ".css":
		w.Header().Set("Content-Type", "text/css")
	case ".js":
		w.Header().Set("Content-Type", "application/javascript")
	case ".html":
		w.Header().Set("Content-Type", "text/html")
	case ".json":
		w.Header().Set("Content-Type", "application/json")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".ico":
		w.Header().Set("Content-Type", "image/x-icon")
	}

	http.ServeFile(w, r, fullPath)
}

func (hub *AppHub) handleNotesAPI(w http.ResponseWriter, r *http.Request) {
	if hub.notesDB == nil {
		http.Error(w, "Notes database not available", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/notes")
	
	switch r.Method {
	case "GET":
		if path == "" || path == "/" {
			notes, err := hub.notesDB.GetAll()
			if err != nil {
				http.Error(w, "Failed to fetch notes: "+err.Error(), http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(notes)
		} else {
			idStr := strings.TrimPrefix(path, "/")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				http.Error(w, "Invalid note ID", http.StatusBadRequest)
				return
			}
			
			note, err := hub.notesDB.GetByID(id)
			if err != nil {
				if strings.Contains(err.Error(), "not found") {
					http.Error(w, "Note not found", http.StatusNotFound)
				} else {
					http.Error(w, "Failed to fetch note: "+err.Error(), http.StatusInternalServerError)
				}
				return
			}
			
			json.NewEncoder(w).Encode(note)
		}
		
	case "POST":
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		
		var noteData struct {
			NoteTitle   string `json:"note_title"`
			NoteContent string `json:"note_content"`
		}
		
		if err := json.Unmarshal(body, &noteData); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		
		if strings.TrimSpace(noteData.NoteTitle) == "" || strings.TrimSpace(noteData.NoteContent) == "" {
			http.Error(w, "Title and content are required", http.StatusBadRequest)
			return
		}
		
		note, err := hub.notesDB.Create(noteData.NoteTitle, noteData.NoteContent)
		if err != nil {
			http.Error(w, "Failed to create note: "+err.Error(), http.StatusInternalServerError)
			return
		}
		
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(note)
		
	case "PUT":
		idStr := strings.TrimPrefix(path, "/")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "Invalid note ID", http.StatusBadRequest)
			return
		}
		
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		
		var noteData struct {
			NoteTitle   string `json:"note_title"`
			NoteContent string `json:"note_content"`
		}
		
		if err := json.Unmarshal(body, &noteData); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		
		if strings.TrimSpace(noteData.NoteTitle) == "" || strings.TrimSpace(noteData.NoteContent) == "" {
			http.Error(w, "Title and content are required", http.StatusBadRequest)
			return
		}
		
		note, err := hub.notesDB.Update(id, noteData.NoteTitle, noteData.NoteContent)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, err.Error(), http.StatusNotFound)
			} else {
				http.Error(w, "Failed to update note: "+err.Error(), http.StatusInternalServerError)
			}
			return
		}
		
		json.NewEncoder(w).Encode(note)
		
	case "DELETE":
		idStr := strings.TrimPrefix(path, "/")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "Invalid note ID", http.StatusBadRequest)
			return
		}
		
		err = hub.notesDB.Delete(id)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, err.Error(), http.StatusNotFound)
			} else {
				http.Error(w, "Failed to delete note: "+err.Error(), http.StatusInternalServerError)
			}
			return
		}
		
		w.WriteHeader(http.StatusNoContent)
		
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func main() {
	hub := NewAppHub()

	if err := hub.scanApps(); err != nil {
		log.Printf("Warning: Failed to scan apps: %v", err)
	}

	http.HandleFunc("/api/apps", hub.handleAppsAPI)
	http.HandleFunc("/api/notes", hub.handleNotesAPI)
	http.HandleFunc("/api/notes/", hub.handleNotesAPI)
	
	http.HandleFunc("/app/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/app/")
		
		if strings.Contains(path, "/") {
			hub.handleAppStatic(w, r)
		} else {
			hub.handleAppVisit(w, r)
		}
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "index.html")
		} else if r.URL.Path == "/style.css" {
			w.Header().Set("Content-Type", "text/css")
			http.ServeFile(w, r, "style.css")
		} else if r.URL.Path == "/script.js" {
			w.Header().Set("Content-Type", "application/javascript")
			http.ServeFile(w, r, "script.js")
		} else {
			http.NotFound(w, r)
		}
	})

	port := "5000"
	log.Printf("Starting server on http://0.0.0.0:%s", port)
	log.Printf("App hub will scan for apps in: %s", hub.appsFolder)
	
	if err := http.ListenAndServe("0.0.0.0:"+port, nil); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}