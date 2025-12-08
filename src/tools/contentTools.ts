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
    limit: z.number().optional().default(100).describe('Maximum number of results to return (default: 100, max: 500)'),
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
    if (args.name) {
      queries = queries.filter(q => q.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.query_contains) {
      const searchTerm = args.query_contains.toLowerCase();
      queries = queries.filter(q => q.query?.toLowerCase().includes(searchTerm));
    }
    if (args.path_contains) {
      queries = queries.filter(q => q.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    // Apply limit (default 100, max 500)
    const totalResults = queries.length;
    const limit = Math.min(args.limit || 100, 500);

    if (totalResults > limit) {
      console.error(`⚠️  Returning ${limit} of ${totalResults} hunting queries. Use 'limit' parameter to adjust (max: 500).`);
    }

    return queries.slice(0, limit);
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
    limit: z.number().optional().default(100).describe('Maximum number of results to return (default: 100, max: 500)'),
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

    // Apply filters
    if (args.solution) {
      playbooks = playbooks.filter(p => p.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      playbooks = playbooks.filter(p => p.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      playbooks = playbooks.filter(p => p.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    // Apply limit (default 100, max 500)
    const totalResults = playbooks.length;
    const limit = Math.min(args.limit || 100, 500);

    if (totalResults > limit) {
      console.error(`⚠️  Returning ${limit} of ${totalResults} playbooks. Use 'limit' parameter to adjust (max: 500).`);
    }

    return playbooks.slice(0, limit);
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
    limit: z.number().optional().default(100).describe('Maximum number of results to return (default: 100, max: 500)'),
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

    // Apply filters
    if (args.solution) {
      parsers = parsers.filter(p => p.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      parsers = parsers.filter(p => p.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.query_contains) {
      const searchTerm = args.query_contains.toLowerCase();
      parsers = parsers.filter(p => p.query?.toLowerCase().includes(searchTerm));
    }
    if (args.path_contains) {
      parsers = parsers.filter(p => p.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    // Apply limit (default 100, max 500)
    const totalResults = parsers.length;
    const limit = Math.min(args.limit || 100, 500);

    if (totalResults > limit) {
      console.error(`⚠️  Returning ${limit} of ${totalResults} parsers. Use 'limit' parameter to adjust (max: 500).`);
    }

    return parsers.slice(0, limit);
  },
};

/**
 * Tool 14: List watchlists
 */
export const listWatchlistsTool = {
  name: 'list_watchlists',
  description: 'List Microsoft Sentinel watchlists - search by solution, name, or file path',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in watchlist name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Watchlist[]> => {
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

    if (args.solution) {
      watchlists = watchlists.filter(w => w.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      watchlists = watchlists.filter(w => w.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      watchlists = watchlists.filter(w => w.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return watchlists;
  },
};

/**
 * Tool 15: List notebooks
 */
export const listNotebooksTool = {
  name: 'list_notebooks',
  description: 'List Microsoft Sentinel Jupyter notebooks - search by solution, name, or file path',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in notebook name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Notebook[]> => {
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

    if (args.solution) {
      notebooks = notebooks.filter(n => n.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      notebooks = notebooks.filter(n => n.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      notebooks = notebooks.filter(n => n.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return notebooks;
  },
};

/**
 * Tool 16: List exploration queries
 */
export const listExplorationQueriesTool = {
  name: 'list_exploration_queries',
  description: 'List Microsoft Sentinel exploration queries - search by solution, name, query content, or file path',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in query name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; query_contains?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<ExplorationQuery[]> => {
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

    if (args.solution) {
      queries = queries.filter(q => q.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      queries = queries.filter(q => q.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.query_contains) {
      const searchTerm = args.query_contains.toLowerCase();
      queries = queries.filter(q => q.query?.toLowerCase().includes(searchTerm));
    }
    if (args.path_contains) {
      queries = queries.filter(q => q.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return queries;
  },
};

/**
 * Tool 17: List functions
 */
export const listFunctionsTool = {
  name: 'list_functions',
  description: 'List Microsoft Sentinel saved functions - search by solution, name, query content, or file path',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in function name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; query_contains?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<SentinelFunction[]> => {
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

    if (args.solution) {
      functions = functions.filter(f => f.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      functions = functions.filter(f => f.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.query_contains) {
      const searchTerm = args.query_contains.toLowerCase();
      functions = functions.filter(f => f.query?.toLowerCase().includes(searchTerm));
    }
    if (args.path_contains) {
      functions = functions.filter(f => f.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return functions;
  },
};

/**
 * Tool 18: List ASIM content
 */
export const listASIMContentTool = {
  name: 'list_asim_content',
  description: 'List Microsoft Sentinel ASIM (Advanced Security Information Model) content - search by type, name, or file path',
  inputSchema: z.object({
    type: z.enum(['Parser', 'Schema', 'Documentation']).optional().describe('Filter by ASIM content type'),
    name: z.string().optional().describe('Search in content name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { type?: 'Parser' | 'Schema' | 'Documentation'; name?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<ASIMContent[]> => {
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

    if (args.type) {
      content = content.filter(c => c.type === args.type);
    }
    if (args.name) {
      content = content.filter(c => c.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      content = content.filter(c => c.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return content;
  },
};

/**
 * Tool 19: List summary rules
 */
export const listSummaryRulesTool = {
  name: 'list_summary_rules',
  description: 'List Microsoft Sentinel summary rules - search by solution, name, query content, or file path',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in rule name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; query_contains?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<SummaryRule[]> => {
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

    if (args.solution) {
      rules = rules.filter(r => r.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      rules = rules.filter(r => r.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.query_contains) {
      const searchTerm = args.query_contains.toLowerCase();
      rules = rules.filter(r => r.query?.toLowerCase().includes(searchTerm));
    }
    if (args.path_contains) {
      rules = rules.filter(r => r.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return rules;
  },
};

/**
 * Tool 20: List tools
 */
export const listToolsTool = {
  name: 'list_tools',
  description: 'List Microsoft Sentinel tools and utilities - search by category, name, or file path',
  inputSchema: z.object({
    category: z.string().optional().describe('Filter by tool category'),
    name: z.string().optional().describe('Search in tool name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { category?: string; name?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Tool[]> => {
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

    if (args.category) {
      tools = tools.filter(t => t.category?.toLowerCase().includes(args.category!.toLowerCase()));
    }
    if (args.name) {
      tools = tools.filter(t => t.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      tools = tools.filter(t => t.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return tools;
  },
};

/**
 * Tool 21: List tutorials
 */
export const listTutorialsTool = {
  name: 'list_tutorials',
  description: 'List Microsoft Sentinel tutorials and learning resources - search by name or file path',
  inputSchema: z.object({
    name: z.string().optional().describe('Search in tutorial name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { name?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Tutorial[]> => {
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

    if (args.name) {
      tutorials = tutorials.filter(t => t.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      tutorials = tutorials.filter(t => t.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return tutorials;
  },
};

/**
 * Tool 22: List dashboards
 */
export const listDashboardsTool = {
  name: 'list_dashboards',
  description: 'List Microsoft Sentinel dashboards - search by solution, name, or file path',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    name: z.string().optional().describe('Search in dashboard name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { solution?: string; name?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Dashboard[]> => {
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

    if (args.solution) {
      dashboards = dashboards.filter(d => d.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.name) {
      dashboards = dashboards.filter(d => d.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      dashboards = dashboards.filter(d => d.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return dashboards;
  },
};

/**
 * Tool 23: List data connectors
 */
export const listDataConnectorsTool = {
  name: 'list_data_connectors',
  description: 'List Microsoft Sentinel data connectors - search by connector type, name, or file path',
  inputSchema: z.object({
    connector_type: z.string().optional().describe('Filter by connector type'),
    name: z.string().optional().describe('Search in connector name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    force_refresh: z.boolean().optional().describe('Set to true to fetch latest data from GitHub (default: uses pre-built index)'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: { connector_type?: string; name?: string; path_contains?: string; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<DataConnector[]> => {
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

    if (args.connector_type) {
      connectors = connectors.filter(c => c.connectorType?.toLowerCase().includes(args.connector_type!.toLowerCase()));
    }
    if (args.name) {
      connectors = connectors.filter(c => c.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      connectors = connectors.filter(c => c.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    return connectors;
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
