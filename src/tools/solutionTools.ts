/**
 * Solution and Connector Analysis Tools (Tools 1-6)
 */

import { z } from 'zod';
import { RepositoryManager } from '../repository/repoManager.js';
import { SolutionLoader } from '../loaders/solutionLoader.js';
import { SingleSolutionLoader } from '../loaders/singleSolutionLoader.js';
import {
  AnalysisResult,
  ConnectorTables,
  SolutionDetails,
  TableInfo,
  SearchResult,
  ValidationResult,
} from '../types/index.js';
import { extractTablesFromConnector } from '../loaders/tableExtractor.js';
import { parseJsonTolerant } from '../loaders/jsonParser.js';
import { loadPreBuiltIndex, isIndexStale } from '../utils/indexLoader.js';

// Global cache for analysis results
let cachedAnalysisResult: AnalysisResult | null = null;
let cacheCommitHash: string | null = null;

const repoManager = new RepositoryManager();

/**
 * Helper: Ensure analysis has been run
 */
export async function ensureAnalysis(): Promise<void> {
  if (!cachedAnalysisResult) {
    await analyzeSolutionsTool.execute({});
  }
}

/**
 * Helper: Format analysis result
 */
export function formatAnalysisResult(
  result: AnalysisResult,
  format: 'json' | 'csv' | 'summary'
): any {
  if (format === 'summary') {
    return {
      summary: {
        totalSolutions: result.metadata.totalSolutions,
        totalConnectors: result.metadata.totalConnectors,
        totalTables: result.metadata.totalTables,
        totalIssues: result.issues.length,
        analysisDate: result.metadata.analysisDate,
        repositoryCommit: result.metadata.repositoryCommit,
      },
      topTables: getTopTables(result, 10),
      issueBreakdown: getIssueBreakdown(result),
    };
  }

  return result;
}

function getTopTables(result: AnalysisResult, limit: number): any[] {
  const tableCounts = new Map<string, number>();

  result.mappings.forEach((mapping) => {
    const count = tableCounts.get(mapping.tableName) || 0;
    tableCounts.set(mapping.tableName, count + 1);
  });

  return Array.from(tableCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([table, count]) => ({ table, connectorCount: count }));
}

function getIssueBreakdown(result: AnalysisResult): Record<string, number> {
  const breakdown: Record<string, number> = {};

  result.issues.forEach((issue) => {
    breakdown[issue.issueType] = (breakdown[issue.issueType] || 0) + 1;
  });

  return breakdown;
}

/**
 * Tool 1: Analyze all solutions
 */
export const analyzeSolutionsTool = {
  name: 'analyze_solutions',
  description:
    'Run full analysis on all Microsoft Sentinel solutions, extracting connector-table mappings',
  inputSchema: z.object({
    force_refresh: z
      .boolean()
      .optional()
      .describe('Force re-clone repository and refresh analysis'),
    output_format: z
      .enum(['json', 'csv', 'summary'])
      .optional()
      .default('json')
      .describe('Output format for results'),
    repository_owner: z
      .string()
      .optional()
      .describe('GitHub repository owner (default: Azure)'),
    repository_name: z
      .string()
      .optional()
      .describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z
      .string()
      .optional()
      .describe('Repository branch (default: master)'),
    solutions_path: z
      .string()
      .optional()
      .describe('Path to solutions directory (default: Solutions)'),
  }),
  execute: async (args: {
    force_refresh?: boolean;
    output_format?: 'json' | 'csv' | 'summary';
    repository_owner?: string;
    repository_name?: string;
    repository_branch?: string;
    solutions_path?: string;
  }): Promise<any> => {
    // Build repository config from args
    const repoConfig = {
      owner: args.repository_owner,
      name: args.repository_name,
      branch: args.repository_branch,
      solutionsPath: args.solutions_path,
    };

    // Try to use pre-built index first (unless force_refresh or custom repo)
    const isDefaultRepo =
      !args.repository_owner && !args.repository_name && !args.repository_branch;
    if (!args.force_refresh && !cachedAnalysisResult && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex) {
        // Check if index is stale (>7 days old)
        if (isIndexStale(preBuiltIndex)) {
          console.error(
            'WARNING: Pre-built index is stale (>7 days). Use force_refresh: true for latest data.'
          );
        }

        cachedAnalysisResult = preBuiltIndex;
        return formatAnalysisResult(preBuiltIndex, args.output_format || 'json');
      }
    }

    // Run fresh analysis using GitHub API
    console.error('Running fresh analysis from GitHub...');
    const github = new (await import('../repository/githubClient.js')).GitHubClient(
      repoConfig
    );
    const analyzer = new SolutionLoader(github);

    const result = await analyzer.analyze();

    // Update cache (only for default repo)
    if (isDefaultRepo) {
      const currentCommit = await github.getLatestCommitSha();
      cachedAnalysisResult = result;
      cacheCommitHash = currentCommit;
      cachedAnalysisResult.metadata.repositoryCommit = currentCommit;
    }

    return formatAnalysisResult(result, args.output_format || 'json');
  },
};

