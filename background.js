chrome.action.onClicked.addListener((tab) => {
    // Check if the tab is a Salesforce tab before sending
    if (tab.url && (
        tab.url.includes('salesforce.com') || 
        tab.url.includes('force.com') || 
        tab.url.includes('visualforce.com') || 
        tab.url.includes('cloudforce.com')
    )) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" }).catch(err => {
            console.log("Error sending message to content script:", err);
            // If the content script isn't loaded (e.g. page hasn't refreshed), we can inject it programmatically,
            // but for simplicity, we just log.
        });
    }
});

