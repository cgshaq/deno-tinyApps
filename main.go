package main

import (
        "encoding/json"
        "fmt"
        "io/fs"
        "log"
        "net/http"
        "os"
        "path/filepath"
        "strings"
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