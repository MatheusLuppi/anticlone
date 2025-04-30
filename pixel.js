// pixel.js - AntiClone Shield Verification Script

(function() {
    'use strict';

    // --- Configuration ---
    const API_ENDPOINT = '/api/verify'; // Relative to the domain where the script is hosted (backend)

    // --- Helper Functions ---

    // Function to get query parameters from the script tag's src
    function getScriptQueryParam(paramName) {
        const scripts = document.getElementsByTagName('script');
        // Find the script tag that includes 'pixel.js'
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
            if (src && src.includes('pixel.js')) {
                try {
                    const url = new URL(src);
                    return url.searchParams.get(paramName);
                } catch (e) {
                    console.error('AntiClone Shield: Error parsing script URL:', e);
                    return null;
                }
            }
        }
        // Fallback if not found in script src (should not happen with correct setup)
        try {
             const currentUrl = new URL(window.location.href); // Less reliable if script loaded differently
             return currentUrl.searchParams.get(paramName);
        } catch(e) {
            return null;
        }
    }

    // Function to perform the API call
    async function verifyDomain(clientId, currentDomain) {
        const url = `${API_ENDPOINT}?client_id=${encodeURIComponent(clientId)}&domain=${encodeURIComponent(currentDomain)}`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                // Include credentials if your backend requires cookies/sessions, but likely not needed for this endpoint
                // credentials: 'include' 
            });

            if (!response.ok) {
                // Handle non-2xx responses, but often we might still get a JSON body
                console.error(`AntiClone Shield: API request failed with status ${response.status}`);
                try {
                    const errorData = await response.json();
                    console.error('AntiClone Shield: API Error Data:', errorData);
                    return { status: 'error', message: `API Error: ${response.status}` }; // Default error state
                } catch (jsonError) {
                    // If response is not JSON
                    return { status: 'error', message: `API Error: ${response.status}` };
                }
            }

            const data = await response.json();
            console.log('AntiClone Shield: API Response:', data);
            return data; // Expected format: { status: "authorized" | "unauthorized" | "error", action?: "none" | "redirect" | "hide" | "replace_links", target?: "url" }

        } catch (error) {
            console.error('AntiClone Shield: Network error or failed to fetch:', error);
            return { status: 'error', message: 'Network error during verification.' }; // Network error state
        }
    }

    // --- Action Implementations ---

    function performRedirect(targetUrl) {
        console.log(`AntiClone Shield: Redirecting to ${targetUrl}`);
        // Use a more robust redirect method if possible
        window.location.replace(targetUrl);
        // As a fallback, hide content immediately
        document.documentElement.style.display = 'none'; 
    }

    function performHideContent() {
        console.log('AntiClone Shield: Hiding content.');
        // Hide the entire body content immediately
        // Using visibility: hidden might be slightly better than display: none initially
        // to avoid layout shifts if the script runs late, but display: none is more definitive.
        document.addEventListener('DOMContentLoaded', () => {
             if (document.body) {
                 document.body.style.visibility = 'hidden';
                 document.body.innerHTML = '<p style="text-align:center; padding: 20px; font-family: sans-serif;">Content unavailable.</p>'; // Optional message
                 document.body.style.visibility = 'visible';
             }
        });
        // Apply immediately if possible
         if (document.body) { 
             document.body.style.visibility = 'hidden'; 
         } else {
             // If body not ready, hide html element
             document.documentElement.style.display = 'none'; 
         }
    }

    function performReplaceLinks(targetUrl) {
        console.log(`AntiClone Shield: Replacing links to point to ${targetUrl}`);
        document.addEventListener('DOMContentLoaded', () => {
            const links = document.getElementsByTagName('a');
            for (let i = 0; i < links.length; i++) {
                // Simple replacement - might need refinement based on specific needs
                // Avoid replacing links that already point to the target or are internal anchors
                try {
                    const linkUrl = new URL(links[i].href, window.location.origin); // Resolve relative URLs
                    const target = new URL(targetUrl);
                    if (linkUrl.hostname !== target.hostname && !links[i].hash) { // Don't replace links to target or anchors
                         links[i].href = targetUrl;
                         // Optional: Add a visual indicator or rel attribute
                         // links[i].style.border = '1px dashed red'; 
                    }
                } catch(e) {
                    console.warn('AntiClone Shield: Could not process link:', links[i].href, e);
                }
            }
        });
    }

    // --- Main Execution Logic ---

    // Get client ID from script query parameter
    const clientId = getScriptQueryParam('client_id');
    if (!clientId) {
        console.error('AntiClone Shield: client_id not found in script parameters.');
        return; // Stop execution if client_id is missing
    }

    // Get the current hostname where the script is running
    const currentDomain = window.location.hostname;
    console.log(`AntiClone Shield: Verifying domain: ${currentDomain} for client: ${clientId}`);

    // Perform the verification
    verifyDomain(clientId, currentDomain).then(result => {
        if (!result) {
            console.error('AntiClone Shield: No result from verification API.');
            return;
        }

        if (result.status === 'unauthorized') {
            console.warn(`AntiClone Shield: Domain ${currentDomain} is unauthorized.`);
            switch (result.action) {
                case 'redirect':
                    if (result.target) {
                        performRedirect(result.target);
                    } else {
                        console.error('AntiClone Shield: Redirect action specified but no target URL provided.');
                        performHideContent(); // Fallback to hiding content
                    }
                    break;
                case 'hide':
                    performHideContent();
                    break;
                case 'replace_links':
                     if (result.target) {
                        performReplaceLinks(result.target);
                    } else {
                        console.error('AntiClone Shield: Replace links action specified but no target URL provided.');
                        // No clear fallback, maybe just log?
                    }
                    break;
                case 'none':
                default:
                    console.log('AntiClone Shield: Action set to none. Logging only.');
                    // No action needed on the client-side
                    break;
            }
        } else if (result.status === 'authorized') {
            console.log(`AntiClone Shield: Domain ${currentDomain} is authorized.`);
            // No action needed
        } else {
            // Handle API errors or unexpected status
            console.error(`AntiClone Shield: Verification resulted in status: ${result.status}. Message: ${result.message || 'No message'}`);
            // Decide if any default action should be taken on error? Probably not.
        }
    }).catch(error => {
        // Catch any unhandled promise rejections from verifyDomain itself
        console.error('AntiClone Shield: Unexpected error during verification process:', error);
    });

})(); // Self-executing function

