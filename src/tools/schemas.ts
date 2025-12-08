/**
 * Common Zod schemas for MCP tool input validation
 */

import { z } from 'zod';

/**
 * Common repository configuration parameters
 */
export const repositoryParamsSchema = {
  force_refresh: z
    .boolean()
    .optional()
    .describe('Force refresh from GitHub (ignore pre-built index)'),
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
};

/**
 * Solution filter parameters
 */
export const solutionFilterSchema = {
  solution: z.string().optional().describe('Filter by solution name'),
};

/**
 * Type definitions for repository configuration
 */
export interface RepositoryConfig {
  force_refresh?: boolean;
  repository_owner?: string;
  repository_name?: string;
  repository_branch?: string;
}
