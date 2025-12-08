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

  // Detect if this is optimized format (version 2.x) or legacy format
  const isOptimized = index.version && index.version.startsWith('2.');
  const stats = isOptimized ? index.stats : index.metadata;
  const generatedAt = isOptimized ? index.generatedAt : index.metadata?.preBuiltAt;
  const version = isOptimized ? index.version : index.metadata?.version;

  console.log('\nIndex format:', isOptimized ? 'Optimized (LLM-friendly, queries excluded)' : 'Legacy (full)');
  console.log('\nIndex contents:');
  console.log(`  Solutions & Connectors:`);
  console.log(`    - Solutions: ${stats.totalSolutions}`);
  console.log(`    - Connectors: ${stats.totalConnectors}`);
  console.log(`    - Tables: ${stats.totalTables}`);
  console.log(`  Content Types:`);
  console.log(`    - Detections: ${stats.totalDetections}`);
  console.log(`    - Workbooks: ${stats.totalWorkbooks}`);
  console.log(`    - Hunting Queries: ${stats.totalHuntingQueries}`);
  console.log(`    - Playbooks: ${stats.totalPlaybooks}`);
  console.log(`    - Parsers: ${stats.totalParsers}`);
  if (!isOptimized) {
    console.log(`    - Watchlists: ${stats.totalWatchlists || 0}`);
    console.log(`    - Notebooks: ${stats.totalNotebooks || 0}`);
    console.log(`    - Exploration Queries: ${stats.totalExplorationQueries || 0}`);
    console.log(`    - Functions: ${stats.totalFunctions || 0}`);
    console.log(`    - ASIM Content: ${stats.totalASIMContent || 0}`);
    console.log(`    - Summary Rules: ${stats.totalSummaryRules || 0}`);
    console.log(`    - Tools: ${stats.totalTools || 0}`);
    console.log(`    - Tutorials: ${stats.totalTutorials || 0}`);
    console.log(`    - Dashboards: ${stats.totalDashboards || 0}`);
    console.log(`    - Data Connectors: ${stats.totalDataConnectors || 0}`);
  }
  console.log(`  Metadata:`);
  console.log(`    - Built at: ${generatedAt}`);
  console.log(`    - Version: ${version}`);

  if (elapsed < 1000) {
    console.log('\n✅ PASS: Index loads in under 1 second');
  } else {
    console.log('\n❌ FAIL: Index took longer than 1 second');
  }
} else {
  console.log('\n❌ Index file not found!');
}
