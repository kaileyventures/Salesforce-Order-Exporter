// Define a unique ID for our container
const CONTAINER_ID = "sf-order-exporter-sidebar-container";

function initSidebar() {
    // Avoid creating multiple iframes
    if (document.getElementById(CONTAINER_ID)) return;

    // Create container
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.right = '0';
    container.style.width = '380px';
    container.style.height = '100vh';
    container.style.zIndex = '2147483647'; // Max z-index to stay on top
    container.style.boxShadow = '-5px 0 25px rgba(0,0,0,0.5)';
    container.style.transition = 'transform 0.3s ease-in-out';
    // Start hidden (slide off screen to the right)
    container.style.transform = 'translateX(100%)';
    container.style.backgroundColor = 'transparent'; // Let iframe background handle it

    // Create iframe
    const iframe = document.createElement('iframe');
    // Load the popup.html from the extension
    iframe.src = chrome.runtime.getURL('popup.html');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = 'transparent';

    container.appendChild(iframe);
    document.body.appendChild(container);
}

// Toggle function
function toggleSidebar() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
        initSidebar();
        // Allow a tiny delay for DOM to register before animating
        setTimeout(() => {
            const newContainer = document.getElementById(CONTAINER_ID);
            newContainer.style.transform = 'translateX(0)';
        }, 50);
        return;
    }

    // Toggle sliding animation
    if (container.style.transform === 'translateX(0px)' || container.style.transform === 'translateX(0)') {
        container.style.transform = 'translateX(100%)';
    } else {
        container.style.transform = 'translateX(0)';
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle_sidebar") {
        toggleSidebar();
        sendResponse({status: "success"});
    }
});

// Optionally, inject it hidden on load to make first click faster
initSidebar();
