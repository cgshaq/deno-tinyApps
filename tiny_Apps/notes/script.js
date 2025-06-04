// Notes App JavaScript
let notes = [];
let editingNoteId = null;

// API Base URL
const API_BASE = '/api/notes';

// DOM Elements
const notesContainer = document.getElementById('notes-container');
const noteModal = document.getElementById('note-modal');
const noteForm = document.getElementById('note-form');
const newNoteBtn = document.getElementById('new-note-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const modalTitle = document.getElementById('modal-title');
const loadingEl = document.getElementById('loading');
const emptyStateEl = document.getElementById('empty-state');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadNotes();
    setupEventListeners();
});

function setupEventListeners() {
    newNoteBtn.addEventListener('click', () => openNoteModal());
    closeModalBtn.addEventListener('click', closeNoteModal);
    cancelBtn.addEventListener('click', closeNoteModal);
    noteForm.addEventListener('submit', handleNoteSubmit);
    
    // Close modal when clicking outside
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            closeNoteModal();
        }
    });
}

async function loadNotes() {
    showLoading(true);
    try {
        const response = await fetch(API_BASE);
        if (response.ok) {
            notes = await response.json();
            renderNotes();
        } else {
            showError('Failed to load notes');
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        showError('Error loading notes');
    } finally {
        showLoading(false);
    }
}

function renderNotes() {
    if (notes.length === 0) {
        notesContainer.innerHTML = '';
        emptyStateEl.classList.remove('hidden');
        return;
    }
    
    emptyStateEl.classList.add('hidden');
    
    notesContainer.innerHTML = notes.map(note => `
        <div class="note-card" data-id="${note.id}">
            <div class="note-title">${escapeHtml(note.note_title)}</div>
            <div class="note-content">${escapeHtml(note.note_content)}</div>
            <div class="note-actions">
                <button class="btn btn-primary" onclick="editNote(${note.id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteNote(${note.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function openNoteModal(note = null) {
    editingNoteId = note ? note.id : null;
    modalTitle.textContent = note ? 'Edit Note' : 'New Note';
    
    document.getElementById('note-id').value = editingNoteId || '';
    document.getElementById('note-title').value = note ? note.note_title : '';
    document.getElementById('note-content').value = note ? note.note_content : '';
    
    noteModal.classList.add('show');
    document.getElementById('note-title').focus();
}

function closeNoteModal() {
    noteModal.classList.remove('show');
    noteForm.reset();
    editingNoteId = null;
}

async function handleNoteSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(noteForm);
    const noteData = {
        note_title: formData.get('note_title').trim(),
        note_content: formData.get('note_content').trim()
    };
    
    if (!noteData.note_title || !noteData.note_content) {
        showError('Please fill in both title and content');
        return;
    }
    
    try {
        let response;
        if (editingNoteId) {
            // Update existing note
            response = await fetch(`${API_BASE}/${editingNoteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(noteData)
            });
        } else {
            // Create new note
            response = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(noteData)
            });
        }
        
        if (response.ok) {
            closeNoteModal();
            loadNotes();
            showSuccess(editingNoteId ? 'Note updated successfully' : 'Note created successfully');
        } else {
            const error = await response.text();
            showError(error || 'Failed to save note');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showError('Error saving note');
    }
}

async function editNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        openNoteModal(note);
    }
}

async function deleteNote(id) {
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadNotes();
            showSuccess('Note deleted successfully');
        } else {
            showError('Failed to delete note');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        showError('Error deleting note');
    }
}

function showLoading(show) {
    if (show) {
        loadingEl.classList.remove('hidden');
        notesContainer.style.opacity = '0.5';
    } else {
        loadingEl.classList.add('hidden');
        notesContainer.style.opacity = '1';
    }
}

function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    // Simple success indication - could be improved with toast notifications
    console.log('Success:', message);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global functions for inline event handlers
window.openNoteModal = openNoteModal;
window.editNote = editNote;
window.deleteNote = deleteNote;