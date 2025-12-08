/**
 * Main solution loader orchestrating all analysis components
 * Uses GitHub API to load and analyze Azure Sentinel Solutions
 */

import {
  SolutionMetadata,
  ConnectorDefinition,
  TableMapping,
  AnalysisIssue,
  AnalysisResult,
} from '../types/index.js';
import { parseJsonTolerant } from './jsonParser.js';
import { extractTablesFromConnector } from './tableExtractor.js';
import { ParserResolver } from './parserResolver.js';
import { GitHubClient, GitHubTreeItem } from '../repository/githubClient.js';

export class SolutionLoader {
  private github: GitHubClient;
  private mappings: TableMapping[] = [];
  private issues: AnalysisIssue[] = [];
  private tableOccurrences: Map<string, number> = new Map();

  constructor(github: GitHubClient) {
    this.github = github;
  }

  /**
   * Analyze all solutions using GitHub API
   */
  async analyze(): Promise<AnalysisResult> {
    this.mappings = [];
    this.issues = [];
    this.tableOccurrences = new Map();

    console.error('Fetching repository tree from GitHub...');

    // Get the full tree
    const tree = await this.github.getTree();

    // Filter for Solutions directory
    const solutionItems = tree.tree.filter(
      (item) => item.path.startsWith('Solutions/') && item.type === 'tree'
    );

    // Extract unique solution names
    const solutionNames = new Set<string>();
    solutionItems.forEach((item) => {
      const parts = item.path.split('/');
      if (parts.length >= 2) {
        solutionNames.add(parts[1]);
      }
    });

    console.error(`Found ${solutionNames.size} solutions to analyze`);

    // Analyze each solution
    for (const solutionName of solutionNames) {
      await this.analyzeSolution(solutionName, tree);
    }

    // Calculate table uniqueness
    this.calculateTableUniqueness();

    console.error('Analysis complete!');

    const uniqueTables = new Set(this.mappings.map((m) => m.tableName));
    const uniqueConnectors = new Set(this.mappings.map((m) => m.connectorId));

    return {
      mappings: this.mappings,
      issues: this.issues,
      metadata: {
        totalSolutions: solutionNames.size,
        totalConnectors: uniqueConnectors.size,
        totalTables: uniqueTables.size,
        analysisDate: new Date().toISOString(),
      },
    };
  }

  /**
   * Analyze a single solution
   */
  private async analyzeSolution(solutionName: string, tree: any): Promise<void> {
    const solutionPath = `Solutions/${solutionName}`;

    // Load solution metadata
    const metadata = await this.loadSolutionMetadata(solutionPath, solutionName);

    // Find connector JSON files for this solution
    const connectorFiles = tree.tree.filter(
      (item: GitHubTreeItem) =>
        item.path.startsWith(`${solutionPath}/Data Connectors`) &&
        item.path.endsWith('.json') &&
        item.type === 'blob'
    );

    if (connectorFiles.length === 0) {
      return;
    }

    // Create parser resolver for this solution
    const parserResolver = new ParserResolver(solutionPath, tree.tree, this.github);
    await parserResolver.loadParsers();

    // Analyze each connector
    for (const connectorFile of connectorFiles) {
      await this.analyzeConnector(
        solutionName,
        metadata,
        connectorFile.path,
        parserResolver
      );
    }
  }

  /**
   * Load solution metadata from GitHub
   */
  private async loadSolutionMetadata(
    solutionPath: string,
    solutionName: string
  ): Promise<SolutionMetadata> {
    const metadataPath = `${solutionPath}/SolutionMetadata.json`;

    try {
      const content = await this.github.getFileContent(metadataPath);
      const result = parseJsonTolerant<any>(content);

      if (result.error || !result.data) {
        throw new Error(result.error || 'Failed to parse metadata');
      }

      const data = result.data;

      return {
        name: data.name || solutionName,
        publisher: data.publisherId || data.publisher || 'Unknown',
        version: data.version || 'Unknown',
        supportTier: data.support || data.supportTier,
        description: data.description,
      };
    } catch (error) {
      this.issues.push({
        solution: solutionName,
        issueType: 'missing_metadata',
        message: `SolutionMetadata.json not found or invalid: ${error}`,
        filePath: metadataPath,
      });

      return {
        name: solutionName,
        publisher: 'Unknown',
        version: 'Unknown',
      };
    }
  }

