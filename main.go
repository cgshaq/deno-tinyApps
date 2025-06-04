package main

import (
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
        "sync"
        "time"
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

// NotesRecord represents a note in the database
type NotesRecord struct {
        ID          int       `json:"id"`
        NoteTitle   string    `json:"note_title"`
        NoteContent string    `json:"note_content"`
        CreatedAt   time.Time `json:"created_at"`
        UpdatedAt   time.Time `json:"updated_at"`
}

// NotesDatabase manages the notes storage
type NotesDatabase struct {
        records    map[int]*NotesRecord
        nextID     int
        mutex      sync.RWMutex
        dataFile   string
}

type AppHub struct {
        apps       map[string]*AppMetadata
        appsFolder string
        notesDB    *NotesDatabase
}

// NewNotesDatabase creates a new notes database instance
func NewNotesDatabase(dataFile string) *NotesDatabase {
        db := &NotesDatabase{
                records:  make(map[int]*NotesRecord),
                nextID:   1,
                dataFile: dataFile,
        }
        db.loadFromFile()
        return db
}

// loadFromFile loads notes from the JSON file
func (db *NotesDatabase) loadFromFile() {
        db.mutex.Lock()
        defer db.mutex.Unlock()

        data, err := os.ReadFile(db.dataFile)
        if err != nil {
                if os.IsNotExist(err) {
                        return // File doesn't exist yet, start with empty database
                }
                log.Printf("Error reading notes file: %v", err)
                return
        }

        var records []*NotesRecord
        if err := json.Unmarshal(data, &records); err != nil {
                log.Printf("Error parsing notes file: %v", err)
                return
        }

        db.records = make(map[int]*NotesRecord)
        db.nextID = 1
        for _, record := range records {
                db.records[record.ID] = record
                if record.ID >= db.nextID {
                        db.nextID = record.ID + 1
                }
        }
}

// saveToFile saves notes to the JSON file
func (db *NotesDatabase) saveToFile() error {
        db.mutex.RLock()
        records := make([]*NotesRecord, 0, len(db.records))
        for _, record := range db.records {
                records = append(records, record)
        }
        db.mutex.RUnlock()

        data, err := json.MarshalIndent(records, "", "  ")
        if err != nil {
                return err
        }

        return os.WriteFile(db.dataFile, data, 0644)
}

// GetAll returns all notes
func (db *NotesDatabase) GetAll() []*NotesRecord {
        db.mutex.RLock()
        defer db.mutex.RUnlock()

        records := make([]*NotesRecord, 0, len(db.records))
        for _, record := range db.records {
                records = append(records, record)
        }
        return records
}

// GetByID returns a note by ID
func (db *NotesDatabase) GetByID(id int) (*NotesRecord, bool) {
        db.mutex.RLock()
        defer db.mutex.RUnlock()

        record, exists := db.records[id]
        return record, exists
}

// Create adds a new note
func (db *NotesDatabase) Create(noteTitle, noteContent string) (*NotesRecord, error) {
        db.mutex.Lock()
        defer db.mutex.Unlock()

        record := &NotesRecord{
                ID:          db.nextID,
                NoteTitle:   noteTitle,
                NoteContent: noteContent,
                CreatedAt:   time.Now(),
                UpdatedAt:   time.Now(),
        }

        db.records[db.nextID] = record
        db.nextID++

        if err := db.saveToFile(); err != nil {
                return nil, err
        }

        return record, nil
}

// Update modifies an existing note
func (db *NotesDatabase) Update(id int, noteTitle, noteContent string) (*NotesRecord, error) {
        db.mutex.Lock()
        defer db.mutex.Unlock()

        record, exists := db.records[id]
        if !exists {
                return nil, fmt.Errorf("note with ID %d not found", id)
        }

        record.NoteTitle = noteTitle
        record.NoteContent = noteContent
        record.UpdatedAt = time.Now()

        if err := db.saveToFile(); err != nil {
                return nil, err
        }

        return record, nil
}

// Delete removes a note
func (db *NotesDatabase) Delete(id int) error {
        db.mutex.Lock()
        defer db.mutex.Unlock()

        if _, exists := db.records[id]; !exists {
                return fmt.Errorf("note with ID %d not found", id)
        }

        delete(db.records, id)
        return db.saveToFile()
}

func NewAppHub() *AppHub {
        notesDB := NewNotesDatabase("notes_data.json")
        return &AppHub{
                apps:       make(map[string]*AppMetadata),
                appsFolder: "tiny_Apps",
                notesDB:    notesDB,
        }
}

// scanApps discovers all apps in the tiny_Apps directory
func (hub *AppHub) scanApps() error {
        // Clear existing apps
        hub.apps = make(map[string]*AppMetadata)

        // Check if tiny_Apps directory exists
        if _, err := os.Stat(hub.appsFolder); os.IsNotExist(err) {
                log.Printf("Creating %s directory", hub.appsFolder)
                if err := os.MkdirAll(hub.appsFolder, 0755); err != nil {
                        return fmt.Errorf("failed to create %s directory: %v", hub.appsFolder, err)
                }
                return nil
        }

        // Walk through tiny_Apps directory
        err := filepath.WalkDir(hub.appsFolder, func(path string, d fs.DirEntry, err error) error {
                if err != nil {
                        return err
                }

                // Skip the root tiny_Apps directory
                if path == hub.appsFolder {
                        return nil
                }

                // Only process directories that are direct children of tiny_Apps
                relPath, _ := filepath.Rel(hub.appsFolder, path)
                if strings.Contains(relPath, string(filepath.Separator)) {
                        return nil
                }

                if d.IsDir() {
                        appPath := path
                        indexPath := filepath.Join(appPath, "index.html")
                        metadataPath := filepath.Join(appPath, "app-metadata.json")

                        // Check if index.html exists
                        if _, err := os.Stat(indexPath); err == nil {
                                appName := filepath.Base(appPath)
                                
                                // Create default metadata
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

                                // Try to load metadata from JSON file
                                if metadataBytes, err := os.ReadFile(metadataPath); err == nil {
                                        if err := json.Unmarshal(metadataBytes, metadata); err != nil {
                                                log.Printf("Warning: Failed to parse metadata for %s: %v", appName, err)
                                        }
                                }

                                // Ensure path is set correctly
                                metadata.Path = appName
                                hub.apps[appName] = metadata
                                log.Printf("Discovered app: %s", appName)
                        }
                }
                return nil
        })

        return err
}

// handleAppsAPI returns JSON list of all discovered apps
func (hub *AppHub) handleAppsAPI(w http.ResponseWriter, r *http.Request) {
        // Rescan apps to pick up any new additions
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

// handleAppVisit increments visit count and serves the app with proper base URL
func (hub *AppHub) handleAppVisit(w http.ResponseWriter, r *http.Request) {
        appName := strings.TrimPrefix(r.URL.Path, "/app/")
        if app, exists := hub.apps[appName]; exists {
                app.VisitCount++
                // In a real application, you might want to persist this to storage
        }
        
        // Read the app's index.html
        appPath := filepath.Join(hub.appsFolder, appName, "index.html")
        content, err := os.ReadFile(appPath)
        if err != nil {
                http.NotFound(w, r)
                return
        }
        
        // Inject base tag to fix relative paths
        htmlContent := string(content)
        baseTag := fmt.Sprintf(`<base href="/app/%s/">`, appName)
        
        // Insert base tag after <head>
        if strings.Contains(htmlContent, "<head>") {
                htmlContent = strings.Replace(htmlContent, "<head>", "<head>\n    "+baseTag, 1)
        }
        
        w.Header().Set("Content-Type", "text/html")
        w.Write([]byte(htmlContent))
}

// handleAppStatic serves static files for apps
func (hub *AppHub) handleAppStatic(w http.ResponseWriter, r *http.Request) {
        // Extract app name and file path
        path := strings.TrimPrefix(r.URL.Path, "/app/")
        parts := strings.SplitN(path, "/", 2)
        
        if len(parts) < 2 {
                http.NotFound(w, r)
                return
        }

        appName := parts[0]
        filePath := parts[1]

        // Verify app exists
        if _, exists := hub.apps[appName]; !exists {
                http.NotFound(w, r)
                return
        }

        // Serve the static file
        fullPath := filepath.Join(hub.appsFolder, appName, filePath)
        
        // Security check: ensure the path is within the app directory
        if !strings.HasPrefix(filepath.Clean(fullPath), filepath.Clean(filepath.Join(hub.appsFolder, appName))) {
                http.Error(w, "Access denied", http.StatusForbidden)
                return
        }

        // Set correct MIME type based on file extension
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

// handleNotesAPI handles all notes API requests
func (hub *AppHub) handleNotesAPI(w http.ResponseWriter, r *http.Request) {
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
                        // Get all notes
                        notes := hub.notesDB.GetAll()
                        json.NewEncoder(w).Encode(notes)
                } else {
                        // Get specific note by ID
                        idStr := strings.TrimPrefix(path, "/")
                        id, err := strconv.Atoi(idStr)
                        if err != nil {
                                http.Error(w, "Invalid note ID", http.StatusBadRequest)
                                return
                        }
                        
                        note, exists := hub.notesDB.GetByID(id)
                        if !exists {
                                http.Error(w, "Note not found", http.StatusNotFound)
                                return
                        }
                        
                        json.NewEncoder(w).Encode(note)
                }
                
        case "POST":
                // Create new note
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
                // Update existing note
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
                // Delete note
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

        // Initial scan of apps
        if err := hub.scanApps(); err != nil {
                log.Printf("Warning: Failed to scan apps: %v", err)
        }

        // Routes
        http.HandleFunc("/api/apps", hub.handleAppsAPI)
        http.HandleFunc("/api/notes", hub.handleNotesAPI)
        http.HandleFunc("/api/notes/", hub.handleNotesAPI)
        
        // Handle app routing
        http.HandleFunc("/app/", func(w http.ResponseWriter, r *http.Request) {
                path := strings.TrimPrefix(r.URL.Path, "/app/")
                
                // If path contains a slash, it's a static file request
                if strings.Contains(path, "/") {
                        hub.handleAppStatic(w, r)
                } else {
                        // It's an app visit request - serve index.html
                        hub.handleAppVisit(w, r)
                }
        })

        // Serve main hub files
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
