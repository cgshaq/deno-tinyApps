// Link data configuration
const links = [
    {
        title: "Google",
        description: "Search the web",
        url: "https://google.com",
        image: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=800&q=80",
        size: "large" // large, medium, small
    },
    {
        title: "GitHub",
        description: "Code repositories",
        url: "https://github.com",
        image: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&q=80",
        size: "small"
    },
    {
        title: "YouTube",
        description: "Video streaming",
        url: "https://youtube.com",
        image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
        size: "small"
    },
    {
        title: "Stack Overflow",
        description: "Programming Q&A",
        url: "https://stackoverflow.com",
        image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
        size: "medium"
    },
    {
        title: "Netflix",
        description: "Entertainment streaming",
        url: "https://netflix.com",
        image: "https://images.unsplash.com/photo-1489599162842-cd800fda4198?w=800&q=80",
        size: "medium"
    },
    {
        title: "LinkedIn",
        description: "Professional networking",
        url: "https://linkedin.com",
        image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80",
        size: "medium"
    },
    {
        title: "Twitter",
        description: "Social media platform",
        url: "https://twitter.com",
        image: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&q=80",
        size: "small"
    },
    {
        title: "Reddit",
        description: "The front page of the internet",
        url: "https://reddit.com",
        image: "https://images.unsplash.com/photo-1526378787940-576a539ba69d?w=800&q=80",
        size: "small"
    },
    {
        title: "Amazon",
        description: "Online shopping",
        url: "https://amazon.com",
        image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
        size: "large"
    },
    {
        title: "Wikipedia",
        description: "Free encyclopedia",
        url: "https://wikipedia.org",
        image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
        size: "small"
    },
    {
        title: "Discord",
        description: "Chat and communication",
        url: "https://discord.com",
        image: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=800&q=80",
        size: "small"
    },
    {
        title: "Spotify",
        description: "Music streaming",
        url: "https://spotify.com",
        image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
        size: "wide"
    }
];

function getSizeClasses(size) {
    switch(size) {
        case 'large':
            return 'md:col-span-2 md:row-span-2';
        case 'wide':
            return 'md:col-span-2';
        case 'medium':
            return '';
        case 'small':
        default:
            return '';
    }
}

function getImageHeight(size) {
    switch(size) {
        case 'large':
            return 'h-full';
        case 'wide':
            return 'h-48';
        case 'medium':
            return 'h-48';
        case 'small':
        default:
            return 'h-48';
    }
}

function createLinkCard(link) {
    const sizeClasses = getSizeClasses(link.size);
    const imageHeight = getImageHeight(link.size);

    return `
        <div class="${sizeClasses} relative overflow-hidden rounded-2xl shadow-xl group transform transition-all duration-300 hover:scale-105 cursor-pointer"
             onclick="openLink('${link.url}')">
            <img src="${link.image}" 
                 alt="${link.title}" 
                 class="w-full ${imageHeight} object-cover transition-transform duration-300 group-hover:scale-110">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300 overlay-fade">
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                <h3 class="text-2xl font-bold text-white mb-2 drop-shadow-lg">${link.title}</h3>
                <p class="text-gray-200 opacity-90 drop-shadow-md">${link.description}</p>
            </div>
            <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div class="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                </div>
            </div>
        </div>
    `;
}

function openLink(url) {
    // Add a small delay for visual feedback
    setTimeout(() => {
        window.open(url, '_blank');
    }, 150);
}

function initializeLinkGrid() {
    const grid = document.getElementById('linkGrid');
    const linkCards = links.map(link => createLinkCard(link)).join('');
    grid.innerHTML = linkCards;
}

// Initialize the grid when the page loads
document.addEventListener('DOMContentLoaded', initializeLinkGrid);

