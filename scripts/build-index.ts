#!/usr/bin/env tsx
/**
 * Pre-build script to generate analysis index
 * Runs during npm build to create a snapshot of all Sentinel solutions
 */

import { GitHubClient } from '../src/repository/githubClient.js';
import { SolutionAnalyzer } from '../src/analyzer/solutionAnalyzer.js';
import { ContentAnalyzer } from '../src/analyzer/contentAnalyzer.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildIndex() {
  console.log('Building pre-built index...');

  try {
    const github = new GitHubClient();
    const solutionAnalyzer = new SolutionAnalyzer(github);
    const contentAnalyzer = new ContentAnalyzer(github);

    console.log('Analyzing all Microsoft Sentinel solutions...');
    const result = await solutionAnalyzer.analyze();

    console.log('\nAnalyzing all content types...');
    console.log('Fetching detections...');
    const detections = await contentAnalyzer.listDetections();

    console.log('Fetching workbooks...');
    const workbooks = await contentAnalyzer.listWorkbooks();

    console.log('Fetching hunting queries...');
    const huntingQueries = await contentAnalyzer.listHuntingQueries();

    console.log('Fetching playbooks...');
    const playbooks = await contentAnalyzer.listPlaybooks();

    console.log('Fetching parsers...');
    const parsers = await contentAnalyzer.listParsers();

    console.log('Fetching watchlists...');
    const watchlists = await contentAnalyzer.listWatchlists();

    console.log('Fetching notebooks...');
    const notebooks = await contentAnalyzer.listNotebooks();

    console.log('Fetching exploration queries...');
    const explorationQueries = await contentAnalyzer.listExplorationQueries();

    console.log('Fetching functions...');
    const functions = await contentAnalyzer.listFunctions();

    console.log('Fetching ASIM content...');
    const asimContent = await contentAnalyzer.listASIMContent();

    console.log('Fetching summary rules...');
    const summaryRules = await contentAnalyzer.listSummaryRules();

    console.log('Fetching tools...');
    const tools = await contentAnalyzer.listTools();

    console.log('Fetching tutorials...');
    const tutorials = await contentAnalyzer.listTutorials();

    console.log('Fetching dashboards...');
    const dashboards = await contentAnalyzer.listDashboards();

    console.log('Fetching data connectors...');
    const dataConnectors = await contentAnalyzer.listDataConnectors();

    // Add build metadata
    const indexData = {
      ...result,
      detections,
      workbooks,
      huntingQueries,
      playbooks,
      parsers,
      watchlists,
      notebooks,
      explorationQueries,
      functions,
      asimContent,
      summaryRules,
      tools,
      tutorials,
      dashboards,
      dataConnectors,
      metadata: {
        ...result.metadata,
        totalDetections: detections.length,
        totalWorkbooks: workbooks.length,
        totalHuntingQueries: huntingQueries.length,
        totalPlaybooks: playbooks.length,
        totalParsers: parsers.length,
        totalWatchlists: watchlists.length,
        totalNotebooks: notebooks.length,
        totalExplorationQueries: explorationQueries.length,
        totalFunctions: functions.length,
        totalASIMContent: asimContent.length,
        totalSummaryRules: summaryRules.length,
        totalTools: tools.length,
        totalTutorials: tutorials.length,
        totalDashboards: dashboards.length,
        totalDataConnectors: dataConnectors.length,
        preBuiltAt: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      },
    };

    // Ensure dist directory exists
    const distDir = path.join(__dirname, '../dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Write to dist/pre-built-index.json
    const outputPath = path.join(distDir, 'pre-built-index.json');
    fs.writeFileSync(outputPath, JSON.stringify(indexData, null, 2));

    console.log('\n=================================================');
    console.log('   COMPLETE INDEX BUILD SUCCESSFUL');
    console.log('=================================================');
    console.log(`\n📊 Solutions & Connectors:`);
    console.log(`   - Solutions: ${result.metadata.totalSolutions}`);
    console.log(`   - Connectors: ${result.metadata.totalConnectors}`);
    console.log(`   - Tables: ${result.metadata.totalTables}`);
    console.log(`   - Mappings: ${result.mappings.length}`);
    console.log(`\n📁 Content Types:`);
    console.log(`   - Detections: ${detections.length}`);
    console.log(`   - Workbooks: ${workbooks.length}`);
    console.log(`   - Hunting Queries: ${huntingQueries.length}`);
    console.log(`   - Playbooks: ${playbooks.length}`);
    console.log(`   - Parsers: ${parsers.length}`);
    console.log(`   - Watchlists: ${watchlists.length}`);
    console.log(`   - Notebooks: ${notebooks.length}`);
    console.log(`   - Exploration Queries: ${explorationQueries.length}`);
    console.log(`   - Functions: ${functions.length}`);
    console.log(`   - ASIM Content: ${asimContent.length}`);
    console.log(`   - Summary Rules: ${summaryRules.length}`);
    console.log(`   - Tools: ${tools.length}`);
    console.log(`   - Tutorials: ${tutorials.length}`);
    console.log(`   - Dashboards: ${dashboards.length}`);
    console.log(`   - Data Connectors: ${dataConnectors.length}`);
    console.log(`\n📦 Index Details:`);
    console.log(`   - Location: ${outputPath}`);
    console.log(`   - Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Built: ${new Date().toISOString()}`);
    console.log('\n=================================================');
  } catch (error) {
    console.error('ERROR: Failed to build index:', error);
    process.exit(1);
  }
}

buildIndex();
