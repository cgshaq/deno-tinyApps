package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// handleAppsAPI returns JSON list of all discovered apps
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

// handleNotesAPI handles all notes API requests
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
		hub.handleGetNotes(w, r, path)
	case "POST":
		hub.handleCreateNote(w, r)
	case "PUT":
		hub.handleUpdateNote(w, r, path)
	case "DELETE":
		hub.handleDeleteNote(w, r, path)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleGetNotes handles GET requests for notes
func (hub *AppHub) handleGetNotes(w http.ResponseWriter, r *http.Request, path string) {
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
}

// handleCreateNote handles POST requests to create new notes
func (hub *AppHub) handleCreateNote(w http.ResponseWriter, r *http.Request) {
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
}

// handleUpdateNote handles PUT requests to update existing notes
func (hub *AppHub) handleUpdateNote(w http.ResponseWriter, r *http.Request, path string) {
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
}

// handleDeleteNote handles DELETE requests to remove notes
func (hub *AppHub) handleDeleteNote(w http.ResponseWriter, r *http.Request, path string) {
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
}