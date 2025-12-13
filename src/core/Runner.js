// src/core/Runner.js
import path from 'path';
import fs from 'fs-extra';
import { Detector } from './Detector.js';
import { Scanner } from './Scanner.js';

// BaseStrategy is needed if type is unknown or fallback
// We'll trust the Detector or create BaseStrategy
import BaseStrategy from '../strategies/BaseStrategy.js';

export async function detectProject(targetDir) {
    const absolutePath = path.resolve(targetDir);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Directory does not exist: ${absolutePath}`);
    }

    const detector = new Detector();
    const strategy = await detector.detect(absolutePath);

    return {
        type: strategy ? strategy.type : 'unknown',
        // We don't return the full strategy object over string serialization easily if it has methods, 
        // but for internal use it's fine. For API, we'll just return 'type'.
        strategy
    };
}

export async function getStrategyByType(type) {
    const detector = new Detector();
    let strategy = detector.strategies.find(s => s.type === type);

    if (!strategy) {
        // If not found in standard strategies, maybe it's unknown or generic-node
        // For now, default to BaseStrategy with custom type
        strategy = new BaseStrategy();
        if (type !== 'base') {
            // Allow overriding type name for display
            Object.defineProperty(strategy, 'type', { get: () => type, configurable: true });
        }
    }
    return strategy;
}

/**
 * Run the scan programmatically
 * @param {string} targetDir 
 * @param {object} options { type, extraExcludes, extraIncludes }
 */
export async function scanProject(targetDir, options = {}) {
    const {
        type,
        extraExcludes = [],
        extraIncludes = []
    } = options;

    const absolutePath = path.resolve(targetDir);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Directory not found: ${absolutePath}`);
    }

    let strategy;
    if (type) {
        strategy = await getStrategyByType(type);
    } else {
        // Auto-detect if not provided
        const result = await detectProject(absolutePath);
        strategy = result.strategy || new BaseStrategy();
    }

    const scanner = new Scanner(absolutePath, strategy, extraExcludes, extraIncludes);
    await scanner.run();

    // Return the output path or result if possible?
    // Scanner.run() logs to console and writes to file.
    // Ideally it should return the output path.
    // I will check Scanner.saveOutput logic, it constructs path.
    // For now let's assume it works as is, but maybe capturing the output path would be good.

    const projectName = path.basename(absolutePath);
    const parentDir = path.basename(path.dirname(absolutePath));
    const typeName = strategy.type;
    const fileName = `${projectName}-${typeName}-${parentDir}.md`;
    const outputDir = path.join(process.cwd(), 'output');
    return path.join(outputDir, fileName);
}