  /**
   * Analyze a single connector file
   */
  private async analyzeConnector(
    solutionName: string,
    metadata: SolutionMetadata,
    connectorFilePath: string,
    parserResolver: ParserResolver
  ): Promise<void> {
    try {
      const content = await this.github.getFileContent(connectorFilePath);
      const result = parseJsonTolerant<ConnectorDefinition>(content);

      if (result.error || !result.data) {
        this.issues.push({
          solution: solutionName,
          issueType: 'json_parse_error',
          message: result.error || 'Failed to parse connector JSON',
          filePath: connectorFilePath,
        });
        return;
      }

      const connector = result.data;
      const connectorId = connector.id || 'unknown';

      // Extract tables from connector definition
      const extraction = extractTablesFromConnector(connector);

      // Resolve parser references to actual tables
      const resolvedParserTables =
        await parserResolver.resolveMultipleParsers(extraction.parserReferences);

      // Combine direct tables and resolved parser tables
      const allTables = new Set([
        ...extraction.tables.keys(),
        ...resolvedParserTables,
      ]);

      if (allTables.size === 0 && extraction.parserReferences.size === 0) {
        this.issues.push({
          solution: solutionName,
          connectorId,
          issueType: 'no_table_definitions',
          message: 'No table definitions found in connector',
          filePath: connectorFilePath,
        });
        return;
      }

      if (allTables.size === 0 && extraction.parserReferences.size > 0) {
        this.issues.push({
          solution: solutionName,
          connectorId,
          issueType: 'parser_tables_only',
          message: `Parser references found but not resolved: ${Array.from(
            extraction.parserReferences
          ).join(', ')}`,
          filePath: connectorFilePath,
        });
      }

      // Create mappings for each table
      allTables.forEach((tableName) => {
        const detectionMethod = extraction.tables.get(tableName) || 'parser_resolution';

        this.mappings.push({
          solution: metadata.name,
          publisher: metadata.publisher,
          version: metadata.version,
          supportTier: metadata.supportTier,
          connectorId,
          connectorTitle: connector.title || connectorId,
          connectorDescription: connector.description,
          tableName,
          isUnique: false, // Will be calculated later
          detectionMethod,
          solutionUrl: this.github.getGitHubUrl(`Solutions/${solutionName}`),
          connectorFileUrl: this.github.getGitHubBlobUrl(connectorFilePath),
        });

        // Track table occurrences
        const count = this.tableOccurrences.get(tableName) || 0;
        this.tableOccurrences.set(tableName, count + 1);
      });
    } catch (error) {
      this.issues.push({
        solution: solutionName,
        issueType: 'json_parse_error',
        message: `Error analyzing connector: ${error}`,
        filePath: connectorFilePath,
      });
    }
  }

  /**
   * Calculate table uniqueness based on occurrences
   */
  private calculateTableUniqueness(): void {
    this.mappings.forEach((mapping) => {
      const occurrences = this.tableOccurrences.get(mapping.tableName) || 0;
      mapping.isUnique = occurrences === 1;
    });
  }

  /**
   * Get current analysis results
   */
  getResults(): AnalysisResult {
    const uniqueTables = new Set(this.mappings.map((m) => m.tableName));
    const uniqueConnectors = new Set(this.mappings.map((m) => m.connectorId));
    const uniqueSolutions = new Set(this.mappings.map((m) => m.solution));

    return {
      mappings: this.mappings,
      issues: this.issues,
      metadata: {
        totalSolutions: uniqueSolutions.size,
        totalConnectors: uniqueConnectors.size,
        totalTables: uniqueTables.size,
        analysisDate: new Date().toISOString(),
      },
    };
  }
}
