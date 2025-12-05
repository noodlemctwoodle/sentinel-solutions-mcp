/**
 * Content Analyzer for Sentinel detections, workbooks, hunting queries, etc.
 */

import { GitHubClient } from '../repository/githubClient.js';
import * as yaml from 'js-yaml';
import { Detection, Workbook, HuntingQuery, Playbook, Parser } from '../types/content.js';

export class ContentAnalyzer {
  constructor(private github: GitHubClient) {}

  /**
   * List all detections (analytics rules)
   */
  async listDetections(): Promise<Detection[]> {
    console.error('Fetching detection rules from GitHub...');
    const tree = await this.github.getTree();

    // Find all YAML files in Detections and Solutions directories
    const detectionFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/Detections\/.*\.yaml$/i) ||
          item.path.match(/Solutions\/.*\/Analytic Rules\/.*\.yaml$/i))
    );

    console.error(`Found ${detectionFiles.length} detection files`);

    const detections: Detection[] = [];
    let processed = 0;

    for (const file of detectionFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = yaml.load(content) as any;

        if (data && data.id) {
          detections.push({
            id: data.id,
            name: data.name || 'Unknown',
            description: data.description,
            severity: data.severity,
            status: data.status,
            tactics: data.tactics || [],
            techniques: data.relevantTechniques || [],
            query: data.query,
            queryFrequency: data.queryFrequency,
            queryPeriod: data.queryPeriod,
            triggerOperator: data.triggerOperator,
            triggerThreshold: data.triggerThreshold,
            suppressionDuration: data.suppressionDuration,
            entityMappings: data.entityMappings,
            customDetails: data.customDetails,
            requiredDataConnectors: data.requiredDataConnectors,
            filePath: file.path,
            solution: this.extractSolutionName(file.path),
          });
        }

        processed++;
        if (processed % 50 === 0) {
          console.error(`Processed ${processed}/${detectionFiles.length} detections...`);
        }
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${detections.length} detections`);
    return detections;
  }

  /**
   * List all workbooks
   */
  async listWorkbooks(): Promise<Workbook[]> {
    console.error('Fetching workbooks from GitHub...');
    const tree = await this.github.getTree();

    // Find all JSON workbook files
    const workbookFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/Workbooks\/.*\.json$/i) ||
          item.path.match(/Solutions\/.*\/Workbooks\/.*\.json$/i))
    );

    console.error(`Found ${workbookFiles.length} workbook files`);

    const workbooks: Workbook[] = [];
    let processed = 0;

    for (const file of workbookFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = JSON.parse(content);

        // Azure workbook structure
        if (data.name || data.properties?.displayName) {
          workbooks.push({
            id: data.name || file.path,
            name: data.properties?.displayName || data.name || 'Unknown',
            description: data.properties?.description,
            category: data.properties?.category,
            dataTypes: this.extractDataTypes(content),
            filePath: file.path,
            solution: this.extractSolutionName(file.path),
          });
        }

        processed++;
        if (processed % 20 === 0) {
          console.error(`Processed ${processed}/${workbookFiles.length} workbooks...`);
        }
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${workbooks.length} workbooks`);
    return workbooks;
  }

  /**
   * List all hunting queries
   */
  async listHuntingQueries(): Promise<HuntingQuery[]> {
    console.error('Fetching hunting queries from GitHub...');
    const tree = await this.github.getTree();

    // Find all YAML hunting query files
    const huntingFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/Hunting Queries\/.*\.yaml$/i) ||
          item.path.match(/Solutions\/.*\/Hunting Queries\/.*\.yaml$/i))
    );

    console.error(`Found ${huntingFiles.length} hunting query files`);

    const queries: HuntingQuery[] = [];
    let processed = 0;

    for (const file of huntingFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = yaml.load(content) as any;

        if (data && data.id) {
          queries.push({
            id: data.id,
            name: data.name || 'Unknown',
            description: data.description,
            tactics: data.tactics || [],
            techniques: data.relevantTechniques || [],
            query: data.query,
            requiredDataConnectors: data.requiredDataConnectors,
            filePath: file.path,
            solution: this.extractSolutionName(file.path),
          });
        }

        processed++;
        if (processed % 50 === 0) {
          console.error(`Processed ${processed}/${huntingFiles.length} hunting queries...`);
        }
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${queries.length} hunting queries`);
    return queries;
  }

  /**
   * List all playbooks
   */
  async listPlaybooks(): Promise<Playbook[]> {
    console.error('Fetching playbooks from GitHub...');
    const tree = await this.github.getTree();

    // Find all JSON playbook files (Logic Apps)
    const playbookFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/Playbooks\/.*\.json$/i) ||
          item.path.match(/Solutions\/.*\/Playbooks\/.*\.json$/i)) &&
        !item.path.includes('azuredeploy.json')
    );

    console.error(`Found ${playbookFiles.length} playbook files`);

    const playbooks: Playbook[] = [];

    for (const file of playbookFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = JSON.parse(content);

        playbooks.push({
          id: file.path,
          name: data.parameters?.PlaybookName?.defaultValue || file.path.split('/').pop() || 'Unknown',
          description: data.metadata?.description,
          filePath: file.path,
          solution: this.extractSolutionName(file.path),
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${playbooks.length} playbooks`);
    return playbooks;
  }

  /**
   * List all parsers
   */
  async listParsers(): Promise<Parser[]> {
    console.error('Fetching parsers from GitHub...');
    const tree = await this.github.getTree();

    // Find all parser files
    const parserFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/Parsers\/.*\.txt$/i) ||
          item.path.match(/Parsers\/.*\.yaml$/i) ||
          item.path.match(/Solutions\/.*\/Parsers\/.*\.(txt|yaml)$/i))
    );

    console.error(`Found ${parserFiles.length} parser files`);

    const parsers: Parser[] = [];

    for (const file of parserFiles) {
      try {
        const content = await this.github.getFileContent(file.path);

        parsers.push({
          id: file.path,
          name: file.path.split('/').pop() || 'Unknown',
          query: file.path.endsWith('.txt') ? content : undefined,
          filePath: file.path,
          solution: this.extractSolutionName(file.path),
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${parsers.length} parsers`);
    return parsers;
  }

  /**
   * Extract solution name from file path
   */
  private extractSolutionName(path: string): string | undefined {
    const match = path.match(/Solutions\/([^/]+)\//);
    return match ? match[1] : undefined;
  }

  /**
   * Extract data types from content (simple regex search)
   */
  private extractDataTypes(content: string): string[] {
    const dataTypes = new Set<string>();
    const commonTables = [
      'SecurityEvent',
      'Syslog',
      'CommonSecurityLog',
      'AzureActivity',
      'SigninLogs',
      'AuditLogs',
      'OfficeActivity',
      'AWSCloudTrail',
      'DeviceEvents',
      'DeviceProcessEvents',
      'DeviceNetworkEvents',
    ];

    for (const table of commonTables) {
      if (content.includes(table)) {
        dataTypes.add(table);
      }
    }

    return Array.from(dataTypes);
  }
}
