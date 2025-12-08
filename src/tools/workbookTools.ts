/**
 * Workbook Analysis Tools (Tools 9-10)
 */

import { z } from 'zod';
import { ContentScanner } from '../loaders/contentScanner.js';
import { Workbook, WorkbookFilters } from '../types/content.js';
import { loadPreBuiltIndex } from '../utils/indexLoader.js';

/**
 * Tool 9: List workbooks
 */
export const listWorkbooksTool = {
  name: 'list_workbooks',
  description: 'List and filter Microsoft Sentinel workbooks - search by solution, category, name, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    category: z.string().optional().describe('Filter by workbook category'),
    name: z.string().optional().describe('Search in workbook name/title'),
    path_contains: z.string().optional().describe('Search in file path'),
    limit: z.number().optional().default(100).describe('Maximum number of results to return (default: 100, max: 500)'),
    force_refresh: z.boolean().optional().describe('Force refresh from GitHub'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: WorkbookFilters & { limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Workbook[]> => {
    const isDefaultRepo = !args.repository_owner && !args.repository_name && !args.repository_branch;

    let workbooks: Workbook[];

    if (!args.force_refresh && isDefaultRepo) {
      const preBuiltIndex = loadPreBuiltIndex();
      if (preBuiltIndex?.workbooks) {
        workbooks = preBuiltIndex.workbooks;
      } else {
        const github = new (await import('../repository/githubClient.js')).GitHubClient();
        const analyzer = new ContentScanner(github);
        workbooks = await analyzer.listWorkbooks();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      workbooks = await analyzer.listWorkbooks();
    }

    // Apply filters
    if (args.solution) {
      workbooks = workbooks.filter(w => w.solution?.toLowerCase().includes(args.solution!.toLowerCase()));
    }
    if (args.category) {
      workbooks = workbooks.filter(w => w.category?.toLowerCase().includes(args.category!.toLowerCase()));
    }
    if (args.name) {
      workbooks = workbooks.filter(w => w.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.path_contains) {
      workbooks = workbooks.filter(w => w.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    // Apply limit (default 100, max 500)
    const totalResults = workbooks.length;
    const limit = Math.min(args.limit || 100, 500);

    if (totalResults > limit) {
      console.error(`⚠️  Returning ${limit} of ${totalResults} workbooks. Use 'limit' parameter to adjust (max: 500).`);
    }

    return workbooks.slice(0, limit);
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
        const analyzer = new ContentScanner(github);
        workbooks = await analyzer.listWorkbooks();
      }
    } else {
      const repoConfig = {
        owner: args.repository_owner,
        name: args.repository_name,
        branch: args.repository_branch,
      };
      const github = new (await import('../repository/githubClient.js')).GitHubClient(repoConfig);
      const analyzer = new ContentScanner(github);
      workbooks = await analyzer.listWorkbooks();
    }

    return workbooks.find(w => w.id === args.workbook_id || w.filePath === args.workbook_id) || null;
  },
};

export const workbookTools = [
  listWorkbooksTool,
  getWorkbookDetailsTool,
];
