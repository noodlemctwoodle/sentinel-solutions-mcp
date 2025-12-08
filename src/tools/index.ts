/**
 * MCP Tools implementation for Microsoft Sentinel Solutions Analyzer
 *
 * This file consolidates and exports all 23 MCP tools organized by category:
 * - Tools 1-6: Solution and Connector Analysis (solutionTools.ts)
 * - Tools 7-8: Detection Analysis (detectionTools.ts)
 * - Tools 9-10: Workbook Analysis (workbookTools.ts)
 * - Tools 11-23: Content Analysis (contentTools.ts)
 */

// Import solution analysis tools (Tools 1-6)
import {
  analyzeSolutionsTool,
  getConnectorTablesTool,
  searchSolutionsTool,
  getSolutionDetailsTool,
  listTablesTool,
  validateConnectorTool,
  solutionTools,
} from './solutionTools.js';

// Import detection analysis tools (Tools 7-8)
import {
  listDetectionsTool,
  getDetectionDetailsTool,
  detectionTools,
} from './detectionTools.js';

// Import workbook analysis tools (Tools 9-10)
import {
  listWorkbooksTool,
  getWorkbookDetailsTool,
  workbookTools,
} from './workbookTools.js';

// Import content analysis tools (Tools 11-23)
import {
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
  contentTools,
} from './contentTools.js';

// Re-export individual tools for direct access
export {
  // Solution tools (1-6)
  analyzeSolutionsTool,
  getConnectorTablesTool,
  searchSolutionsTool,
  getSolutionDetailsTool,
  listTablesTool,
  validateConnectorTool,

  // Detection tools (7-8)
  listDetectionsTool,
  getDetectionDetailsTool,

  // Workbook tools (9-10)
  listWorkbooksTool,
  getWorkbookDetailsTool,

  // Content tools (11-23)
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
};

// Re-export tool groups
export {
  solutionTools,
  detectionTools,
  workbookTools,
  contentTools,
};

/**
 * Complete list of all 23 MCP tools
 */
export const allTools = [
  // Solution analysis tools (1-6)
  ...solutionTools,

  // Detection analysis tools (7-8)
  ...detectionTools,

  // Workbook analysis tools (9-10)
  ...workbookTools,

  // Content analysis tools (11-23)
  ...contentTools,
];
