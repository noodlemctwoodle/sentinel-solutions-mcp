/**
 * Utility for loading pre-built analysis index
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AnalysisResult } from '../types/index.js';
import { OptimizedIndex } from '../types/optimizedIndex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load the pre-built index from dist directory
 * Now loads optimized index by default (queries excluded)
 * Returns null if index doesn't exist or is invalid
 */
export function loadPreBuiltIndex(): AnalysisResult | null {
  try {
    const indexPath = path.join(__dirname, 'pre-built-index.json');

    if (!fs.existsSync(indexPath)) {
      console.error('Pre-built index not found at:', indexPath);
      return null;
    }

    const indexData = fs.readFileSync(indexPath, 'utf-8');

    // Try to parse as optimized index first
    try {
      const optimized = JSON.parse(indexData) as OptimizedIndex;
      if (optimized.version && optimized.version.startsWith('2.')) {
        // It's an optimized index
        console.error('✨ Loaded optimized LLM-friendly index (queries excluded)');
        console.error(
          `   ${optimized.stats.totalSolutions} solutions, ${optimized.stats.totalDetections} detections, ${optimized.stats.totalHuntingQueries} hunting queries`
        );
        return convertOptimizedToFull(optimized);
      }
    } catch {
      // Not optimized format, try full format
    }

    // Fall back to full AnalysisResult format
    const result = JSON.parse(indexData) as AnalysisResult;
    console.error('Loaded full pre-built index from', result.metadata.preBuiltAt);
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
 * Convert optimized index back to full AnalysisResult format
 * Note: queries will be undefined since they're excluded from optimized index
 */
function convertOptimizedToFull(optimized: OptimizedIndex): AnalysisResult {
  return {
    mappings: optimized.mappings.map((m) => ({
      solution: m.solution,
      publisher: '',
      version: '',
      connectorId: m.connectorId,
      connectorTitle: m.connectorTitle,
      tableName: m.tableName,
      isUnique: false,
    })),
    issues: [],
    detections: optimized.content.detections.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      severity: d.severity as 'Informational' | 'Low' | 'Medium' | 'High' | 'Critical' | undefined,
      status: d.status,
      tactics: d.tactics,
      techniques: d.techniques,
      query: undefined, // Excluded in optimized index
      filePath: d.filePath,
      solution: d.solution,
    })),
    workbooks: optimized.content.workbooks,
    huntingQueries: optimized.content.huntingQueries.map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description,
      tactics: q.tactics,
      techniques: q.techniques,
      query: undefined, // Excluded in optimized index
      filePath: q.filePath,
      solution: q.solution,
    })),
    playbooks: optimized.content.playbooks,
    parsers: optimized.content.parsers.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      query: undefined, // Excluded in optimized index
      filePath: p.filePath,
      solution: p.solution,
    })),
    metadata: {
      totalSolutions: optimized.stats.totalSolutions,
      totalConnectors: optimized.stats.totalConnectors,
      totalTables: optimized.stats.totalTables,
      totalDetections: optimized.stats.totalDetections,
      totalWorkbooks: optimized.stats.totalWorkbooks,
      totalHuntingQueries: optimized.stats.totalHuntingQueries,
      totalPlaybooks: optimized.stats.totalPlaybooks,
      totalParsers: optimized.stats.totalParsers,
      analysisDate: optimized.generatedAt,
      repositoryCommit: optimized.repositoryCommit,
      preBuiltAt: optimized.generatedAt,
      version: optimized.version,
    },
  };
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
