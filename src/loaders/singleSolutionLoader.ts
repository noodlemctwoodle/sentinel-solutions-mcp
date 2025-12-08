/**
 * Single Solution Loader - Optimized for querying one solution
 * Only fetches files for the requested solution, not all 480+
 */

import {
  SolutionMetadata,
  TableMapping,
  AnalysisIssue,
  SolutionDetails,
} from '../types/index.js';
import { parseJsonTolerant } from './jsonParser.js';
import { extractTablesFromConnector } from './tableExtractor.js';
import { ParserResolver } from './parserResolver.js';
import { GitHubClient } from '../repository/githubClient.js';

export class SingleSolutionLoader {
  private github: GitHubClient;

  constructor(github: GitHubClient) {
    this.github = github;
  }

  /**
   * Analyze a single solution by name - FAST!
   * Only fetches files for this solution
   */
  async analyzeSolution(solutionName: string): Promise<SolutionDetails | null> {
    console.error(`Analyzing solution: ${solutionName}`);

    const solutionPath = `Solutions/${solutionName}`;

    // 1. Load metadata
    const metadata = await this.loadSolutionMetadata(solutionPath, solutionName);
    if (!metadata) {
      return null;
    }

    // 2. Get tree to find connector and parser files
    console.error('Fetching solution files from GitHub...');
    const tree = await this.github.getTree();

    // 3. Find connector files for this solution only
    const connectorFiles = tree.tree.filter(
      (item) =>
        item.path.startsWith(`${solutionPath}/Data Connectors`) &&
        (item.path.endsWith('.json') || item.path.endsWith('.JSON')) &&
        item.type === 'blob'
    );

    console.error(`Found ${connectorFiles.length} connectors`);

    if (connectorFiles.length === 0) {
      return {
        metadata,
        connectors: [],
        uniqueTables: [],
        githubUrl: this.github.getGitHubUrl(solutionPath),
      };
    }

    // 4. Load parsers for this solution
    const parserResolver = new ParserResolver(solutionPath, tree.tree, this.github);
    await parserResolver.loadParsers();

    // 5. Analyze connectors
    const connectors: Array<{
      id: string;
      title: string;
      description?: string;
      tables: string[];
    }> = [];

    const allTables = new Set<string>();

    for (const connectorFile of connectorFiles) {
      const connectorData = await this.analyzeConnector(
        connectorFile.path,
        parserResolver
      );

      if (connectorData) {
        connectors.push(connectorData);
        connectorData.tables.forEach((table) => allTables.add(table));
      }
    }

    console.error(`Analysis complete! Found ${allTables.size} unique tables`);

    return {
      metadata,
      connectors,
      uniqueTables: Array.from(allTables),
      githubUrl: this.github.getGitHubUrl(solutionPath),
    };
  }

  /**
   * Load solution metadata
   */
  private async loadSolutionMetadata(
    solutionPath: string,
    solutionName: string
  ): Promise<SolutionMetadata | null> {
    const metadataPath = `${solutionPath}/SolutionMetadata.json`;

    try {
      const content = await this.github.getFileContent(metadataPath);
      const result = parseJsonTolerant<any>(content);

      if (result.error || !result.data) {
        return null;
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
      console.error(`Could not load metadata for ${solutionName}`);
      return null;
    }
  }

  /**
   * Analyze a single connector file
   */
  private async analyzeConnector(
    connectorFilePath: string,
    parserResolver: ParserResolver
  ): Promise<{
    id: string;
    title: string;
    description?: string;
    tables: string[];
  } | null> {
    try {
      const content = await this.github.getFileContent(connectorFilePath);
      const result = parseJsonTolerant(content);

      if (result.error || !result.data) {
        return null;
      }

      const connector = result.data;
      const connectorId = connector.id || 'unknown';

      // Extract tables
      const extraction = extractTablesFromConnector(connector);

      // Resolve parser references
      const resolvedParserTables =
        await parserResolver.resolveMultipleParsers(extraction.parserReferences);

      // Combine all tables
      const allTables = Array.from(
        new Set([...extraction.tables.keys(), ...resolvedParserTables])
      );

      return {
        id: connectorId,
        title: connector.title || connectorId,
        description: connector.description,
        tables: allTables,
      };
    } catch (error) {
      return null;
    }
  }
}