/**
 * Tool 2: Get connector tables
 */
export const getConnectorTablesTool = {
  name: 'get_connector_tables',
  description: 'Get table mappings for a specific connector ID',
  inputSchema: z.object({
    connector_id: z.string().describe('The connector ID to look up'),
  }),
  execute: async (args: { connector_id: string }): Promise<ConnectorTables | null> => {
    await ensureAnalysis();

    if (!cachedAnalysisResult) {
      throw new Error('Analysis results not available');
    }

    const connectorMappings = cachedAnalysisResult.mappings.filter(
      (m) => m.connectorId === args.connector_id
    );

    if (connectorMappings.length === 0) {
      return null;
    }

    const tables = connectorMappings.map((m) => ({
      tableName: m.tableName,
      detectionMethod: m.detectionMethod || 'unknown',
    }));

    return {
      connectorId: args.connector_id,
      connectorTitle: connectorMappings[0].connectorTitle,
      tables,
    };
  },
};

/**
 * Tool 3: Search solutions
 */
export const searchSolutionsTool = {
  name: 'search_solutions',
  description: 'Search solutions by name, publisher, or keyword',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    publisher: z.string().optional().describe('Filter by publisher'),
    support_tier: z.string().optional().describe('Filter by support tier'),
  }),
  execute: async (args: {
    query: string;
    publisher?: string;
    support_tier?: string;
  }): Promise<SearchResult> => {
    await ensureAnalysis();

    if (!cachedAnalysisResult) {
      throw new Error('Analysis results not available');
    }

    const queryLower = args.query.toLowerCase();

    // Group by solution
    const solutionMap = new Map<string, any>();

    cachedAnalysisResult.mappings.forEach((mapping) => {
      if (!solutionMap.has(mapping.solution)) {
        solutionMap.set(mapping.solution, {
          name: mapping.solution,
          publisher: mapping.publisher,
          version: mapping.version,
          supportTier: mapping.supportTier,
          connectorIds: new Set<string>(),
          tables: new Set<string>(),
        });
      }

      const sol = solutionMap.get(mapping.solution)!;
      sol.connectorIds.add(mapping.connectorId);
      sol.tables.add(mapping.tableName);
    });

    // Filter solutions
    const matchingSolutions = Array.from(solutionMap.values()).filter((sol) => {
      const matchesQuery = sol.name.toLowerCase().includes(queryLower);
      const matchesPublisher = !args.publisher || sol.publisher === args.publisher;
      const matchesTier = !args.support_tier || sol.supportTier === args.support_tier;

      return matchesQuery && matchesPublisher && matchesTier;
    });

    return {
      solutions: matchingSolutions.map((sol) => ({
        name: sol.name,
        publisher: sol.publisher,
        version: sol.version,
        supportTier: sol.supportTier,
        connectorCount: sol.connectorIds.size,
        tableCount: sol.tables.size,
      })),
    };
  },
};

