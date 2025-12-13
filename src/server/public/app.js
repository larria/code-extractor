const API_BASE = '/api';

const els = {
    pathInput: document.getElementById('project-path'),
    detectBtn: document.getElementById('detect-btn'),
    configSection: document.getElementById('config-section'),
    projectType: document.getElementById('project-type'),
    extraExcludes: document.getElementById('extra-excludes'),
    extraIncludes: document.getElementById('extra-includes'),
    scanBtn: document.getElementById('scan-btn'),
    resultSection: document.getElementById('result-section'),
    outputPath: document.getElementById('output-path'),
    historyList: document.getElementById('history-list'),
    dropZone: document.getElementById('drop-zone'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// Global State
let currentConfig = {
    path: '',
    type: 'unknown',
    extraExcludes: [],
    extraIncludes: []
};

// Init
loadHistory();

// Event Listeners
els.detectBtn.addEventListener('click', handleDetect);
els.scanBtn.addEventListener('click', handleScan);

// Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    els.dropZone.addEventListener(eventName, preventDefaults, false);
});
['dragenter', 'dragover'].forEach(eventName => {
    els.dropZone.addEventListener(eventName, highlight, false);
});
['dragleave', 'drop'].forEach(eventName => {
    els.dropZone.addEventListener(eventName, unhighlight, false);
});
els.dropZone.addEventListener('drop', handleDrop, false);

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}
function highlight() {
    els.dropZone.classList.add('drag-over');
}
function unhighlight() {
    els.dropZone.classList.remove('drag-over');
}
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files; // Valid if dragging from certain OS views

    // Note: Browser security limits reading full path from File object in many cases.
    // However, sometimes users drag folder text or we can try to infer.
    // Actually, modern browsers don't give real absolute path for security.
    // BUT since this is a local tool, maybe we can accept text string drop?

    // If files are dropped, we can try to read 'path' property if Electron or custom env, 
    // but in normal browser this might be empty string or fake path.
    // Code Extractor is running locally, so the user might be dragging from FS.
    // Users often just copy-paste path, but let's see.

    if (files && files.length > 0) {
        // Some browsers/Electron expose path
        const file = files[0];
        if (file.path) {
            els.pathInput.value = file.path;
            handleDetect(); // Auto detect on drop
            return;
        }
    }

    // Try text data
    const text = dt.getData('text/plain');
    if (text) {
        els.pathInput.value = text.trim();
        handleDetect();
    }
}

// Logic
async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/history`);
        const history = await res.json();
        renderHistory(history);
    } catch (e) {
        console.error('Failed to load history', e);
    }
}

function renderHistory(history) {
    els.historyList.innerHTML = '';
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const date = new Date(item.lastUsed).toLocaleString();
        const shortPath = item.path.split('/').pop() || item.path;
        div.innerHTML = `
            <div class="history-path" title="${item.path}">${shortPath}</div>
            <div class="history-time">${date}</div>
        `;
        div.onclick = () => loadConfigFromHistory(item);
        els.historyList.appendChild(div);
    });
}

function loadConfigFromHistory(item) {
    els.pathInput.value = item.path;
    currentConfig = { ...item.config, path: item.path };

    // Populate UI
    els.projectType.value = currentConfig.type || 'unknown';
    els.extraExcludes.value = (currentConfig.extraExcludes || []).join(', ');
    els.extraIncludes.value = (currentConfig.extraIncludes || []).join(', ');

    els.configSection.style.display = 'block';

    // Highlight detected type if we trust history
}

async function handleDetect() {
    const pathVal = els.pathInput.value.trim();
    if (!pathVal) return alert('Please enter a project path');

    showLoading(true, 'Detecting project type...');
    els.configSection.style.display = 'none';
    els.resultSection.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: pathVal })
        });

        if (!res.ok) throw new Error((await res.json()).error);

        const data = await res.json();

        // Update detected type
        els.projectType.value = data.type;
        els.configSection.style.display = 'block';

        // Pre-fill path in history logic happens on SAVE (Scan)
        currentConfig.path = pathVal;

    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        showLoading(false);
    }
}

async function handleScan() {
    const pathVal = els.pathInput.value.trim();
    if (!pathVal) return;

    const type = els.projectType.value;
    const excludes = els.extraExcludes.value.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    const includes = els.extraIncludes.value.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);

    const config = {
        type,
        extraExcludes: excludes,
        extraIncludes: includes
    };

    showLoading(true, 'Scanning... This may take a while.');

    try {
        const res = await fetch(`${API_BASE}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: pathVal,
                ...config
            })
        });

        if (!res.ok) throw new Error((await res.json()).error);

        const data = await res.json();

        els.outputPath.textContent = data.outputPath;
        els.resultSection.style.display = 'block';

        // Save to history
        await saveHistory(pathVal, config);
        await loadHistory();

    } catch (e) {
        alert('Scan Error: ' + e.message);
    } finally {
        showLoading(false);
    }
}

async function saveHistory(pathVal, config) {
    await fetch(`${API_BASE}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathVal, config })
    });
}

function showLoading(show, text = 'Loading...') {
    els.loadingOverlay.style.display = show ? 'flex' : 'none';
    els.loadingText.textContent = text;
}
