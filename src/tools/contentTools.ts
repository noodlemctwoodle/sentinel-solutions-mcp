/**
 * Content Analysis Tools (Tools 11-23)
 */

import { z } from 'zod';
import { ContentScanner } from '../loaders/contentScanner.js';
import {
  HuntingQuery,
  HuntingQueryFilters,
  Playbook,
  Parser,
  Watchlist,
  Notebook,
  ExplorationQuery,
  Function as SentinelFunction,
  ASIMContent,
  SummaryRule,
  Tool,
  Tutorial,
  Dashboard,
  DataConnector
} from '../types/content.js';
import { loadPreBuiltIndex } from '../utils/indexLoader.js';
import { filterHuntingQueries, filterGenericContent, applyLimit, filterPlaybooks, filterParsers } from '../utils/contentFilters.js';

/**
 * Tool 11: List hunting queries
 */
export const listHuntingQueriesTool = {
  name: 'list_hunting_queries',
  description: 'List and filter Microsoft Sentinel hunting queries - search by solution, tactic, technique, name, query content, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    tactic: z.string().optional().describe('Filter by MITRE ATT&CK tactic'),
    technique: z.string().optional().describe('Filter by MITRE ATT&CK technique'),
    name: z.string().optional().describe('Search in query name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query (e.g., table names like "Syslog", "SecurityEvent")'),
    path_contains: z.string().optional().describe('Search in file path (e.g., "Syslog", "Linux")'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: HuntingQueryFilters & { limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<HuntingQuery[]> => {
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
        const analyzer = new ContentScanner(github);
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
      const analyzer = new ContentScanner(github);
      queries = await analyzer.listHuntingQueries();
    }

    // Apply filters using centralized utility
    queries = filterHuntingQueries(queries, args);

    // Apply limit using centralized utility
    return applyLimit(queries, args.limit, 'hunting queries');
  },
};

/**
 * Tool 12: List playbooks
 */
export const listPlaybooksTool = {
  name: 'list_playbooks',
  description: 'List Microsoft Sentinel playbooks (Logic Apps) - search by solution, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in playbook name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Playbook[]> => {
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
        const analyzer = new ContentScanner(github);
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
      const analyzer = new ContentScanner(github);
      playbooks = await analyzer.listPlaybooks();
    }

    // Apply filters using centralized utility
    playbooks = filterPlaybooks(playbooks, args);

    // Apply limit using centralized utility
    return applyLimit(playbooks, args.limit, 'playbooks');
  },
};

/**
 * Tool 13: List parsers
 */
export const listParsersTool = {
  name: 'list_parsers',
  description: 'List Microsoft Sentinel parsers (KQL functions) - search by solution, name, query content, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in parser name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; query_contains?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Parser[]> => {
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
        const analyzer = new ContentScanner(github);
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
      const analyzer = new ContentScanner(github);
      parsers = await analyzer.listParsers();
    }

    // Apply filters using centralized utility
    parsers = filterParsers(parsers, args);

    // Apply limit using centralized utility
    return applyLimit(parsers, args.limit, 'parsers');
  },
};

/**
 * Tool 14: List watchlists
 */
export const listWatchlistsTool = {
  name: 'list_watchlists',
  description: 'List Microsoft Sentinel watchlists - search by solution, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in watchlist name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Watchlist[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let watchlists: Watchlist[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.watchlists) {
        watchlists = preBuiltIndex.watchlists;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        watchlists = await analyzer.listWatchlists();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      watchlists = await analyzer.listWatchlists();
    }

    // Apply filters using centralized utility
    watchlists = filterGenericContent(watchlists, args);

    // Apply limit using centralized utility
    return applyLimit(watchlists, args.limit, 'watchlists');
  },
};

/**
 * Tool 15: List notebooks
 */
export const listNotebooksTool = {
  name: 'list_notebooks',
  description: 'List Microsoft Sentinel Jupyter notebooks - search by solution, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in notebook name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Notebook[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let notebooks: Notebook[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.notebooks) {
        notebooks = preBuiltIndex.notebooks;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        notebooks = await analyzer.listNotebooks();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      notebooks = await analyzer.listNotebooks();
    }

    // Apply filters using centralized utility
    notebooks = filterGenericContent(notebooks, args);

    // Apply limit using centralized utility
    return applyLimit(notebooks, args.limit, 'notebooks');
  },
};

/**
 * Tool 16: List exploration queries
 */
export const listExplorationQueriesTool = {
  name: 'list_exploration_queries',
  description: 'List Microsoft Sentinel exploration queries - search by solution, name, query content, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in query name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; query_contains?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<ExplorationQuery[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let queries: ExplorationQuery[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.explorationQueries) {
        queries = preBuiltIndex.explorationQueries;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        queries = await analyzer.listExplorationQueries();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      queries = await analyzer.listExplorationQueries();
    }

    // Apply filters using centralized utility
    queries = filterGenericContent(queries, args);

    // Apply limit using centralized utility
    return applyLimit(queries, args.limit, 'exploration queries');
  },
};

/**
 * Tool 17: List functions
 */
export const listFunctionsTool = {
  name: 'list_functions',
  description: 'List Microsoft Sentinel saved functions - search by solution, name, query content, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in function name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; query_contains?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<SentinelFunction[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let functions: SentinelFunction[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.functions) {
        functions = preBuiltIndex.functions;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        functions = await analyzer.listFunctions();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      functions = await analyzer.listFunctions();
    }

    // Apply filters using centralized utility
    functions = filterGenericContent(functions, args);

    // Apply limit using centralized utility
    return applyLimit(functions, args.limit, 'functions');
  },
};

