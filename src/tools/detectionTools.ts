/**
 * Detection Analysis Tools (Tools 7-8)
 */

import { z } from 'zod';
import { ContentScanner } from '../loaders/contentScanner.js';
import { Detection, DetectionFilters } from '../types/content.js';
import { loadPreBuiltIndex } from '../utils/indexLoader.js';

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
    limit: z.number().optional().default(100).describe('Maximum number of results to return (default: 100, max: 500)'),
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
    if (args.status) {
      detections = detections.filter(d => d.status?.toLowerCase().includes(args.status!.toLowerCase()));
    }
    if (args.name) {
      detections = detections.filter(d => d.name?.toLowerCase().includes(args.name!.toLowerCase()));
    }
    if (args.query_contains) {
      const searchTerm = args.query_contains.toLowerCase();
      detections = detections.filter(d => d.query?.toLowerCase().includes(searchTerm));
    }
    if (args.path_contains) {
      detections = detections.filter(d => d.filePath?.toLowerCase().includes(args.path_contains!.toLowerCase()));
    }

    // Apply limit (default 100, max 500)
    const totalResults = detections.length;
    const limit = Math.min(args.limit || 100, 500);

    if (totalResults > limit) {
      console.error(`⚠️  Returning ${limit} of ${totalResults} detections. Use 'limit' parameter to adjust (max: 500).`);
    }

    return detections.slice(0, limit);
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
