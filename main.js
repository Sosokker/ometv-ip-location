// ==UserScript==
// @name         Ome.tv IP Info Tool
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Displays IP and location info (incl. Org) for Ome.tv users.
// @match        https://ome.tv/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css
// ==/UserScript==

(function() {
    'use strict';

    // --- Global Variables ---
    // Stores state like current IP, API key, auto-fetch preference, and map link.
    let currentIP = null;
    let apiKey = localStorage.getItem('omeTvIpToolApiKey') || '';
    let autoFetch = localStorage.getItem('omeTvIpToolAutoFetch') === 'true';
    let mapLink = null;

    // --- UI Creation ---
    // Dynamically creates the HTML structure for the overlay window,
    // applies CSS styles for appearance and layout (including fixed size),
    // and attaches necessary event listeners to UI elements (inputs, buttons).
    function createUI() {
        const overlay = document.createElement('div');
        overlay.id = 'ipInfoOverlay';

        overlay.innerHTML = `
            <div id="ipInfoOverlayTitle" style="display: flex; justify-content: space-between; align-items: center;">Ome.tv IP Info <span style="font-size: 10px; color: #999;">(Drag Me)</span><button id="ipInfoOverlayClose" style="background: none; border: none; font-size: 18px; color: #888; cursor: pointer; margin-left: 10px;">&times;</button></div>
            <div class="ipInfoSection">
                <label for="apiKeyInput">API Key:</label>
                <div class="apiKeyWrapper">
                    <input type="password" id="apiKeyInput" placeholder="Enter ipinfo.io API Key">
                    <button id="toggleApiKey" class="ipInfoBtn-Icon"><i class="fas fa-eye"></i></button>
                </div>
            </div>
            <div class="ipInfoSection">
                 <label for="autoFetchCheckbox">Auto-fetch:</label>
                 <input type="checkbox" id="autoFetchCheckbox">
            </div>
            <div class="ipInfoSection">
                <strong>Status:</strong> <span id="ipInfoStatus">Waiting for connection...</span>
            </div>
            <div class="ipInfoSection">
                <strong>IP:</strong> <span id="ipInfoIP">-</span>
            </div>
            <div class="ipInfoSection">
                <strong>Details:</strong> <span id="ipInfoLocation">-</span>
            </div>
            <div class="ipInfoButtons">
                <button id="fetchDetailsBtn" class="ipInfoBtn" disabled>Fetch Details</button>
                <button id="openMapBtn" class="ipInfoBtn" disabled>Open Map</button>
                <button id="manualHookBtn" class="ipInfoBtn">Setup Hook</button>
            </div>
        `;

        let targetElement = document.querySelector('main#about') || document.body;
        targetElement.appendChild(overlay);

        // Add close button event
        overlay.querySelector('#ipInfoOverlayClose').addEventListener('click', () => {
            overlay.remove();
        });

        const style = document.createElement('style');
        // --- CSS Modifications Below ---
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Segoe+UI&display=swap');

            #ipInfoOverlay {
                position: fixed; bottom: 15px; right: 15px;
                width: 300px; height: 280px; overflow-y: auto;
                background-color: #f0f0f0; border: 2px solid #0078D4; /* border-radius removed */
                padding: 10px 15px; z-index: 10000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px;
                color: #333; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                line-height: 1.4; display: flex; flex-direction: column;
            }
            #ipInfoOverlayTitle {
                font-size: 16px; font-weight: bold; color: #005a9e;
                margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc;
                text-align: center; user-select: none; cursor: move; flex-shrink: 0;
            }
            .ipInfoSection { margin-bottom: 8px; flex-shrink: 0; }
            .ipInfoSection label { display: inline-block; width: 80px; font-weight: 600; vertical-align: middle; }
            .ipInfoSection input[type="checkbox"] { vertical-align: middle; margin-left: 5px; }
            #ipInfoLocation { display: block; margin-left: 75px; line-height: 1.5; word-wrap: break-word; }
            .apiKeyWrapper { display: inline-flex; align-items: center; border: 1px solid #ccc; border-radius: 3px; padding-right: 2px; background-color: #fff; max-width: calc(100% - 85px); }
            #apiKeyInput { border: none; outline: none; padding: 4px 6px; flex-grow: 1; font-size: 12px; min-width: 80px; }
            #ipInfoOverlay strong { font-weight: 600; display: inline-block; width: 70px; vertical-align: top; }
            .ipInfoButtons {
                margin-top: auto; padding-top: 10px;
                border-top: 1px solid #ccc; flex-shrink: 0;
                display: flex; /* Added for horizontal alignment */
                justify-content: flex-end; /* Added to push buttons right */
            }
            .ipInfoBtn, .ipInfoBtn-Icon { padding: 5px 10px; margin-left: 5px; border: 1px solid #0078D4; background-color: #e1e1e1; color: #333; border-radius: 3px; cursor: pointer; font-size: 12px; transition: background-color 0.2s ease; }
            .ipInfoBtn:hover:not(:disabled), .ipInfoBtn-Icon:hover { background-color: #cce4f7; }
            .ipInfoBtn:disabled { cursor: not-allowed; opacity: 0.6; border-color: #ccc; background-color: #e9e9e9; }
            .ipInfoBtn-Icon { background: none; border: none; padding: 4px; vertical-align: middle; line-height: 1; color: #0078D4; }
            .ipInfoBtn-Icon i { font-size: 14px; }
        `;
        // --- End of CSS Modifications ---
        document.head.appendChild(style);

        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement("link");
            faLink.rel = "stylesheet";
            faLink.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css";
            faLink.integrity = "sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2vcrdIwxfjThSH8CSR7PBEakCr51Ck+w+/U6swU2Im1vVX0SVk9ABhg==";
            faLink.crossOrigin = "anonymous";
            faLink.referrerPolicy = "no-referrer";
            document.head.appendChild(faLink);
        }

        const apiKeyInput = document.getElementById('apiKeyInput');
        const toggleApiKeyBtn = document.getElementById('toggleApiKey');
        const autoFetchCheckbox = document.getElementById('autoFetchCheckbox');
        const fetchDetailsBtn = document.getElementById('fetchDetailsBtn');
        const openMapBtn = document.getElementById('openMapBtn');
        const manualHookBtn = document.getElementById('manualHookBtn');

        apiKeyInput.value = apiKey;
        autoFetchCheckbox.checked = autoFetch;

        apiKeyInput.addEventListener('input', () => {
            apiKey = apiKeyInput.value;
            localStorage.setItem('omeTvIpToolApiKey', apiKey);
            updateStatus(apiKey ? 'API Key set.' : 'API Key missing!', apiKey ? 'info' : 'warn');
             if (currentIP && apiKey && fetchDetailsBtn) {
                 fetchDetailsBtn.disabled = false;
             } else if (!apiKey && fetchDetailsBtn) {
                 fetchDetailsBtn.disabled = true;
             }
        });

        toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);

        autoFetchCheckbox.addEventListener('change', () => {
             autoFetch = autoFetchCheckbox.checked;
             localStorage.setItem('omeTvIpToolAutoFetch', autoFetch);
        });

        fetchDetailsBtn.addEventListener('click', () => {
            if (currentIP) {
                gather(currentIP);
            }
        });

        openMapBtn.addEventListener('click', () => {
             if (mapLink) {
                 openMap(mapLink);
             }
        });

        manualHookBtn.addEventListener('click', () => {
            console.log("Manual hook setup triggered.");
            setupWebRTCHook();
        });

        dragElement(overlay, document.getElementById('ipInfoOverlayTitle'));
    }

    // --- Drag Element Functionality ---
    // Makes the specified element (elmnt) draggable by its handle (dragHandle).
    // It calculates the new position based on mouse movement and updates the
    // element's top/left styles, ensuring it stays within viewport bounds.
    function dragElement(elmnt, dragHandle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = dragHandle || elmnt;

        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'LABEL') {
                return;
            }
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;

            if (elmnt.style.bottom || elmnt.style.right) {
                 const rect = elmnt.getBoundingClientRect();
                 elmnt.style.top = rect.top + "px";
                 elmnt.style.left = rect.left + "px";
                 elmnt.style.bottom = "";
                 elmnt.style.right = "";
            }
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            let newTop = elmnt.offsetTop - pos2;
            let newLeft = elmnt.offsetLeft - pos1;

            const maxX = window.innerWidth - elmnt.offsetWidth;
            const maxY = window.innerHeight - elmnt.offsetHeight;
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));

            elmnt.style.top = newTop + "px";
            elmnt.style.left = newLeft + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // --- Helper Functions ---
    // Contains utility functions for updating specific parts of the UI (status, IP, location),
    // toggling API key visibility, and opening the map link.
    function updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('ipInfoStatus');
        if (statusEl) {
            statusEl.textContent = message;
             switch (type) {
                 case 'success': statusEl.style.color = 'green'; break;
                 case 'warn': statusEl.style.color = 'orange'; break;
                 case 'error': statusEl.style.color = 'red'; break;
                 default: statusEl.style.color = '#555';
            }
        } else {
            console.log(`Status [${type}]: ${message}`);
        }
    }

     function updateIpDisplay(ip) {
        const ipEl = document.getElementById('ipInfoIP');
        if(ipEl) ipEl.textContent = ip || '-';
     }

      function updateLocationDisplay(detailsHtml) {
        const locEl = document.getElementById('ipInfoLocation');
         if(locEl) locEl.innerHTML = detailsHtml || '-';
     }

    function toggleApiKeyVisibility() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const icon = document.querySelector('#toggleApiKey i');
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            apiKeyInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    function openMap(link) {
        if (link) {
            window.open(link, '_blank');
        }
    }

    // --- Core Logic (IP Details Fetching) ---
    // Handles fetching detailed IP information from the ipinfo.io API using the provided IP and API key.
    // Updates the UI with status messages, location details, and enables/disables buttons accordingly.
    // Handles potential errors during the API call.
    async function gather(ip) {
        const fetchBtn = document.getElementById('fetchDetailsBtn');
        const mapBtn = document.getElementById('openMapBtn');
        mapLink = null;

        if (!apiKey) {
            updateStatus('Error: ipinfo.io API Key is missing.', 'error');
            if (fetchBtn) fetchBtn.disabled = true;
            return;
        }

        updateStatus('Fetching details...', 'info');
        if (fetchBtn) fetchBtn.disabled = true;
        if (mapBtn) mapBtn.disabled = true;
        updateLocationDisplay('Loading...');

        try {
            const url = `https://ipinfo.io/${ip}/json?token=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) {
                 let errorDetail = '';
                 try {
                     const errorJson = await response.json();
                     errorDetail = errorJson.error?.message || JSON.stringify(errorJson.error) || response.statusText;
                 } catch (e) {
                     errorDetail = await response.text();
                 }
                 throw new Error(`API Error (${response.status}): ${errorDetail.substring(0, 150)}`);
            }
            const json = await response.json();

            if (json.bogon) {
                 updateStatus('Private/Reserved IP detected.', 'warn');
                 updateLocationDisplay('N/A (Bogon IP)');
                 currentIP = ip;
                 updateIpDisplay(ip)
                 if (fetchBtn && ip && apiKey) fetchBtn.disabled = false;
                 return;
            }

             if (json.ip) {
                currentIP = json.ip;
                updateIpDisplay(currentIP)

                let details = [];
                if (json.city) details.push(`City: ${json.city}`);
                if (json.region) details.push(`Region: ${json.region}`);
                if (json.country) details.push(`Country: ${json.country}`);
                if (json.org) details.push(`Org: ${json.org}`);
                if (json.postal) details.push(`Postal: ${json.postal}`);
                if (json.timezone) details.push(`Timezone: ${json.timezone}`);

                updateLocationDisplay(details.length > 0 ? details.join('<br>') : 'Details unavailable');

                if (json.loc) {
                     mapLink = `https://www.google.com/maps?q=${json.loc}`;
                    if (mapBtn) {
                         mapBtn.disabled = false;
                    }
                } else {
                    if (mapBtn) mapBtn.disabled = true;
                }
                 updateStatus('Details loaded successfully.', 'success');
            } else {
                 throw new Error("Invalid data received from API.");
            }

        } catch (error) {
            console.error("Failed to get IP information:", error);
            updateStatus(`Error: ${error.message}`, 'error');
            updateLocationDisplay('Failed to load');
            if (mapBtn) mapBtn.disabled = true;
        } finally {
             if (fetchBtn && currentIP && apiKey) {
                fetchBtn.disabled = false;
             } else if (fetchBtn) {
                 fetchBtn.disabled = true;
             }
        }
    }

    // --- WebRTC Hooking ---
    // Overrides the browser's default RTCPeerConnection functions (`addIceCandidate`, `setRemoteDescription`)
    // to intercept WebRTC negotiation details. It specifically looks for 'srflx' candidates, which
    // usually contain the peer's public IP address. When found, it updates the UI and potentially
    // triggers an automatic detail fetch if configured. Includes checks to prevent re-hooking.
    function setupWebRTCHook() {
        if (!window.RTCPeerConnection) {
             console.warn("RTCPeerConnection not found. Cannot intercept IP.");
             updateStatus("WebRTC not supported by browser.", "error");
             return;
        }

        if (window.oRTCPeerConnection) {
             console.log("WebRTC hook already active.");
             if (document.getElementById('ipInfoStatus')) {
                 const currentStatus = document.getElementById('ipInfoStatus').textContent;
                 if (currentStatus.includes('Waiting') || currentStatus.includes('Ready') || currentStatus.includes('captured') || currentStatus.includes('Hook active')) { // Added 'Hook active' check
                    updateStatus("WebRTC hook already active.", "info");
                 }
             }
             return;
        }

        window.oRTCPeerConnection = window.RTCPeerConnection;

        window.RTCPeerConnection = function(...args) {
            console.log("RTCPeerConnection created (hooked)");
            const pc = new window.oRTCPeerConnection(...args);
            const originalAddIceCandidate = pc.addIceCandidate;
            const originalSetRemoteDescription = pc.setRemoteDescription;

            pc.addIceCandidate = function(iceCandidate, ...rest) {
                if (iceCandidate && iceCandidate.candidate) {
                    const candidateString = iceCandidate.candidate;
                    const ipMatch = candidateString.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                    const typeMatch = candidateString.match(/typ\s+(srflx|prflx|relay|host)/);

                    if (ipMatch && typeMatch && typeMatch[1] === "srflx") {
                        const ip = ipMatch[0];
                        const type = typeMatch[1];

                        console.log(`Captured ${type} IP: ${ip} from addIceCandidate`);

                        if (currentIP !== ip) {
                            currentIP = ip;
                            updateIpDisplay(ip);
                            updateLocationDisplay('-');
                            mapLink = null;
                            const fetchBtn = document.getElementById('fetchDetailsBtn');
                            const mapBtn = document.getElementById('openMapBtn');

                            if (fetchBtn) fetchBtn.disabled = !apiKey;
                            if (mapBtn) mapBtn.disabled = true;

                            if (autoFetch && apiKey) {
                                console.log("Auto-fetching details for:", ip);
                                gather(ip);
                            } else if (autoFetch && !apiKey) {
                                updateStatus('IP captured. Auto-fetch needs API Key.', 'warn');
                            } else {
                                updateStatus('IP captured. Click "Fetch Details".', 'info');
                            }
                        }
                    }
                }
                return originalAddIceCandidate.apply(this, [iceCandidate, ...rest]);
            };

             pc.setRemoteDescription = function(sdp, ...rest) {
                 if (sdp && sdp.sdp) {
                     const sdpLines = sdp.sdp.split('\r\n');
                     for (const line of sdpLines) {
                         if (line.startsWith('a=candidate:') && line.includes(' typ srflx ')) {
                             const fields = line.split(' ');
                             if (fields.length >= 8) {
                                 const ip = fields[4];
                                 const type = fields[7];
                                 console.log(`Captured ${type} IP: ${ip} from setRemoteDescription`);

                                 if (currentIP !== ip) {
                                     currentIP = ip;
                                     updateIpDisplay(ip);
                                     updateLocationDisplay('-');
                                     mapLink = null;
                                     const fetchBtn = document.getElementById('fetchDetailsBtn');
                                     const mapBtn = document.getElementById('openMapBtn');

                                     if (fetchBtn) fetchBtn.disabled = !apiKey;
                                     if (mapBtn) mapBtn.disabled = true;

                                     if (autoFetch && apiKey) {
                                         console.log("Auto-fetching details for:", ip);
                                         gather(ip);
                                     } else if (autoFetch && !apiKey) {
                                         updateStatus('IP captured. Auto-fetch needs API Key.', 'warn');
                                     } else {
                                         updateStatus('IP captured. Click "Fetch Details".', 'info');
                                     }
                                 }
                                 // break; // Optional: stop after first srflx in SDP
                             }
                         }
                     }
                 }
                 return originalSetRemoteDescription.apply(this, [sdp, ...rest]);
             };

            return pc;
        };
        console.log("RTCPeerConnection hook installed successfully.");
        updateStatus(apiKey ? 'Hook active. Waiting for connection...' : 'Hook active. API Key missing!', apiKey ? 'info' : 'warn');
    }


    // --- Initialization ---
    // Sets up the script when the page loads. It ensures the DOM is ready,
    // then creates the UI elements and attempts to set up the WebRTC hook automatically.
    // Includes a check to prevent creating duplicate UI if the script runs multiple times.
    function initialize() {
        if (!document.getElementById('ipInfoOverlay')) {
            createUI();
            setupWebRTCHook();
        } else {
            console.log("IP Info Tool UI already exists. Skipping creation.");
            setupWebRTCHook(); // ensure the hook is always attempted on run
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM is already ready
        initialize();
    }

})();