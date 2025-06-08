// Link data will be fetched from the backend

async function fetchLinks() {
    try {
        const response = await fetch('/api/tw-grid-links');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const linksArray = await response.json();
        initializeLinkGrid(linksArray);
    } catch (error) {
        console.error('Error fetching links:', error);
        const grid = document.getElementById('linkGrid');
        if (grid) {
            grid.innerHTML = `<p class="text-red-400 col-span-full text-center">Error loading links. Please try again later.</p>`;
        }
    }
}

async function saveLinks(linksArray) {
    try {
        const response = await fetch('/api/tw-grid-links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(linksArray),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to save and parse error response' }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Failed to save'}`);
        }
        console.log('Links saved successfully!'); // Replace with user notification if desired
        return true; // Indicate success
    } catch (error) {
        console.error('Error saving links:', error);
        alert(`Error saving links: ${error.message}`); // Simple alert for now
        return false; // Indicate failure
    }
}


function getSizeClasses(size) {
    switch(size) {
        case 'large':
            return 'md:col-span-2 md:row-span-2';
        case 'wide':
            return 'md:col-span-2';
        // Medium and Small can share row/col span, differentiation is by image height or content
        case 'medium':
            return ''; // Default: takes 1 col, 1 row
        case 'small':
        default:
            return ''; // Default: takes 1 col, 1 row
    }
}

function getImageHeight(size) {
    // Ensure these Tailwind classes are available or define them if custom
    switch(size) {
        case 'large':
            return 'h-full'; // Assumes parent controls height
        case 'wide':
            return 'h-48 md:h-64'; // Example: specific height for wide
        case 'medium':
            return 'h-48 md:h-56'; // Example: specific height for medium
        case 'small':
        default:
            return 'h-32 md:h-48'; // Example: specific height for small
    }
}

function createLinkCard(link) {
    const sizeClasses = getSizeClasses(link.size);
    const imageHeight = getImageHeight(link.size);
    // Use a default image if link.image is not provided
    const imageUrl = link.image || 'https://via.placeholder.com/400x300/cccccc/969696?text=No+Image';
    const title = link.title || 'Untitled';
    const description = link.description || 'No description available.';
    const url = link.url || '#';

    return `
        <div class="${sizeClasses} relative overflow-hidden rounded-2xl shadow-xl group transform transition-all duration-300 hover:scale-105 cursor-pointer bg-gray-700"
             onclick="openLink('${url}')">
            <img src="${imageUrl}"
                 alt="${title}"
                 class="w-full ${imageHeight} object-cover transition-transform duration-300 group-hover:scale-110">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300 overlay-fade">
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-4 md:p-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                <h3 class="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2 drop-shadow-lg">${title}</h3>
                <p class="text-xs md:text-sm text-gray-200 opacity-90 drop-shadow-md">${description}</p>
            </div>
            ${url !== '#' ? `
            <div class="absolute top-3 right-3 md:top-4 md:right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div class="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <svg class="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                </div>
            </div>` : ''}
        </div>
    `;
}

function openLink(url) {
    if (url && url !== '#') {
        // Add a small delay for visual feedback
        setTimeout(() => {
            window.open(url, '_blank');
        }, 150);
    }
}

function initializeLinkGrid(linksArray) {
    const grid = document.getElementById('linkGrid');
    if (!grid) {
        console.error("linkGrid element not found");
        return;
    }

    if (!linksArray || linksArray.length === 0) {
        grid.innerHTML = '<p class="text-gray-400 col-span-full text-center">No links configured. Click the settings icon to add or edit links.</p>';
        return;
    }
    const linkCards = linksArray.map(link => createLinkCard(link)).join('');
    grid.innerHTML = linkCards;
}

// Initialize the grid when the page loads
document.addEventListener('DOMContentLoaded', fetchLinks);

// Modal Elements (assuming they will be added to HTML)
let modal; // Will be assigned in DOMContentLoaded after HTML is parsed
let linksJsonTextarea;
let saveModalButton;
let cancelModalButton;
let editLinksButton; // The button to open the modal

document.addEventListener('DOMContentLoaded', () => {
    modal = document.getElementById('editLinksModal');
    linksJsonTextarea = document.getElementById('linksJsonTextarea');
    saveModalButton = document.getElementById('saveModalButton');
    cancelModalButton = document.getElementById('cancelModalButton');
    editLinksButton = document.getElementById('editLinksButton'); // Assign this once HTML is updated

    if (editLinksButton) {
        editLinksButton.addEventListener('click', openEditModal);
    }
    if (saveModalButton) {
        saveModalButton.addEventListener('click', handleSaveModal);
    }
    if (cancelModalButton) {
        cancelModalButton.addEventListener('click', closeEditModal);
    }
});

async function openEditModal() {
    if (!modal || !linksJsonTextarea) {
        console.error("Modal elements not found for opening.");
        return;
    }
    try {
        const response = await fetch('/api/tw-grid-links');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const currentLinks = await response.json();
        linksJsonTextarea.value = JSON.stringify(currentLinks, null, 2); // Pretty print
        modal.style.display = 'block'; // Or 'flex' if using flex for centering
    } catch (error) {
        console.error('Error fetching links for modal:', error);
        alert('Could not load current links for editing. Please try again.');
    }
}

function closeEditModal() {
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleSaveModal() {
    if (!linksJsonTextarea) {
        console.error("Textarea for links JSON not found.");
        return;
    }
    try {
        const newLinksArray = JSON.parse(linksJsonTextarea.value);
        const success = await saveLinks(newLinksArray);
        if (success) {
            initializeLinkGrid(newLinksArray); // Update grid with new links
            closeEditModal();
            // Optionally, show a success notification
        }
        // If saveLinks returned false, it already showed an alert.
    } catch (error) {
        console.error('Error parsing or saving links from modal:', error);
        alert('Invalid JSON format. Please check your input.');
    }
}