/**
 * Tool 18: List ASIM content
 */
export const listASIMContentTool = {
  name: 'list_asim_content',
  description: 'List Microsoft Sentinel ASIM (Advanced Security Information Model) content - search by type, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    type: z.enum(['Parser', 'Schema', 'Documentation']).optional().describe('Filter by ASIM content type'),
    name: z.string().optional().describe('Search in content name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { type?: 'Parser' | 'Schema' | 'Documentation'; name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<ASIMContent[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let content: ASIMContent[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.asimContent) {
        content = preBuiltIndex.asimContent;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        content = await analyzer.listASIMContent();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      content = await analyzer.listASIMContent();
    }

    // Apply type filter
    if (args.type) {
      content = content.filter(c => c.type === args.type);
    }

    // Apply generic filters using centralized utility
    content = filterGenericContent(content, args);

    // Apply limit using centralized utility
    return applyLimit(content, args.limit, 'ASIM content items');
  },
};

/**
 * Tool 19: List summary rules
 */
export const listSummaryRulesTool = {
  name: 'list_summary_rules',
  description: 'List Microsoft Sentinel summary rules - search by solution, name, query content, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in rule name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; query_contains?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<SummaryRule[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let rules: SummaryRule[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.summaryRules) {
        rules = preBuiltIndex.summaryRules;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        rules = await analyzer.listSummaryRules();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      rules = await analyzer.listSummaryRules();
    }

    // Apply filters using centralized utility
    rules = filterGenericContent(rules, args);

    // Apply limit using centralized utility
    return applyLimit(rules, args.limit, 'summary rules');
  },
};

/**
 * Tool 20: List tools
 */
export const listToolsTool = {
  name: 'list_tools',
  description: 'List Microsoft Sentinel tools and utilities - search by category, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    category: z.string().optional().describe('Filter by tool category'),
    name: z.string().optional().describe('Search in tool name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { category?: string; name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Tool[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let tools: Tool[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.tools) {
        tools = preBuiltIndex.tools;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        tools = await analyzer.listTools();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      tools = await analyzer.listTools();
    }

    // Apply category filter
    if (args.category) {
      tools = tools.filter(t => t.category?.toLowerCase().includes(args.category!.toLowerCase()));
    }

    // Apply generic filters using centralized utility
    tools = filterGenericContent(tools, args);

    // Apply limit using centralized utility
    return applyLimit(tools, args.limit, 'tools');
  },
};

/**
 * Tool 21: List tutorials
 */
export const listTutorialsTool = {
  name: 'list_tutorials',
  description: 'List Microsoft Sentinel tutorials and learning resources - search by name or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    name: z.string().optional().describe('Search in tutorial name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Tutorial[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let tutorials: Tutorial[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.tutorials) {
        tutorials = preBuiltIndex.tutorials;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        tutorials = await analyzer.listTutorials();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      tutorials = await analyzer.listTutorials();
    }

    // Apply filters using centralized utility
    tutorials = filterGenericContent(tutorials, args);

    // Apply limit using centralized utility
    return applyLimit(tutorials, args.limit, 'tutorials');
  },
};

/**
 * Tool 22: List dashboards
 */
export const listDashboardsTool = {
  name: 'list_dashboards',
  description: 'List Microsoft Sentinel dashboards - search by solution, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in dashboard name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Dashboard[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let dashboards: Dashboard[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.dashboards) {
        dashboards = preBuiltIndex.dashboards;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        dashboards = await analyzer.listDashboards();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      dashboards = await analyzer.listDashboards();
    }

    // Apply filters using centralized utility
    dashboards = filterGenericContent(dashboards, args);

    // Apply limit using centralized utility
    return applyLimit(dashboards, args.limit, 'dashboards');
  },
};

/**
 * Tool 23: List data connectors
 */
export const listDataConnectorsTool = {
  name: 'list_data_connectors',
  description: 'List Microsoft Sentinel data connectors - search by connector type, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    connector_type: z.string().optional().describe('Filter by connector type'),
    name: z.string().optional().describe('Search in connector name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { connector_type?: string; name?: string; path_contains?: string; limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<DataConnector[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let connectors: DataConnector[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.dataConnectors) {
        connectors = preBuiltIndex.dataConnectors;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        connectors = await analyzer.listDataConnectors();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      connectors = await analyzer.listDataConnectors();
    }

    // Apply connector type filter
    if (args.connector_type) {
      connectors = connectors.filter(c => c.connectorType?.toLowerCase().includes(args.connector_type!.toLowerCase()));
    }

    // Apply generic filters using centralized utility
    connectors = filterGenericContent(connectors, args);

    // Apply limit using centralized utility
    return applyLimit(connectors, args.limit, 'data connectors');
  },
};

export const contentTools = [
  listHuntingQueriesTool,
  listPlaybooksTool,
  listParsersTool,
  listWatchlistsTool,
  listNotebooksTool,
  listExplorationQueriesTool,
  listFunctionsTool,
  listASIMContentTool,
  listSummaryRulesTool,
  listToolsTool,
  listTutorialsTool,
  listDashboardsTool,
  listDataConnectorsTool,
];
