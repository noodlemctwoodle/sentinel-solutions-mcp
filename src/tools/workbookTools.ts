/**
 * Workbook Analysis Tools (Tools 9-10)
 */

import { z } from 'zod';
import { ContentScanner } from '../loaders/contentScanner.js';
import { Workbook, WorkbookFilters } from '../types/content.js';
import { loadPreBuiltIndex } from '../utils/indexLoader.js';
import { filterWorkbooks, applyLimit } from '../utils/contentFilters.js';

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
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
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

    // Apply filters using centralized utility
    workbooks = filterWorkbooks(workbooks, args);

    // Apply limit using centralized utility
    return applyLimit(workbooks, args.limit, 'workbooks');
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
