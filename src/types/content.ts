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
