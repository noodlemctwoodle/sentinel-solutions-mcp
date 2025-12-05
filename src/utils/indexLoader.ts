/**
 * Utility for loading pre-built analysis index
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AnalysisResult } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load the pre-built index from dist directory
 * Returns null if index doesn't exist or is invalid
 */
export function loadPreBuiltIndex(): AnalysisResult | null {
  try {
    // The pre-built index is in dist/ alongside the compiled code
    const indexPath = path.join(__dirname, 'pre-built-index.json');

    if (!fs.existsSync(indexPath)) {
      console.error('Pre-built index not found at:', indexPath);
      return null;
    }

    const indexData = fs.readFileSync(indexPath, 'utf-8');
    const result = JSON.parse(indexData) as AnalysisResult;

    console.error('Loaded pre-built index from', result.metadata.preBuiltAt);
    console.error(
      `   ${result.metadata.totalSolutions} solutions, ${result.metadata.totalConnectors} connectors, ${result.metadata.totalTables} tables`
    );

    return result;
  } catch (error) {
    console.error('Failed to load pre-built index:', error);
    return null;
  }
}

/**
 * Check if the pre-built index is stale (older than 7 days)
 */
export function isIndexStale(result: AnalysisResult): boolean {
  if (!result.metadata.preBuiltAt) {
    return true;
  }

  const preBuiltDate = new Date(result.metadata.preBuiltAt);
  const now = new Date();
  const daysDiff = (now.getTime() - preBuiltDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysDiff > 7;
}
