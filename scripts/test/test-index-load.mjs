#!/usr/bin/env node
/**
 * Quick test to verify pre-built index loads instantly
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing pre-built index loading...\n');

// Go up two levels from scripts/test/ to root, then into dist/
const projectRoot = join(__dirname, '..', '..');
const distDir = join(projectRoot, 'dist');
const indexPath = join(distDir, 'pre-built-index.json');

console.log('Looking for index at:', indexPath);
console.log('Index exists:', existsSync(indexPath));

if (existsSync(indexPath)) {
  console.log('\nLoading index...');
  const start = Date.now();

  const data = readFileSync(indexPath, 'utf-8');
  const index = JSON.parse(data);

  const elapsed = Date.now() - start;

  console.log(`\n✅ Index loaded in ${elapsed}ms`);
  console.log('\nIndex contents:');
  console.log(`  Solutions & Connectors:`);
  console.log(`    - Solutions: ${index.metadata.totalSolutions}`);
  console.log(`    - Connectors: ${index.metadata.totalConnectors}`);
  console.log(`    - Tables: ${index.metadata.totalTables}`);
  console.log(`  Content Types:`);
  console.log(`    - Detections: ${index.metadata.totalDetections}`);
  console.log(`    - Workbooks: ${index.metadata.totalWorkbooks}`);
  console.log(`    - Hunting Queries: ${index.metadata.totalHuntingQueries}`);
  console.log(`    - Playbooks: ${index.metadata.totalPlaybooks}`);
  console.log(`    - Parsers: ${index.metadata.totalParsers}`);
  console.log(`    - Watchlists: ${index.metadata.totalWatchlists}`);
  console.log(`    - Notebooks: ${index.metadata.totalNotebooks}`);
  console.log(`    - Exploration Queries: ${index.metadata.totalExplorationQueries}`);
  console.log(`    - Functions: ${index.metadata.totalFunctions}`);
  console.log(`    - ASIM Content: ${index.metadata.totalASIMContent}`);
  console.log(`    - Summary Rules: ${index.metadata.totalSummaryRules}`);
  console.log(`    - Tools: ${index.metadata.totalTools}`);
  console.log(`    - Tutorials: ${index.metadata.totalTutorials}`);
  console.log(`    - Dashboards: ${index.metadata.totalDashboards}`);
  console.log(`    - Data Connectors: ${index.metadata.totalDataConnectors}`);
  console.log(`  Metadata:`);
  console.log(`    - Built at: ${index.metadata.preBuiltAt}`);
  console.log(`    - Version: ${index.metadata.version}`);

  if (elapsed < 1000) {
    console.log('\n✅ PASS: Index loads in under 1 second');
  } else {
    console.log('\n❌ FAIL: Index took longer than 1 second');
  }
} else {
  console.log('\n❌ Index file not found!');
}