/**
 * Tool 4: Get solution details (OPTIMIZED - doesn't require full analysis!)
 */
export const getSolutionDetailsTool = {
  name: 'get_solution_details',
  description: 'Get detailed information about a specific solution (fast - only analyzes requested solution)',
  inputSchema: z.object({
    solution_name: z.string().describe('The solution name'),
  }),
  execute: async (args: { solution_name: string }): Promise<SolutionDetails | null> => {
    // Use optimized single-solution analyzer - no need to analyze all 480!
    const github = repoManager.getGitHubClient();
    const analyzer = new SingleSolutionLoader(github);

    return await analyzer.analyzeSolution(args.solution_name);
  },
};

/**
 * Tool 5: List tables
 */
export const listTablesTool = {
  name: 'list_tables',
  description: 'Get all unique tables across all solutions',
  inputSchema: z.object({
    table_type: z
      .enum(['all', 'custom', 'standard'])
      .optional()
      .default('all')
      .describe('Filter by table type'),
  }),
  execute: async (args: { table_type?: 'all' | 'custom' | 'standard' }): Promise<TableInfo[]> => {
    await ensureAnalysis();

    if (!cachedAnalysisResult) {
      throw new Error('Analysis results not available');
    }

    const tableMap = new Map<string, TableInfo>();

    cachedAnalysisResult.mappings.forEach((mapping) => {
      if (!tableMap.has(mapping.tableName)) {
        tableMap.set(mapping.tableName, {
          tableName: mapping.tableName,
          isCustomLog: mapping.tableName.endsWith('_CL'),
          connectors: [],
        });
      }

      const tableInfo = tableMap.get(mapping.tableName)!;
      tableInfo.connectors.push({
        connectorId: mapping.connectorId,
        connectorTitle: mapping.connectorTitle,
        solution: mapping.solution,
      });
    });

    let tables = Array.from(tableMap.values());

    // Apply filter
    if (args.table_type === 'custom') {
      tables = tables.filter((t) => t.isCustomLog);
    } else if (args.table_type === 'standard') {
      tables = tables.filter((t) => !t.isCustomLog);
    }

    return tables;
  },
};

/**
 * Tool 6: Validate connector
 */
export const validateConnectorTool = {
  name: 'validate_connector',
  description: 'Validate a connector JSON definition and extract tables',
  inputSchema: z.object({
    connector_json: z.string().describe('Connector JSON content to validate'),
  }),
  execute: async (args: { connector_json: string }): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const extractedTables: string[] = [];

    // Try to parse JSON
    const parseResult = parseJsonTolerant(args.connector_json);

    if (parseResult.error || !parseResult.data) {
      errors.push(parseResult.error || 'Failed to parse JSON');
      return { isValid: false, errors, warnings, extractedTables };
    }

    const connector = parseResult.data;

    // Validate required fields
    if (!connector.id) {
      errors.push('Missing required field: id');
    }

    if (!connector.title) {
      warnings.push('Missing recommended field: title');
    }

    // Extract tables
    try {
      const extraction = extractTablesFromConnector(connector);

      extraction.tables.forEach((_, tableName) => {
        extractedTables.push(tableName);
      });

      if (extractedTables.length === 0 && extraction.parserReferences.size === 0) {
        warnings.push('No table references found in connector definition');
      }

      if (extraction.parserReferences.size > 0) {
        warnings.push(
          `Parser references found (not resolved): ${Array.from(extraction.parserReferences).join(', ')}`
        );
      }
    } catch (error) {
      errors.push(`Error extracting tables: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      extractedTables,
    };
  },
};

export const solutionTools = [
  analyzeSolutionsTool,
  getConnectorTablesTool,
  searchSolutionsTool,
  getSolutionDetailsTool,
  listTablesTool,
  validateConnectorTool,
];
