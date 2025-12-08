/**
 * MCP Tools implementation for Microsoft Sentinel Solutions Analyzer
 */

import { z } from 'zod';
import { RepositoryManager } from '../repository/repoManager.js';
import { SolutionAnalyzer } from '../analyzer/solutionAnalyzer.js';
import { SingleSolutionAnalyzer } from '../analyzer/singleSolutionAnalyzer.js';
import {
  AnalysisResult,
  ConnectorTables,
  SolutionDetails,
  TableInfo,
  SearchResult,
  ValidationResult,
} from '../types/index.js';
import { extractTablesFromConnector } from '../analyzer/tableExtractor.js';
import { parseJsonTolerant } from '../analyzer/jsonParser.js';
import { loadPreBuiltIndex, isIndexStale } from '../utils/indexLoader.js';
import { ContentAnalyzer } from '../analyzer/contentAnalyzer.js';
import { Detection, Workbook, HuntingQuery, Playbook, Parser, DetectionFilters, WorkbookFilters, HuntingQueryFilters, Watchlist, Notebook, ExplorationQuery, Function, ASIMContent, SummaryRule } from '../types/content.js';

// Global cache for analysis results
let cachedAnalysisResult: AnalysisResult | null = null;
let cacheCommitHash: string | null = null;

const repoManager = new RepositoryManager();

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
    const analyzer = new SolutionAnalyzer(github);

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
    const analyzer = new SingleSolutionAnalyzer(github);

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

/**
 * Tool 7: List detections (analytics rules)
 */
