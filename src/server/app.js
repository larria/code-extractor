import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import open from 'open';
import { detectProject, scanProject } from '../core/Runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HISTORY_FILE = path.join(__dirname, 'history.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure history file exists
if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeJsonSync(HISTORY_FILE, []);
}

// === API ===

// 1. Get History
app.get('/api/history', async (req, res) => {
    try {
        const history = await fs.readJson(HISTORY_FILE);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Add/Update History
app.post('/api/history', async (req, res) => {
    try {
        const { path: projectPath, config } = req.body;
        let history = await fs.readJson(HISTORY_FILE);

        // Remove existing entry for this path if exists
        history = history.filter(h => h.path !== projectPath);

        // Add new entry to top
        history.unshift({
            path: projectPath,
            config,
            lastUsed: new Date().toISOString()
        });

        // Keep max 20 entries
        if (history.length > 20) history = history.slice(0, 20);

        await fs.writeJson(HISTORY_FILE, history, { spaces: 2 });
        res.json({ success: true, history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Detect Project
app.post('/api/detect', async (req, res) => {
    try {
        const { path: projectPath } = req.body;
        const result = await detectProject(projectPath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. Scan Project
app.post('/api/scan', async (req, res) => {
    try {
        const { path: projectPath, type, extraExcludes, extraIncludes } = req.body;

        const outputPath = await scanProject(projectPath, {
            type,
            extraExcludes,
            extraIncludes
        });

        res.json({ success: true, outputPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Auto open
    await open(`http://localhost:${PORT}`);
});
