/**
 * Table extractor implementing 6 detection methods from Python version
 * Extracts table references from Azure Sentinel connector definitions
 */

import { ConnectorDefinition } from '../types/index.js';
import { extractTablesFromQuery } from './kqlParser.js';

export interface TableDetection {
  tableName: string;
  detectionMethod: string;
}

export interface ExtractionResult {
  tables: Map<string, string>; // tableName -> detection method
  parserReferences: Set<string>;
  variables: Record<string, string>;
}

/**
 * Extract tables from connector definition using all 6 detection methods
 */
export function extractTablesFromConnector(
  connector: ConnectorDefinition
): ExtractionResult {
  const tables = new Map<string, string>();
  const parserReferences = new Set<string>();
  const variables: Record<string, string> = {};

  // Extract ARM template variables first
  extractVariables(connector, variables);

  // Method 1: graphQueries.{index}.baseQuery
  if (connector.graphQueries) {
    connector.graphQueries.forEach((query, index) => {
      if (query.baseQuery) {
        const extracted = extractTablesFromQuery(query.baseQuery, variables);
        extracted.forEach((table) => {
          const method = `graphQueries.${index}.baseQuery`;
          recordTable(tables, table, method, parserReferences);
        });
      }
    });
  }

  // Method 2: sampleQueries.{index}.query
  if (connector.sampleQueries) {
    connector.sampleQueries.forEach((query, index) => {
      if (query.query) {
        const extracted = extractTablesFromQuery(query.query, variables);
        extracted.forEach((table) => {
          const method = `sampleQueries.${index}.query`;
          recordTable(tables, table, method, parserReferences);
        });
      }
    });
  }

  // Method 3: dataTypes.{index}.lastDataReceivedQuery
  if (connector.dataTypes) {
    connector.dataTypes.forEach((dataType, index) => {
      if (dataType.lastDataReceivedQuery) {
        const extracted = extractTablesFromQuery(
          dataType.lastDataReceivedQuery,
          variables
        );
        extracted.forEach((table) => {
          const method = `dataTypes.${index}.lastDataReceivedQuery`;
          recordTable(tables, table, method, parserReferences);
        });
      }
    });
  }

  // Method 4: connectivityCriterias.{index}.value
  if (connector.connectivityCriterias) {
    connector.connectivityCriterias.forEach((criteria, index) => {
      if (criteria.value) {
        const values = Array.isArray(criteria.value)
          ? criteria.value
          : [criteria.value];

        values.forEach((value) => {
          if (typeof value === 'string') {
            const extracted = extractTablesFromQuery(value, variables);
            extracted.forEach((table) => {
              const method = `connectivityCriterias.${index}.value`;
              recordTable(tables, table, method, parserReferences);
            });
          }
        });
      }
    });
  }

  // Method 5: ARM template logAnalyticsTableId variable
  if (variables.logAnalyticsTableId) {
    const method = 'variables.logAnalyticsTableId';
    recordTable(tables, variables.logAnalyticsTableId, method, parserReferences);
  }

  // Method 6: Parser function references
  // Note: Actual parser resolution happens in parserResolver.ts
  // Here we just identify potential parser references

  return { tables, parserReferences, variables };
}

/**
 * Record a table, checking if it's a parser reference
 */
function recordTable(
  tables: Map<string, string>,
  tableName: string,
  method: string,
  parserReferences: Set<string>
): void {
  // Check if this looks like a parser function (CamelCase, no underscores, doesn't end with _CL)
  if (isLikelyParser(tableName)) {
    parserReferences.add(tableName);
  } else {
    // Only update if not already recorded, to preserve first detection method
    if (!tables.has(tableName)) {
      tables.set(tableName, method);
    }
  }
}

/**
 * Check if a table name is likely a parser function reference
 */
function isLikelyParser(name: string): boolean {
  // Parser functions typically:
  // - Use PascalCase or camelCase
  // - Don't end with _CL (custom log suffix)
  // - Don't contain certain keywords

  if (name.endsWith('_CL')) {
    return false; // Custom logs are definitely tables
  }

  // Standard Log Analytics tables (definitely not parsers)
  const standardTables = new Set([
    'SecurityEvent',
    'Syslog',
    'CommonSecurityLog',
    'SigninLogs',
    'AuditLogs',
    'Event',
    'Heartbeat',
    'Perf',
    'Alert',
    'SecurityAlert',
    'SecurityIncident',
    'OfficeActivity',
    'AzureActivity',
    'AzureDiagnostics',
  ]);

  if (standardTables.has(name)) {
    return false;
  }

  // If it contains an underscore but doesn't end with _CL, it's likely a table
  if (name.includes('_') && !name.endsWith('_CL')) {
    return false;
  }

  // Tables with common suffixes are actual tables, not parsers
  const tableSuffixes = ['Logs', 'Events', 'Users', 'Traffic', 'Alerts', 'Data'];
  if (tableSuffixes.some(suffix => name.endsWith(suffix))) {
    return false;
  }

  // Tables with AAD, ADFS, Azure, AWS, Office365 prefixes are standard tables
  const tableNamePrefixes = ['AAD', 'ADFS', 'Azure', 'AWS', 'Office365', 'Network'];
  if (tableNamePrefixes.some(prefix => name.startsWith(prefix))) {
    return false;
  }

  // Otherwise, could be a parser
  return true;
}

/**
 * Extract ARM template variables from connector definition
 */
function extractVariables(
  connector: any,
  variables: Record<string, string>
): void {
  if (connector.variables && typeof connector.variables === 'object') {
    Object.entries(connector.variables).forEach(([key, value]) => {
      if (typeof value === 'string') {
        variables[key] = value;
      }
    });
  }

  // Also look for common variable patterns in the connector structure
  traverseForVariables(connector, variables);
}

/**
 * Recursively traverse connector definition looking for ARM variable definitions
 */
function traverseForVariables(obj: any, variables: Record<string, string>): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  // Check for ARM template variable syntax
  if (obj.variables && typeof obj.variables === 'object') {
    Object.entries(obj.variables).forEach(([key, value]) => {
      if (typeof value === 'string') {
        variables[key] = value;
      }
    });
  }

  // Recurse into nested objects and arrays
  Object.values(obj).forEach((value) => {
    if (typeof value === 'object' && value !== null) {
      traverseForVariables(value, variables);
    }
  });
}

/**
 * Resolve table priority when multiple tables are detected
 * Custom logs (_CL) and ASIM parsers take priority
 */
export function resolveTablePriority(tables: Map<string, string>): string | null {
  if (tables.size === 0) {
    return null;
  }

  // Priority 1: Custom log tables (_CL suffix)
  for (const [tableName] of tables) {
    if (tableName.endsWith('_CL')) {
      return tableName;
    }
  }

  // Priority 2: ASIM (Advanced Security Information Model) prefixed tables
  for (const [tableName] of tables) {
    if (tableName.startsWith('ASIM') || tableName.startsWith('Asim')) {
      return tableName;
    }
  }

  // Priority 3: First table found
  return tables.keys().next().value || null;
}