export const listDetectionsTool = {
  name: 'list_detections',
  description: 'List and filter Microsoft Sentinel detection rules (analytics rules)',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    severity: z.string().optional().describe('Filter by severity (Informational, Low, Medium, High, Critical)'),
    tactic: z.string().optional().describe('Filter by MITRE ATT&CK tactic'),
    technique: z.string().optional().describe('Filter by MITRE ATT&CK technique'),
    force_refresh: z.boolean().optional().describe('Force refresh from GitHub'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: DetectionFilters & { force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Detection[]> => {
    // Check if using default repository and pre-built index is available
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let detections: Detection[];

    if (!args.force_refresh && isDefaultRepo) {
      // Try to use pre-built index
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.detections) {
        detections = preBuiltIndex.detections;
      } else {
        // Fall back to GitHub
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        detections = await analyzer.listDetections();
      }
    } else {
      // Fetch from GitHub (custom repo or force_refresh)
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      detections = await analyzer.listDetections();
    }

    // Apply filters
    if (args.solution) {
      detections = detections.filter(d => d.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.severity) {
      detections = detections.filter(d => d.severity?.toLowerCase() === args.severity!.toLowerCase());
    }
    if (args.tactic) {
      detections = detections.filter(d => d.tactics?.some(t => t.toLowerCase().includes(args.tactic!.toLowerCase())));
    }
    if (args.technique) {
      detections = detections.filter(d => d.techniques?.some(t => t.toLowerCase().includes(args.technique!.toLowerCase())));
    }

    return detections;
  },
};

/**
 * Tool 8: Get detection details
 */
export const getDetectionDetailsTool = {
  name: 'get_detection_details',
  description: 'Get detailed information about a specific detection rule',
  inputSchema: z.object({
    detection_id: z.string().describe('The detection rule ID'),
    force_refresh: z.boolean().optional().describe('Force refresh from GitHub'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { detection_id: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Detection | null> => {
    // Check if using default repository and pre-built index is available
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let detections: Detection[];

    if (!args.force_refresh && isDefaultRepo) {
      // Try to use pre-built index
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.detections) {
        detections = preBuiltIndex.detections;
      } else {
        // Fall back to GitHub
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        detections = await analyzer.listDetections();
      }
    } else {
      // Fetch from GitHub (custom repo or force_refresh)
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      detections = await analyzer.listDetections();
    }

    return detections.find(d => d.id === args.detection_id) || null;
  },
};

/**
 * Tool 9: List workbooks
 */
export const listWorkbooksTool = {
  name: 'list_workbooks',
  description: 'List and filter Microsoft Sentinel workbooks',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    category: z.string().optional().describe('Filter by workbook category'),
    force_refresh: z.boolean().optional().describe('Force refresh from GitHub'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: WorkbookFilters & { force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Workbook[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let workbooks: Workbook[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.workbooks) {
        workbooks = preBuiltIndex.workbooks;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        workbooks = await analyzer.listWorkbooks();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      workbooks = await analyzer.listWorkbooks();
    }

    // Apply filters
    if (args.solution) {
      workbooks = workbooks.filter(w => w.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.category) {
      workbooks = workbooks.filter(w => w.category?.toLowerCase().includes(args.category!.toLowerCase()));
    }

    return workbooks;
  },
};

/**
 * Tool 10: Get workbook details
 */
export const getWorkbookDetailsTool = {
  name: 'get_workbook_details',
  description: 'Get detailed information about a specific workbook',
  inputSchema: z.object({
    workbook_id: z.string().describe('The workbook ID or file path'),
    force_refresh: z.boolean().optional().describe('Force refresh from GitHub'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { workbook_id: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Workbook | null> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let workbooks: Workbook[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.workbooks) {
        workbooks = preBuiltIndex.workbooks;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        workbooks = await analyzer.listWorkbooks();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      workbooks = await analyzer.listWorkbooks();
    }

    return workbooks.find(w => w.id === args.workbook_id || w.filePath === args.workbook_id) || null;
  },
};

/**
 * Tool 11: List hunting queries
 */
export const listHuntingQueriesTool = {
  name: 'list_hunting_queries',
  description: 'List and filter Microsoft Sentinel hunting queries',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    tactic: z.string().optional().describe('Filter by MITRE ATT&CK tactic'),
    technique: z.string().optional().describe('Filter by MITRE ATT&CK technique'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: HuntingQueryFilters & { force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<HuntingQuery[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let queries: HuntingQuery[];

    if (!args.force_refresh && isDefaultRepo) {
      // Try to use pre-built index
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.huntingQueries) {
        queries = preBuiltIndex.huntingQueries;
      } else {
        // Fall back to GitHub
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        queries = await analyzer.listHuntingQueries();
      }
    } else {
      // Fetch from GitHub (custom repo or force_refresh)
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      queries = await analyzer.listHuntingQueries();
    }

    // Apply filters
    if (args.solution) {
      queries = queries.filter(q => q.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.tactic) {
      queries = queries.filter(q => q.tactics?.some(t => t.toLowerCase().includes(args.tactic!.toLowerCase())));
    }
    if (args.technique) {
      queries = queries.filter(q => q.techniques?.some(t => t.toLowerCase().includes(args.technique!.toLowerCase())));
    }

    return queries;
  },
};

/**
 * Tool 12: List playbooks
 */
export const listPlaybooksTool = {
  name: 'list_playbooks',
  description: 'List Microsoft Sentinel playbooks (Logic Apps)',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Playbook[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let playbooks: Playbook[];

    if (!args.force_refresh && isDefaultRepo) {
      // Try to use pre-built index
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.playbooks) {
        playbooks = preBuiltIndex.playbooks;
      } else {
        // Fall back to GitHub
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        playbooks = await analyzer.listPlaybooks();
      }
    } else {
      // Fetch from GitHub (custom repo or force_refresh)
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      playbooks = await analyzer.listPlaybooks();
    }

    // Apply filters
    if (args.solution) {
      playbooks = playbooks.filter(p => p.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }

    return playbooks;
  },
};

/**
 * Tool 13: List parsers
 */
export const listParsersTool = {
  name: 'list_parsers',
  description: 'List Microsoft Sentinel parsers (KQL functions)',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Parser[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let parsers: Parser[];

    if (!args.force_refresh && isDefaultRepo) {
      // Try to use pre-built index
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.parsers) {
        parsers = preBuiltIndex.parsers;
      } else {
        // Fall back to GitHub
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        parsers = await analyzer.listParsers();
      }
    } else {
      // Fetch from GitHub (custom repo or force_refresh)
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      parsers = await analyzer.listParsers();
    }

    // Apply filters
    if (args.solution) {
      parsers = parsers.filter(p => p.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }

    return parsers;
  },
};

/**
 * Tool 14: List watchlists
 */
export const listWatchlistsTool = {
  name: 'list_watchlists',
  description: 'List Microsoft Sentinel watchlists',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Watchlist[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let watchlists: Watchlist[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.watchlists) {
        watchlists = preBuiltIndex.watchlists;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        watchlists = await analyzer.listWatchlists();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      watchlists = await analyzer.listWatchlists();
    }

    if (args.solution) {
      watchlists = watchlists.filter(w => w.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }

    return watchlists;
  },
};

/**
 * Tool 15: List notebooks
 */
export const listNotebooksTool = {
  name: 'list_notebooks',
  description: 'List Microsoft Sentinel Jupyter notebooks',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Notebook[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let notebooks: Notebook[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.notebooks) {
        notebooks = preBuiltIndex.notebooks;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        notebooks = await analyzer.listNotebooks();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      notebooks = await analyzer.listNotebooks();
    }

    if (args.solution) {
      notebooks = notebooks.filter(n => n.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }

    return notebooks;
  },
};

/**
 * Tool 16: List exploration queries
 */
export const listExplorationQueriesTool = {
  name: 'list_exploration_queries',
  description: 'List Microsoft Sentinel exploration queries',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<ExplorationQuery[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let queries: ExplorationQuery[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.explorationQueries) {
        queries = preBuiltIndex.explorationQueries;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        queries = await analyzer.listExplorationQueries();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      queries = await analyzer.listExplorationQueries();
    }

    if (args.solution) {
      queries = queries.filter(q => q.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }

    return queries;
  },
};

/**
 * Tool 17: List functions
 */
export const listFunctionsTool = {
  name: 'list_functions',
  description: 'List Microsoft Sentinel saved functions',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Function[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let functions: Function[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.functions) {
        functions = preBuiltIndex.functions;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        functions = await analyzer.listFunctions();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      functions = await analyzer.listFunctions();
    }

    if (args.solution) {
      functions = functions.filter(f => f.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }

    return functions;
  },
};

/**
 * Tool 18: List ASIM content
 */
export const listASIMContentTool = {
  name: 'list_asim_content',
  description: 'List Microsoft Sentinel ASIM (Advanced Security Information Model) content',
  inputSchema: z.object({
    type: z.enum(['Parser', 'Schema', 'Documentation']).optional().describe('Filter by ASIM content type'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { type?: 'Parser' | 'Schema' | 'Documentation'; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<ASIMContent[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let content: ASIMContent[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.asimContent) {
        content = preBuiltIndex.asimContent;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        content = await analyzer.listASIMContent();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      content = await analyzer.listASIMContent();
    }

    if (args.type) {
      content = content.filter(c => c.type === args.type);
    }

    return content;
  },
};

/**
 * Tool 19: List summary rules
 */
export const listSummaryRulesTool = {
  name: 'list_summary_rules',
  description: 'List Microsoft Sentinel summary rules',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<SummaryRule[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let rules: SummaryRule[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.summaryRules) {
        rules = preBuiltIndex.summaryRules;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentAnalyzer(github);
        rules = await analyzer.listSummaryRules();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentAnalyzer(github);
      rules = await analyzer.listSummaryRules();
    }

    if (args.solution) {
      rules = rules.filter(r => r.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }

    return rules;
  },
};

/**
 * Helper: Ensure analysis has been run
 */
async function ensureAnalysis(): Promise<void> {
  if (!cachedAnalysisResult) {
    await analyzeSolutionsTool.execute({});
  }
}

/**
 * Helper: Format analysis result
 */
function formatAnalysisResult(
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

// Export all tools
export const allTools = [
  analyzeSolutionsTool,
  getConnectorTablesTool,
  searchSolutionsTool,
  getSolutionDetailsTool,
  listTablesTool,
  validateConnectorTool,
  listDetectionsTool,
  getDetectionDetailsTool,
  listWorkbooksTool,
  getWorkbookDetailsTool,
  listHuntingQueriesTool,
  listPlaybooksTool,
  listParsersTool,
  listWatchlistsTool,
  listNotebooksTool,
  listExplorationQueriesTool,
  listFunctionsTool,
  listASIMContentTool,
  listSummaryRulesTool,
];

// Manual JSON schemas for MCP (zodToJsonSchema has compatibility issues)
export const toolSchemas: Record<string, any> = {
  analyze_solutions: {
    type: 'object',
    properties: {
      force_refresh: {
        type: 'boolean',
        description: 'Force re-clone repository and refresh analysis',
      },
      output_format: {
        type: 'string',
        enum: ['json', 'csv', 'summary'],
        default: 'json',
        description: 'Output format for results',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
      solutions_path: {
        type: 'string',
        description: 'Path to solutions directory (default: Solutions)',
      },
    },
  },
  get_connector_tables: {
    type: 'object',
    properties: {
      connector_id: {
        type: 'string',
        description: 'The connector ID to look up',
      },
    },
    required: ['connector_id'],
  },
  search_solutions: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      publisher: {
        type: 'string',
        description: 'Filter by publisher',
      },
      support_tier: {
        type: 'string',
        description: 'Filter by support tier',
      },
    },
    required: ['query'],
  },
  get_solution_details: {
    type: 'object',
    properties: {
      solution_name: {
        type: 'string',
        description: 'The solution name',
      },
    },
    required: ['solution_name'],
  },
  list_tables: {
    type: 'object',
    properties: {
      table_type: {
        type: 'string',
        enum: ['all', 'custom', 'standard'],
        default: 'all',
        description: 'Filter by table type',
      },
    },
  },
  validate_connector: {
    type: 'object',
    properties: {
      connector_json: {
        type: 'string',
        description: 'Connector JSON content to validate',
      },
    },
    required: ['connector_json'],
  },
  list_detections: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      severity: {
        type: 'string',
        description: 'Filter by severity (Informational, Low, Medium, High, Critical)',
      },
      tactic: {
        type: 'string',
        description: 'Filter by MITRE ATT&CK tactic',
      },
      technique: {
        type: 'string',
        description: 'Filter by MITRE ATT&CK technique',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  get_detection_details: {
    type: 'object',
    properties: {
      detection_id: {
        type: 'string',
        description: 'The detection rule ID',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
    required: ['detection_id'],
  },
  list_workbooks: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      category: {
        type: 'string',
        description: 'Filter by workbook category',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  get_workbook_details: {
    type: 'object',
    properties: {
      workbook_id: {
        type: 'string',
        description: 'The workbook ID or file path',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
    required: ['workbook_id'],
  },
  list_hunting_queries: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      tactic: {
        type: 'string',
        description: 'Filter by MITRE ATT&CK tactic',
      },
      technique: {
        type: 'string',
        description: 'Filter by MITRE ATT&CK technique',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_playbooks: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_parsers: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_watchlists: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_notebooks: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_exploration_queries: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_functions: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_asim_content: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['Parser', 'Schema', 'Documentation'],
        description: 'Filter by ASIM content type',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
  list_summary_rules: {
    type: 'object',
    properties: {
      solution: {
        type: 'string',
        description: 'Filter by solution name',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Set to true to fetch latest data from GitHub (default: uses pre-built index)',
      },
      repository_owner: {
        type: 'string',
        description: 'GitHub repository owner (default: Azure)',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (default: Azure-Sentinel)',
      },
      repository_branch: {
        type: 'string',
        description: 'Repository branch (default: master)',
      },
    },
  },
};
