/**
 * Parser resolver for YAML parser files
 * Resolves parser function references to actual Log Analytics tables
 * with cycle prevention and depth limiting
 * Now uses GitHub API instead of local file system
 */

import * as yaml from 'js-yaml';
import { extractTablesFromQuery } from './kqlParser.js';
import { GitHubClient, GitHubTreeItem } from '../repository/githubClient.js';

const MAX_RESOLUTION_DEPTH = 5; // Prevent infinite loops

export interface ParserInfo {
  name: string;
  tables: Set<string>;
  parserReferences: Set<string>;
}

export class ParserResolver {
  private parserCache: Map<string, ParserInfo> = new Map();
  private solutionPath: string;
  private treeItems: GitHubTreeItem[];
  private github: GitHubClient;

  constructor(solutionPath: string, treeItems: GitHubTreeItem[], github: GitHubClient) {
    this.solutionPath = solutionPath;
    this.treeItems = treeItems;
    this.github = github;
  }

  /**
   * Load all parsers from the solution's Parsers directory
   */
  async loadParsers(): Promise<Map<string, ParserInfo>> {
    // Find all parser files in this solution
    const parserFiles = this.treeItems.filter(
      (item) =>
        item.path.startsWith(`${this.solutionPath}/Parsers`) &&
        (item.path.endsWith('.yaml') ||
          item.path.endsWith('.yml') ||
          item.path.endsWith('.json')) &&
        item.type === 'blob'
    );

    for (const file of parserFiles) {
      await this.parseParserFile(file.path);
    }

    return this.parserCache;
  }

  /**
   * Parse a single parser file and extract table references
   */
  private async parseParserFile(filePath: string): Promise<void> {
    try {
      const content = await this.github.getFileContent(filePath);
      let parserDef: any;

      // Try parsing as YAML first
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        parserDef = yaml.load(content);
      } else if (filePath.endsWith('.json')) {
        parserDef = JSON.parse(content);
      } else {
        return;
      }

      // Extract function name and query
      const functionName = this.extractFunctionName(parserDef);
      const functionQuery = this.extractFunctionQuery(parserDef);

      if (!functionName || !functionQuery) {
        return;
      }

      // Extract tables and parser references from the query
      const tables = extractTablesFromQuery(functionQuery);
      const parserReferences = new Set<string>();

      // Separate actual tables from parser references
      const actualTables = new Set<string>();
      tables.forEach((table) => {
        if (this.isLikelyParser(table)) {
          parserReferences.add(table);
        } else {
          actualTables.add(table);
        }
      });

      this.parserCache.set(functionName, {
        name: functionName,
        tables: actualTables,
        parserReferences,
      });
    } catch (error) {
      // Silently ignore parse errors
    }
  }

  /**
   * Extract function name from parser definition
   */
  private extractFunctionName(parserDef: any): string | null {
    // Try different common patterns
    if (parserDef?.FunctionName) {
      return parserDef.FunctionName;
    }

    if (parserDef?.function?.name) {
      return parserDef.function.name;
    }

    if (parserDef?.metadata?.name) {
      return parserDef.metadata.name;
    }

    if (parserDef?.name) {
      return parserDef.name;
    }

    // For ARM templates
    if (parserDef?.resources) {
      for (const resource of parserDef.resources) {
        if (resource?.properties?.savedQueryName) {
          return resource.properties.savedQueryName;
        }
      }
    }

    return null;
  }

  /**
   * Extract function query from parser definition
   */
  private extractFunctionQuery(parserDef: any): string | null {
    // Try different common patterns
    if (parserDef?.FunctionQuery) {
      return parserDef.FunctionQuery;
    }

    if (parserDef?.function?.query) {
      return parserDef.function.query;
    }

    if (parserDef?.body) {
      return parserDef.body;
    }

    if (parserDef?.query) {
      return parserDef.query;
    }

    // For ARM templates
    if (parserDef?.resources) {
      for (const resource of parserDef.resources) {
        if (resource?.properties?.functionAlias) {
          return resource.properties.functionAlias;
        }
        if (resource?.properties?.query) {
          return resource.properties.query;
        }
      }
    }

    return null;
  }

  /**
   * Resolve a parser name to its underlying tables
   * with recursive resolution and cycle prevention
   */
  async resolveParser(
    parserName: string,
    visited: Set<string> = new Set(),
    depth: number = 0
  ): Promise<Set<string>> {
    const resolvedTables = new Set<string>();

    // Prevent cycles and excessive depth
    if (visited.has(parserName) || depth > MAX_RESOLUTION_DEPTH) {
      return resolvedTables;
    }

    visited.add(parserName);

    const parserInfo = this.parserCache.get(parserName);
    if (!parserInfo) {
      return resolvedTables;
    }

    // Add direct table references
    parserInfo.tables.forEach((table) => resolvedTables.add(table));

    // Recursively resolve nested parser references
    for (const nestedParser of parserInfo.parserReferences) {
      const nestedTables = await this.resolveParser(nestedParser, visited, depth + 1);
      nestedTables.forEach((table) => resolvedTables.add(table));
    }

    return resolvedTables;
  }

  /**
   * Resolve multiple parser references
   */
  async resolveMultipleParsers(parserNames: Set<string>): Promise<Set<string>> {
    const allTables = new Set<string>();

    for (const parserName of parserNames) {
      const tables = await this.resolveParser(parserName);
      tables.forEach((table) => allTables.add(table));
    }

    return allTables;
  }

  /**
   * Check if a name is likely a parser function
   */
  private isLikelyParser(name: string): boolean {
    // Same logic as in tableExtractor
    if (name.endsWith('_CL')) {
      return false;
    }

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

    if (name.includes('_') && !name.endsWith('_CL')) {
      return false;
    }

    return true;
  }

  /**
   * Get all cached parsers
   */
  getAllParsers(): Map<string, ParserInfo> {
    return this.parserCache;
  }
}
