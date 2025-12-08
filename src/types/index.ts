/**
 * Type definitions for Microsoft Sentinel Solutions Analyzer
 */

import { Detection, Workbook, HuntingQuery, Playbook, Parser, Watchlist, Notebook, ExplorationQuery, Function, ASIMContent, SummaryRule, Tool, Tutorial, Dashboard, DataConnector } from './content.js';

export interface SolutionMetadata {
  name: string;
  publisher: string;
  version: string;
  supportTier?: string;
  description?: string;
}

export interface ConnectorDefinition {
  id: string;
  title: string;
  description?: string;
  publisher?: string;
  graphQueries?: Array<{ baseQuery?: string }>;
  sampleQueries?: Array<{ query?: string }>;
  dataTypes?: Array<{
    name?: string;
    lastDataReceivedQuery?: string;
  }>;
  connectivityCriterias?: Array<{
    type?: string;
    value?: string | string[];
  }>;
  availability?: {
    status?: number;
    isPreview?: boolean;
  };
}

export interface TableMapping {
  solution: string;
  publisher: string;
  version: string;
  supportTier?: string;
  connectorId: string;
  connectorTitle: string;
  connectorDescription?: string;
  tableName: string;
  isUnique: boolean;
  detectionMethod?: string;
  solutionUrl?: string;
  connectorFileUrl?: string;
}

export interface AnalysisIssue {
  solution: string;
  connectorId?: string;
  issueType: IssueType;
  message: string;
  filePath?: string;
}

export type IssueType =
  | 'json_parse_error'
  | 'no_table_definitions'
  | 'parser_tables_only'
  | 'loganalytics_mismatch'
  | 'missing_connector_json'
  | 'missing_metadata';

export interface ParserMetadata {
  name: string;
  tables: Set<string>;
}

export interface AnalysisResult {
  mappings: TableMapping[];
  issues: AnalysisIssue[];
  detections?: Detection[];
  workbooks?: Workbook[];
  huntingQueries?: HuntingQuery[];
  playbooks?: Playbook[];
  parsers?: Parser[];
  watchlists?: Watchlist[];
  notebooks?: Notebook[];
  explorationQueries?: ExplorationQuery[];
  functions?: Function[];
  asimContent?: ASIMContent[];
  summaryRules?: SummaryRule[];
  tools?: Tool[];
  tutorials?: Tutorial[];
  dashboards?: Dashboard[];
  dataConnectors?: DataConnector[];
  metadata: {
    totalSolutions: number;
    totalConnectors: number;
    totalTables: number;
    totalDetections?: number;
    totalWorkbooks?: number;
    totalHuntingQueries?: number;
    totalPlaybooks?: number;
    totalParsers?: number;
    totalWatchlists?: number;
    totalNotebooks?: number;
    totalExplorationQueries?: number;
    totalFunctions?: number;
    totalASIMContent?: number;
    totalSummaryRules?: number;
    totalTools?: number;
    totalTutorials?: number;
    totalDashboards?: number;
    totalDataConnectors?: number;
    analysisDate: string;
    repositoryCommit?: string;
    preBuiltAt?: string;
    version?: string;
  };
}

export interface ConnectorTables {
  connectorId: string;
  connectorTitle: string;
  tables: Array<{
    tableName: string;
    detectionMethod: string;
  }>;
}

export interface SolutionDetails {
  metadata: SolutionMetadata;
  connectors: Array<{
    id: string;
    title: string;
    description?: string;
    tables: string[];
  }>;
  uniqueTables: string[];
  githubUrl?: string;
}

export interface TableInfo {
  tableName: string;
  isCustomLog: boolean;
  connectors: Array<{
    connectorId: string;
    connectorTitle: string;
    solution: string;
  }>;
}

export interface SearchResult {
  solutions: Array<{
    name: string;
    publisher: string;
    version: string;
    supportTier?: string;
    connectorCount: number;
    tableCount: number;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedTables: string[];
}
