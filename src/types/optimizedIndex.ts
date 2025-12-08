/**
 * Optimized Index Types for LLM-Friendly Data Structure
 * Reduces token usage while maintaining searchability
 */

/**
 * Lightweight content summary without full KQL queries
 * Queries stored separately and loaded on-demand
 */
export interface LightweightDetection {
  id: string;
  name: string;
  description?: string;
  severity?: string;
  status?: string;
  tactics?: string[];
  techniques?: string[];
  queryHash?: string; // Hash of query for lookup
  querySize?: number; // Size in characters
  filePath?: string;
  solution?: string;
}

export interface LightweightHuntingQuery {
  id: string;
  name: string;
  description?: string;
  tactics?: string[];
  techniques?: string[];
  queryHash?: string;
  querySize?: number;
  filePath?: string;
  solution?: string;
}

export interface LightweightParser {
  id: string;
  name: string;
  description?: string;
  queryHash?: string;
  querySize?: number;
  filePath?: string;
  solution?: string;
}

export interface LightweightWorkbook {
  id: string;
  name: string;
  description?: string;
  category?: string;
  dataTypes?: string[];
  filePath?: string;
  solution?: string;
}

export interface LightweightPlaybook {
  id: string;
  name: string;
  description?: string;
  filePath?: string;
  solution?: string;
}

/**
 * Optimized index with separated metadata and content
 */
export interface OptimizedIndex {
  version: string;
  generatedAt: string;
  repositoryCommit?: string;

  // Summary statistics
  stats: {
    totalSolutions: number;
    totalConnectors: number;
    totalTables: number;
    totalDetections: number;
    totalWorkbooks: number;
    totalHuntingQueries: number;
    totalPlaybooks: number;
    totalParsers: number;
  };

  // Lightweight content (queries excluded)
  content: {
    detections: LightweightDetection[];
    huntingQueries: LightweightHuntingQuery[];
    workbooks: LightweightWorkbook[];
    playbooks: LightweightPlaybook[];
    parsers: LightweightParser[];
  };

  // Full connector-table mappings (smaller dataset)
  mappings: Array<{
    solution: string;
    connectorId: string;
    connectorTitle: string;
    tableName: string;
  }>;

  // Query lookup table (loaded on-demand)
  queryIndex?: {
    [hash: string]: {
      filePath: string;
      type: 'detection' | 'hunting' | 'parser' | 'function';
    };
  };
}

/**
 * Configuration for index optimization
 */
export interface IndexOptimizationConfig {
  // Whether to include query content in index
  includeQueries: boolean;

  // Whether to compress descriptions
  maxDescriptionLength: number;

  // Whether to include solution metadata in each item
  denormalize: boolean;
}
