/**
 * Detection Analysis Tools (Tools 7-8)
 */

import { z } from 'zod';
import { ContentScanner } from '../loaders/contentScanner.js';
import { Detection, DetectionFilters } from '../types/content.js';
import { loadPreBuiltIndex } from '../utils/indexLoader.js';
import { filterDetections, applyLimit } from '../utils/contentFilters.js';

/**
 * Tool 7: List detections
 */
export const listDetectionsTool = {
  name: 'list_detections',
  description: 'List and filter Microsoft Sentinel detection rules (analytics) - search by solution, severity, tactic, technique, name, query content, or file path. Returns max 100 results by default.',
  inputSchema: z.object({
    solution: z.string().optional().describe('Filter by solution name'),
    severity: z.string().optional().describe('Filter by severity (Informational, Low, Medium, High, Critical)'),
    tactic: z.string().optional().describe('Filter by MITRE ATT&CK tactic'),
    technique: z.string().optional().describe('Filter by MITRE ATT&CK technique'),
    status: z.string().optional().describe('Filter by status'),
    name: z.string().optional().describe('Search in detection name/title'),
    query_contains: z.string().optional().describe('Search for specific text in the KQL query (e.g., table names like "Syslog", "SecurityEvent")'),
    path_contains: z.string().optional().describe('Search in file path (e.g., "Syslog", "Linux")'),
    limit: z.coerce.number().optional().default(1000).describe('Maximum number of results to return (default: 1000, max: 5000)'),
    force_refresh: z.boolean().optional().describe('Force refresh from GitHub'),
    repository_owner: z.string().optional().describe('GitHub repository owner (default: Azure)'),
    repository_name: z.string().optional().describe('GitHub repository name (default: Azure-Sentinel)'),
    repository_branch: z.string().optional().describe('Repository branch (default: master)'),
  }),
  execute: async (args: DetectionFilters & { limit?: number; force_refresh?: boolean; repository_owner?: string; repository_name?: string; repository_branch?: string }): Promise<Detection[]> => {
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
        const analyzer = new ContentScanner(github);
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
      const analyzer = new ContentScanner(github);
      detections = await analyzer.listDetections();
    }

    // Apply filters using centralized utility
    detections = filterDetections(detections, args);

    // Apply limit using centralized utility
    return applyLimit(detections, args.limit, 'detections');
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
        const analyzer = new ContentScanner(github);
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
      const analyzer = new ContentScanner(github);
      detections = await analyzer.listDetections();
    }

    return detections.find(d => d.id === args.detection_id) || null;
  },
};

export const detectionTools = [
  listDetectionsTool,
  getDetectionDetailsTool,
];
