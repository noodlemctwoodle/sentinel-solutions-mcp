/**
 * Content Scanner for Sentinel detections, workbooks, hunting queries, etc.
 */

import { GitHubClient } from '../repository/githubClient.js';
import * as yaml from 'js-yaml';
import { Detection, Workbook, HuntingQuery, Playbook, Parser, Watchlist, Notebook, ExplorationQuery, Function as SentinelFunction, ASIMContent, SummaryRule, Tool, Tutorial, Dashboard, DataConnector } from '../types/content.js';

export class ContentScanner {
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

        // Azure Workbook template structure
        // These workbooks use fromTemplateId for the name
        if (data.fromTemplateId || data.version) {
          const workbookName = data.fromTemplateId ||
                               file.path.split('/').pop()?.replace('.json', '') ||
                               'Unknown';

          workbooks.push({
            id: data.fromTemplateId || file.path,
            name: workbookName,
            description: undefined, // Workbook templates don't have descriptions
            category: undefined, // Would need to parse items to determine
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

    // Find all JSON playbook files (Logic Apps) from multiple locations:
    // 1. Root-level: Playbooks/PlaybookName/azuredeploy.json
    // 2. Solution-level: Solutions/SolutionName/Playbooks/PlaybookName/azuredeploy.json
    // 3. MasterPlaybooks: MasterPlaybooks/Category/Name/azuredeploy.json
    // 4. Trigger-specific: Playbooks/PlaybookName/alert-trigger/azuredeploy.json
    const playbookFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.endsWith('.json') &&
        (
          // Root-level playbooks: Playbooks/Name/azuredeploy.json
          item.path.match(/^Playbooks\/[^/]+\/azuredeploy\.json$/i) ||
          // Root-level with trigger subdirs: Playbooks/Name/alert-trigger/azuredeploy.json
          item.path.match(/^Playbooks\/[^/]+\/(alert-trigger|incident-trigger)\/azuredeploy\.json$/i) ||
          // MasterPlaybooks: MasterPlaybooks/Category/Name/azuredeploy.json
          item.path.match(/^MasterPlaybooks\/[^/]+\/[^/]+\/azuredeploy\.json$/i) ||
          // Solution playbooks: Solutions/Name/Playbooks/Name/azuredeploy.json
          item.path.match(/^Solutions\/[^/]+\/Playbooks\/[^/]+\/azuredeploy\.json$/i) ||
          // Solution playbooks with triggers: Solutions/Name/Playbooks/Name/alert-trigger/azuredeploy.json
          item.path.match(/^Solutions\/[^/]+\/Playbooks\/[^/]+\/(alert-trigger|incident-trigger)\/azuredeploy\.json$/i) ||
          // Other JSON files in playbook directories (excluding readme, images, etc.)
          (item.path.match(/\/(Playbooks|MasterPlaybooks)\/[^/]+\/[^/]+\.json$/i) &&
           !item.path.toLowerCase().includes('readme') &&
           !item.path.toLowerCase().includes('images'))
        )
    );

    console.error(`Found ${playbookFiles.length} playbook files`);

    const playbooks: Playbook[] = [];

    for (const file of playbookFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = JSON.parse(content);

        // Extract playbook name with better handling of various directory structures
        let playbookName = data.parameters?.PlaybookName?.defaultValue;

        if (!playbookName) {
          // Extract from path - handle multiple structures:
          // - "Playbooks/AS-Azure-AD-Disable-User/azuredeploy.json" -> "AS-Azure-AD-Disable-User"
          // - "MasterPlaybooks/Remediation-IP/Block-IPs/azuredeploy.json" -> "Block-IPs"
          // - "Solutions/VirusTotal/Playbooks/Get-VirusTotalDomainReport/alert-trigger/azuredeploy.json" -> "Get-VirusTotalDomainReport"
          const pathParts = file.path.split('/');
          const playbooksIndex = pathParts.findIndex(p => p === 'Playbooks' || p === 'MasterPlaybooks');

          if (playbooksIndex >= 0) {
            if (pathParts[playbooksIndex] === 'MasterPlaybooks' && pathParts.length > playbooksIndex + 2) {
              // MasterPlaybooks have a category level: MasterPlaybooks/Category/Name
              playbookName = pathParts[playbooksIndex + 2];
            } else if (pathParts.length > playbooksIndex + 1) {
              // Regular Playbooks: get directory immediately after "Playbooks"
              playbookName = pathParts[playbooksIndex + 1];
            } else {
              playbookName = file.path.split('/').pop()?.replace('.json', '') || 'Unknown';
            }
          } else {
            // Fallback to filename without extension
            playbookName = file.path.split('/').pop()?.replace('.json', '') || 'Unknown';
          }
        }

        playbooks.push({
          id: file.path,
          name: playbookName,
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
   * List all watchlists
   */
  async listWatchlists(): Promise<Watchlist[]> {
    console.error('Fetching watchlists from GitHub...');
    const tree = await this.github.getTree();

    const watchlistFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/^Watchlists\/.*\.json$/i) ||
          item.path.match(/^Solutions\/.*\/Watchlists\/.*\.json$/i))
    );

    console.error(`Found ${watchlistFiles.length} watchlist files`);

    const watchlists: Watchlist[] = [];
    for (const file of watchlistFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = JSON.parse(content);

        watchlists.push({
          id: file.path,
          name: data.Name || data.name || file.path.split('/').pop()?.replace('.json', '') || 'Unknown',
          description: data.Description || data.description,
          alias: data.Alias || data.alias,
          filePath: file.path,
          solution: this.extractSolutionName(file.path),
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${watchlists.length} watchlists`);
    return watchlists;
  }

  /**
   * List all notebooks
   */
  async listNotebooks(): Promise<Notebook[]> {
    console.error('Fetching notebooks from GitHub...');
    const tree = await this.github.getTree();

    const notebookFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/^Notebooks\/.*\.ipynb$/i) ||
          item.path.match(/^Solutions\/.*\/Notebooks\/.*\.ipynb$/i))
    );

    console.error(`Found ${notebookFiles.length} notebook files`);

    const notebooks: Notebook[] = [];
    for (const file of notebookFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = JSON.parse(content);

        notebooks.push({
          id: file.path,
          name: data.metadata?.kernelspec?.display_name || file.path.split('/').pop()?.replace('.ipynb', '') || 'Unknown',
          description: data.metadata?.description,
          tags: data.metadata?.tags || [],
          filePath: file.path,
          solution: this.extractSolutionName(file.path),
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${notebooks.length} notebooks`);
    return notebooks;
  }

  /**
   * List all exploration queries
   */
  async listExplorationQueries(): Promise<ExplorationQuery[]> {
    console.error('Fetching exploration queries from GitHub...');
    const tree = await this.github.getTree();

    const queryFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/^Exploration Queries\/.*\.yaml$/i) ||
          item.path.match(/^Solutions\/.*\/Exploration Queries\/.*\.yaml$/i))
    );

    console.error(`Found ${queryFiles.length} exploration query files`);

    const queries: ExplorationQuery[] = [];
    for (const file of queryFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = yaml.load(content) as any;

        if (data && data.id) {
          queries.push({
            id: data.id,
            name: data.name || 'Unknown',
            description: data.description,
            query: data.query,
            filePath: file.path,
            solution: this.extractSolutionName(file.path),
          });
        }
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${queries.length} exploration queries`);
    return queries;
  }

  /**
   * List all functions
   */
  async listFunctions(): Promise<SentinelFunction[]> {
    console.error('Fetching functions from GitHub...');
    const tree = await this.github.getTree();

    const functionFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/^Functions\/.*\.(txt|yaml|kql)$/i) ||
          item.path.match(/^Solutions\/.*\/Functions\/.*\.(txt|yaml|kql)$/i))
    );

    console.error(`Found ${functionFiles.length} function files`);

    const functions: SentinelFunction[] = [];
    for (const file of functionFiles) {
      try {
        const content = await this.github.getFileContent(file.path);

        functions.push({
          id: file.path,
          name: file.path.split('/').pop()?.replace(/\.(txt|yaml|kql)$/i, '') || 'Unknown',
          query: content,
          filePath: file.path,
          solution: this.extractSolutionName(file.path),
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${functions.length} functions`);
    return functions;
  }

  /**
   * List all ASIM content
   */
  async listASIMContent(): Promise<ASIMContent[]> {
    console.error('Fetching ASIM content from GitHub...');
    const tree = await this.github.getTree();

    const asimFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.match(/^ASIM\/.*\.(yaml|md|txt)$/i)
    );

    console.error(`Found ${asimFiles.length} ASIM files`);

    const asimContent: ASIMContent[] = [];
    for (const file of asimFiles) {
      try {
        let type: 'Parser' | 'Schema' | 'Documentation' = 'Documentation';
        if (file.path.includes('Parser')) {
          type = 'Parser';
        } else if (file.path.includes('Schema')) {
          type = 'Schema';
        }

        asimContent.push({
          id: file.path,
          name: file.path.split('/').pop() || 'Unknown',
          type,
          filePath: file.path,
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${asimContent.length} ASIM files`);
    return asimContent;
  }

  /**
   * List all summary rules
   */
  async listSummaryRules(): Promise<SummaryRule[]> {
    console.error('Fetching summary rules from GitHub...');
    const tree = await this.github.getTree();

    const ruleFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/^Summary rules\/.*\.yaml$/i) ||
          item.path.match(/^Solutions\/.*\/Summary rules\/.*\.yaml$/i))
    );

    console.error(`Found ${ruleFiles.length} summary rule files`);

    const rules: SummaryRule[] = [];
    for (const file of ruleFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = yaml.load(content) as any;

        if (data) {
          rules.push({
            id: data.id || file.path,
            name: data.name || file.path.split('/').pop()?.replace('.yaml', '') || 'Unknown',
            description: data.description,
            query: data.query,
            filePath: file.path,
            solution: this.extractSolutionName(file.path),
          });
        }
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${rules.length} summary rules`);
    return rules;
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

  /**
   * List all tools
   */
  async listTools(): Promise<Tool[]> {
    console.error('Fetching tools from GitHub...');
    const tree = await this.github.getTree();

    const toolDirs = tree.tree.filter(
      (item) =>
        item.type === 'tree' &&
        item.path.match(/^Tools\/[^/]+$/)
    );

    console.error(`Found ${toolDirs.length} tool directories`);

    const tools: Tool[] = [];
    for (const dir of toolDirs) {
      try {
        // Look for README or description files
        const toolFiles = tree.tree.filter(
          (item) => item.path.startsWith(dir.path + '/')
        );

        const readmeFile = toolFiles.find(f => f.path.toLowerCase().includes('readme'));
        let description = undefined;

        if (readmeFile) {
          try {
            const content = await this.github.getFileContent(readmeFile.path);
            // Extract first line as description
            description = content.split('\n')[0].replace(/^#\s*/, '').trim();
          } catch (error) {
            // Ignore readme read errors
          }
        }

        tools.push({
          id: dir.path,
          name: dir.path.split('/').pop() || 'Unknown',
          description,
          filePath: dir.path,
        });
      } catch (error) {
        console.error(`Error parsing ${dir.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${tools.length} tools`);
    return tools;
  }

  /**
   * List all tutorials
   */
  async listTutorials(): Promise<Tutorial[]> {
    console.error('Fetching tutorials from GitHub...');
    const tree = await this.github.getTree();

    const tutorialFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.match(/^Tutorials\/.*\.(md|ipynb)$/i)
    );

    console.error(`Found ${tutorialFiles.length} tutorial files`);

    const tutorials: Tutorial[] = [];
    for (const file of tutorialFiles) {
      try {
        tutorials.push({
          id: file.path,
          name: file.path.split('/').pop()?.replace(/\.(md|ipynb)$/i, '') || 'Unknown',
          filePath: file.path,
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${tutorials.length} tutorials`);
    return tutorials;
  }

  /**
   * List all dashboards
   */
  async listDashboards(): Promise<Dashboard[]> {
    console.error('Fetching dashboards from GitHub...');
    const tree = await this.github.getTree();

    const dashboardFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.match(/^Dashboards\/.*\.json$/i) ||
          item.path.match(/^Solutions\/.*\/Dashboards\/.*\.json$/i))
    );

    console.error(`Found ${dashboardFiles.length} dashboard files`);

    const dashboards: Dashboard[] = [];
    for (const file of dashboardFiles) {
      try {
        const content = await this.github.getFileContent(file.path);
        const data = JSON.parse(content);

        dashboards.push({
          id: file.path,
          name: data.name || file.path.split('/').pop()?.replace('.json', '') || 'Unknown',
          description: data.description,
          filePath: file.path,
          solution: this.extractSolutionName(file.path),
        });
      } catch (error) {
        console.error(`Error parsing ${file.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${dashboards.length} dashboards`);
    return dashboards;
  }

  /**
   * List all data connectors (root-level)
   */
  async listDataConnectors(): Promise<DataConnector[]> {
    console.error('Fetching data connectors from GitHub...');
    const tree = await this.github.getTree();

    const connectorDirs = tree.tree.filter(
      (item) =>
        item.type === 'tree' &&
        item.path.match(/^DataConnectors\/[^/]+$/)
    );

    console.error(`Found ${connectorDirs.length} data connector directories`);

    const connectors: DataConnector[] = [];
    for (const dir of connectorDirs) {
      try {
        // Look for JSON or README files in the connector directory
        const connectorFiles = tree.tree.filter(
          (item) => item.path.startsWith(dir.path + '/')
        );

        const jsonFile = connectorFiles.find(f => f.path.endsWith('.json'));
        let description = undefined;

        if (jsonFile) {
          try {
            const content = await this.github.getFileContent(jsonFile.path);
            const data = JSON.parse(content);
            description = data.description || data.metadata?.description;
          } catch (error) {
            // Ignore JSON read errors
          }
        }

        connectors.push({
          id: dir.path,
          name: dir.path.split('/').pop() || 'Unknown',
          description,
          filePath: dir.path,
        });
      } catch (error) {
        console.error(`Error parsing ${dir.path}:`, error);
      }
    }

    console.error(`Successfully loaded ${connectors.length} data connectors`);
    return connectors;
  }
}
