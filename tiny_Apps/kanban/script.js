// Kanban App JavaScript
let tasks = [];
let editingTaskId = null;

// API Base URL
const API_BASE = '/api/kanban';

// DOM Elements
const kanbanBoard = document.getElementById('kanban-board');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const newTaskBtn = document.getElementById('new-task-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const modalTitle = document.getElementById('modal-title');
const loadingEl = document.getElementById('loading');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadTasks();
    setupEventListeners();
    setupDragAndDrop();
});

function setupEventListeners() {
    newTaskBtn.addEventListener('click', () => openTaskModal());
    closeModalBtn.addEventListener('click', closeTaskModal);
    cancelBtn.addEventListener('click', closeTaskModal);
    taskForm.addEventListener('submit', handleTaskSubmit);
    
    // Close modal when clicking outside
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            closeTaskModal();
        }
    });
}

function setupDragAndDrop() {
    const tasksContainers = document.querySelectorAll('.tasks-container');
    
    tasksContainers.forEach(container => {
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const taskId = e.dataTransfer.getData('text/plain');
    const newStatus = e.currentTarget.id.replace('-tasks', '');
    
    updateTaskStatus(parseInt(taskId), newStatus);
}

async function loadTasks() {
    showLoading(true);
    try {
        const response = await fetch(API_BASE);
        if (response.ok) {
            tasks = await response.json();
            renderTasks();
        } else {
            showError('Failed to load tasks');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showError('Error loading tasks');
    } finally {
        showLoading(false);
    }
}

function renderTasks() {
    // Clear all task containers
    document.getElementById('todo-tasks').innerHTML = '';
    document.getElementById('in_progress-tasks').innerHTML = '';
    document.getElementById('done-tasks').innerHTML = '';
    
    // Count tasks by status
    const counts = { todo: 0, in_progress: 0, done: 0 };
    
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        const container = document.getElementById(`${task.status}-tasks`);
        container.appendChild(taskElement);
        counts[task.status]++;
    });
    
    // Update counts
    document.getElementById('todo-count').textContent = counts.todo;
    document.getElementById('in_progress-count').textContent = counts.in_progress;
    document.getElementById('done-count').textContent = counts.done;
}

function createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-card bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-move';
    taskDiv.draggable = true;
    taskDiv.dataset.taskId = task.id;
    
    const priorityColors = {
        low: 'bg-green-100 text-green-800',
        medium: 'bg-yellow-100 text-yellow-800',
        high: 'bg-red-100 text-red-800'
    };
    
    taskDiv.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-gray-800">${escapeHtml(task.title)}</h4>
            <span class="px-2 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority]}">
                ${task.priority}
            </span>
        </div>
        ${task.description ? `<p class="text-gray-600 text-sm mb-3">${escapeHtml(task.description)}</p>` : ''}
        <div class="flex justify-between items-center text-xs text-gray-500">
            <span>${new Date(task.created_at).toLocaleDateString()}</span>
            <div class="flex gap-2">
                <button onclick="editTask(${task.id})" class="text-blue-500 hover:text-blue-700">
                    <iconify-icon icon="mdi:pencil"></iconify-icon>
                </button>
                <button onclick="deleteTask(${task.id})" class="text-red-500 hover:text-red-700">
                    <iconify-icon icon="mdi:delete"></iconify-icon>
                </button>
            </div>
        </div>
    `;
    
    // Add drag event listeners
    taskDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
    });
    
    taskDiv.addEventListener('dragend', () => {
        document.querySelectorAll('.tasks-container').forEach(container => {
            container.classList.remove('drag-over');
        });
    });
    
    return taskDiv;
}

function openTaskModal(task = null) {
    editingTaskId = task ? task.id : null;
    modalTitle.textContent = task ? 'Edit Task' : 'New Task';
    
    document.getElementById('task-id').value = editingTaskId || '';
    document.getElementById('task-title').value = task ? task.title : '';
    document.getElementById('task-description').value = task ? task.description : '';
    document.getElementById('task-priority').value = task ? task.priority : 'medium';
    document.getElementById('task-status').value = task ? task.status : 'todo';
    
    taskModal.classList.remove('hidden');
    taskModal.classList.add('flex');
    document.getElementById('task-title').focus();
}

function closeTaskModal() {
    taskModal.classList.add('hidden');
    taskModal.classList.remove('flex');
    taskForm.reset();
    editingTaskId = null;
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(taskForm);
    const taskData = {
        title: formData.get('title').trim(),
        description: formData.get('description').trim(),
        priority: formData.get('priority'),
        status: formData.get('status')
    };
    
    if (!taskData.title) {
        showError('Please fill in the title');
        return;
    }
    
    try {
        let response;
        if (editingTaskId) {
            // Update existing task
            response = await fetch(`${API_BASE}/${editingTaskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });
        } else {
            // Create new task
            response = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });
        }
        
        if (response.ok) {
            closeTaskModal();
            loadTasks();
            showSuccess(editingTaskId ? 'Task updated successfully' : 'Task created successfully');
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to save task');
        }
    } catch (error) {
        console.error('Error saving task:', error);
        showError('Error saving task');
    }
}

async function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        openTaskModal(task);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTasks();
            showSuccess('Task deleted successfully');
        } else {
            showError('Failed to delete task');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showError('Error deleting task');
    }
}

async function updateTaskStatus(id, newStatus) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === newStatus) return;
    
    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: task.title,
                description: task.description,
                priority: task.priority,
                status: newStatus
            })
        });
        
        if (response.ok) {
            loadTasks();
            showSuccess('Task status updated');
        } else {
            showError('Failed to update task status');
        }
    } catch (error) {
        console.error('Error updating task status:', error);
        showError('Error updating task status');
    }
}

function showLoading(show) {
    if (show) {
        loadingEl.classList.remove('hidden');
        kanbanBoard.classList.add('hidden');
    } else {
        loadingEl.classList.add('hidden');
        kanbanBoard.classList.remove('hidden');
    }
}

function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log('Success:', message);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global functions for inline event handlers
window.editTask = editTask;
window.deleteTask = deleteTask;