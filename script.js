class AppHub {
    constructor() {
        this.apps = [];
        this.lastUpdated = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadApps();
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refresh-btn');
        refreshBtn.addEventListener('click', () => this.loadApps());
    }

    async loadApps() {
        this.showLoading();
        
        try {
            const response = await fetch('/api/apps');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const apps = await response.json();
            this.apps = apps;
            this.lastUpdated = new Date();
            
            this.renderApps();
            this.updateFooter();
            
        } catch (error) {
            console.error('Failed to load apps:', error);
            this.showError(error.message);
        }
    }

    showLoading() {
        this.hideAllStates();
        document.getElementById('loading').style.display = 'flex';
    }

    showError(message) {
        this.hideAllStates();
        const errorEl = document.getElementById('error');
        const errorMessageEl = document.getElementById('error-message');
        errorMessageEl.textContent = message;
        errorEl.style.display = 'flex';
    }

    showEmpty() {
        this.hideAllStates();
        document.getElementById('empty').style.display = 'block';
    }

    hideAllStates() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        document.getElementById('empty').style.display = 'none';
        document.getElementById('apps-grid').style.display = 'none';
    }

    renderApps() {
        if (this.apps.length === 0) {
            this.showEmpty();
            return;
        }

        this.hideAllStates();
        const appsGrid = document.getElementById('apps-grid');
        appsGrid.style.display = 'grid';
        
        // Sort apps by title
        const sortedApps = [...this.apps].sort((a, b) => 
            a.title.localeCompare(b.title)
        );

        appsGrid.innerHTML = sortedApps.map(app => this.renderAppCard(app)).join('');
    }

    renderAppCard(app) {
        const createdDate = new Date(app.created).toLocaleDateString();
        const visitText = app.visit_count === 1 ? '1 visit' : `${app.visit_count} visits`;
        
        return `
            <a href="/app/${app.path}" class="app-card" style="border-left: 4px solid ${app.color}">
                <div class="app-header">
                    <iconify-icon icon="${app.icon}" class="app-icon" style="color: ${app.color}"></iconify-icon>
                    <h3 class="app-title">${this.escapeHtml(app.title)}</h3>
                </div>
                <p class="app-description">${this.escapeHtml(app.description)}</p>
                <div class="app-meta">
                    <span class="app-category">${this.escapeHtml(app.category)}</span>
                    <span class="app-visits">
                        <iconify-icon icon="mdi:eye"></iconify-icon>
                        ${visitText}
                    </span>
                </div>
            </a>
        `;
    }

    updateFooter() {
        const appCountEl = document.getElementById('app-count');
        const lastUpdatedEl = document.getElementById('last-updated');
        
        const count = this.apps.length;
        const countText = count === 1 ? '1 app' : `${count} apps`;
        appCountEl.textContent = countText;
        
        if (this.lastUpdated) {
            lastUpdatedEl.textContent = this.lastUpdated.toLocaleTimeString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app hub when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AppHub();
});
