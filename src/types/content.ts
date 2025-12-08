/**
 * Type definitions for Sentinel content (detections, workbooks, etc.)
 */

export interface Detection {
  id: string;
  name: string;
  description?: string;
  severity?: 'Informational' | 'Low' | 'Medium' | 'High' | 'Critical';
  status?: string;
  tactics?: string[];
  techniques?: string[];
  query?: string;
  queryFrequency?: string;
  queryPeriod?: string;
  triggerOperator?: string;
  triggerThreshold?: number;
  suppressionDuration?: string;
  entityMappings?: any[];
  customDetails?: any;
  requiredDataConnectors?: Array<{
    connectorId: string;
    dataTypes: string[];
  }>;
  filePath?: string;
  solution?: string;
}

export interface Workbook {
  id: string;
  name: string;
  description?: string;
  category?: string;
  dataTypes?: string[];
  requiredDataConnectors?: Array<{
    connectorId: string;
    dataTypes: string[];
  }>;
  filePath?: string;
  solution?: string;
}

export interface HuntingQuery {
  id: string;
  name: string;
  description?: string;
  tactics?: string[];
  techniques?: string[];
  query?: string;
  requiredDataConnectors?: Array<{
    connectorId: string;
    dataTypes: string[];
  }>;
  filePath?: string;
  solution?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description?: string;
  filePath?: string;
  solution?: string;
}

export interface Parser {
  id: string;
  name: string;
  description?: string;
  query?: string;
  filePath?: string;
  solution?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  description?: string;
  alias?: string;
  filePath?: string;
  solution?: string;
}

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  filePath?: string;
  solution?: string;
}

export interface ExplorationQuery {
  id: string;
  name: string;
  description?: string;
  query?: string;
  filePath?: string;
  solution?: string;
}

export interface Function {
  id: string;
  name: string;
  description?: string;
  query?: string;
  filePath?: string;
  solution?: string;
}

export interface ASIMContent {
  id: string;
  name: string;
  type?: 'Parser' | 'Schema' | 'Documentation';
  description?: string;
  filePath?: string;
}

export interface SummaryRule {
  id: string;
  name: string;
  description?: string;
  query?: string;
  filePath?: string;
  solution?: string;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  filePath?: string;
}

export interface Tutorial {
  id: string;
  name: string;
  description?: string;
  filePath?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  filePath?: string;
  solution?: string;
}

export interface DataConnector {
  id: string;
  name: string;
  description?: string;
  connectorType?: string;
  filePath?: string;
}

export interface DetectionFilters {
  solution?: string;
  severity?: string;
  tactic?: string;
  technique?: string;
  status?: string;
}

export interface WorkbookFilters {
  solution?: string;
  category?: string;
}

export interface HuntingQueryFilters {
  solution?: string;
  tactic?: string;
  technique?: string;
}
