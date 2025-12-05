# Sentinel Solutions MCP Server

An MCP (Model Context Protocol) server that analyzes Microsoft Sentinel solutions from any GitHub repository and maps data connectors to Log Analytics tables. Query the official Azure Sentinel Content Hub or your own custom/private solution repositories.

## Quick Start

```bash
# Use with npx (recommended - instant startup with pre-built index)
npx sentinel-solutions-mcp

# Or install globally
npm install -g sentinel-solutions-mcp
```

**Add to Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "sentinel-solutions": {
      "command": "npx",
      "args": ["sentinel-solutions-mcp"]
    }
  }
}
```

## Features

### Multi-Repository Support
Query any GitHub repository containing Sentinel solutions, not just the official Azure repo. Perfect for:
- **Private/Custom Solutions**: Analyze your organization's private Sentinel repository
- **Forked Repositories**: Test changes in your fork before contributing
- **Testing Environments**: Analyze development or staging branches
- **Community Solutions**: Explore third-party Sentinel solution repositories

### Performance Optimizations
- **Pre-built Index**: Ships with pre-built analysis for instant startup (< 1 second first query)
- **Direct GitHub Access**: Uses GitHub API - no cloning or downloads required!
- **Zero Setup**: Works immediately, no git repository cloning or storage needed
- **Always Current**: Accesses latest data directly from GitHub

### Comprehensive Analysis
- **Full Content Hub Coverage**: Analyzes all solutions in the Microsoft Sentinel Content Hub
- **13 MCP Tools**: Complete content analysis including:
  - Solution and connector analysis (6 tools)
  - Detection rules/analytics (2 tools)
  - Workbooks (2 tools)
  - Hunting queries (1 tool)
  - Playbooks/Logic Apps (1 tool)
  - Parsers/KQL functions (1 tool)
- **6 Detection Methods**: Implements all table detection strategies from the original Python tool:
  - graphQueries.{index}.baseQuery
  - sampleQueries.{index}.query
  - dataTypes.{index}.lastDataReceivedQuery
  - connectivityCriterias.{index}.value
  - ARM template logAnalyticsTableId variables
  - Parser function resolution with cycle prevention
- **Tolerant Parsing**: Multi-stage JSON parsing with fallback strategies
- **KQL Query Analysis**: Context-aware Kusto Query Language parser
- **YAML Parser Resolution**: Recursive parser-to-table mapping with depth limiting

## Installation

### Via npx (Recommended)

```bash
npx sentinel-solutions-mcp
```

### Global Installation

```bash
npm install -g sentinel-solutions-mcp
```

### From Source

```bash
git clone https://github.com/noodlemctwoodle/sentinel-solutions-mcp.git
cd sentinel-solutions-mcp
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sentinel-solutions": {
      "command": "npx",
      "args": ["sentinel-solutions-mcp"]
    }
  }
}
```

### With Other MCP Clients

The server communicates via stdin/stdout using the MCP protocol. Configure your MCP client to run:

```bash
npx sentinel-solutions-mcp
```

### Environment Variables

Configure repository access via environment variables:

```bash
export SENTINEL_REPO_OWNER=Azure                    # Default: Azure
export SENTINEL_REPO_NAME=Azure-Sentinel            # Default: Azure-Sentinel
export SENTINEL_REPO_BRANCH=master                  # Default: master
export SENTINEL_SOLUTIONS_PATH=Solutions            # Default: Solutions
export MCP_GITHUB_TOKEN=your_token_here             # Optional: for higher API limits (preferred)
# OR
export GITHUB_TOKEN=your_token_here                 # Alternative token name

npx sentinel-solutions-mcp
```

## Available Tools

### 1. analyze_solutions

Run full analysis on all Microsoft Sentinel solutions from any GitHub repository.

**Parameters:**
- `force_refresh` (boolean, optional): Force re-clone repository
- `output_format` (enum, optional): 'json' | 'csv' | 'summary' (default: 'json')
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')
- `solutions_path` (string, optional): Path to solutions directory (default: 'Solutions')

**Example (Default Repository):**
```json
{
  "force_refresh": false,
  "output_format": "summary"
}
```

**Example (Custom Repository):**
```json
{
  "repository_owner": "MyOrg",
  "repository_name": "CustomSentinelSolutions",
  "repository_branch": "main",
  "solutions_path": "MySolutions",
  "output_format": "json"
}
```

**Returns:** Complete analysis results with connector-table mappings

### 2. get_connector_tables

Get table mappings for a specific connector.

**Parameters:**
- `connector_id` (string, required): The connector identifier

**Example:**
```json
{
  "connector_id": "AzureActiveDirectory"
}
```

**Returns:** Connector details with all associated tables

### 3. search_solutions

Search solutions by name, publisher, or criteria.

**Parameters:**
- `query` (string, required): Search term
- `publisher` (string, optional): Filter by publisher
- `support_tier` (string, optional): Filter by support tier

**Example:**
```json
{
  "query": "Azure",
  "publisher": "Microsoft"
}
```

**Returns:** List of matching solutions with metadata

### 4. get_solution_details

Get comprehensive information about a specific solution.

**Parameters:**
- `solution_name` (string, required): Name of the solution

**Example:**
```json
{
  "solution_name": "Azure Active Directory"
}
```

**Returns:** Full solution details including connectors and tables

### 5. list_tables

Get all unique Log Analytics tables across all solutions.

**Parameters:**
- `table_type` (enum, optional): 'all' | 'custom' | 'standard' (default: 'all')

**Example:**
```json
{
  "table_type": "custom"
}
```

**Returns:** List of tables with connector associations

### 6. validate_connector

Validate a connector JSON definition and extract tables.

**Parameters:**
- `connector_json` (string, required): Connector JSON content

**Example:**
```json
{
  "connector_json": "{\"id\": \"test\", \"title\": \"Test Connector\"}"
}
```

**Returns:** Validation result with errors, warnings, and extracted tables

### 7. list_detections

List and filter Microsoft Sentinel detection rules (analytics rules).

**Parameters:**
- `solution` (string, optional): Filter by solution name
- `severity` (string, optional): Filter by severity (Informational, Low, Medium, High, Critical)
- `tactic` (string, optional): Filter by MITRE ATT&CK tactic
- `technique` (string, optional): Filter by MITRE ATT&CK technique
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')

**Example:**
```json
{
  "severity": "High",
  "tactic": "Persistence"
}
```

**Returns:** Array of detection rules with details including query, severity, tactics, and techniques

### 8. get_detection_details

Get detailed information about a specific detection rule.

**Parameters:**
- `detection_id` (string, required): The detection rule ID (GUID)
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')

**Example:**
```json
{
  "detection_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Returns:** Complete detection rule details including KQL query, entity mappings, and custom details

### 9. list_workbooks

List and filter Microsoft Sentinel workbooks.

**Parameters:**
- `solution` (string, optional): Filter by solution name
- `category` (string, optional): Filter by workbook category
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')

**Example:**
```json
{
  "solution": "Azure Active Directory",
  "category": "Identity"
}
```

**Returns:** Array of workbooks with metadata and data types used

### 10. get_workbook_details

Get detailed information about a specific workbook.

**Parameters:**
- `workbook_id` (string, required): The workbook ID or file path
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')

**Example:**
```json
{
  "workbook_id": "Azure-Active-Directory-Workbook.json"
}
```

**Returns:** Complete workbook details including visualization queries and data sources

### 11. list_hunting_queries

List and filter Microsoft Sentinel hunting queries.

**Parameters:**
- `solution` (string, optional): Filter by solution name
- `tactic` (string, optional): Filter by MITRE ATT&CK tactic
- `technique` (string, optional): Filter by MITRE ATT&CK technique
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')

**Example:**
```json
{
  "tactic": "Initial Access",
  "technique": "T1566"
}
```

**Returns:** Array of hunting queries with KQL, tactics, and techniques

### 12. list_playbooks

List Microsoft Sentinel playbooks (Logic Apps for automated response).

**Parameters:**
- `solution` (string, optional): Filter by solution name
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')

**Example:**
```json
{
  "solution": "Azure Active Directory"
}
```

**Returns:** Array of playbooks with metadata and ARM template information

### 13. list_parsers

List Microsoft Sentinel parsers (KQL functions for data transformation).

**Parameters:**
- `solution` (string, optional): Filter by solution name
- `repository_owner` (string, optional): GitHub repository owner (default: 'Azure')
- `repository_name` (string, optional): Repository name (default: 'Azure-Sentinel')
- `repository_branch` (string, optional): Branch to analyze (default: 'master')

**Example:**
```json
{
  "solution": "Cisco"
}
```

**Returns:** Array of parsers with KQL function definitions

## How It Works

### Repository Access

The server uses GitHub's API to access the Azure-Sentinel repository directly:
- **No downloads**: Fetches files via HTTPS from GitHub
- **No storage**: No local repository clone needed
- **Always current**: Gets latest commit automatically
- **In-memory caching**: Results cached by commit SHA for performance

### Table Detection

The analyzer uses 6 sophisticated detection methods to identify Log Analytics tables:

1. **Graph Queries**: Analyzes `graphQueries[].baseQuery` fields
2. **Sample Queries**: Parses `sampleQueries[].query` fields
3. **Data Types**: Examines `dataTypes[].lastDataReceivedQuery`
4. **Connectivity Criteria**: Checks `connectivityCriterias[].value`
5. **ARM Variables**: Resolves `logAnalyticsTableId` template variables
6. **Parser Resolution**: Recursively resolves YAML parser functions to tables

### KQL Parser

The built-in KQL parser:
- Detects pipeline heads (tables before `|` operator)
- Strips comments while preserving URLs
- Removes field context (content after operators like `project`, `extend`, etc.)
- Validates table name candidates
- Applies plural corrections for common mistakes

### Error Handling

The analyzer implements tolerant parsing:
- Multi-stage JSON parsing with fallback strategies
- Continues processing on individual connector failures
- Categorizes issues (parse errors, missing tables, etc.)
- Generates detailed issue reports

## Architecture

```
src/
├── analyzer/
│   ├── solutionAnalyzer.ts    # Main orchestration engine
│   ├── kqlParser.ts            # KQL query parser
│   ├── jsonParser.ts           # Tolerant JSON parsing
│   ├── parserResolver.ts       # YAML parser resolution
│   └── tableExtractor.ts       # Table detection logic
├── repository/
│   └── repoManager.ts          # Git clone/update management
├── generators/
│   └── csvGenerator.ts         # CSV/JSON output generation
├── tools/
│   └── index.ts                # MCP tool implementations
├── types/
│   └── index.ts                # TypeScript type definitions
└── index.ts                    # MCP server entry point
```

## Performance

- **Pre-built Index**: Instant first query (< 1 second) using pre-built analysis shipped with package
- **Smart Caching**: Analysis results and file contents cached by repository commit hash
- **Parallel Requests**: Multiple files fetched concurrently
- **No Downloads**: Zero initial download time - starts instantly
- **Auto-refresh**: Weekly automated index updates via GitHub Actions
- **Typical Performance**:
  - Default repo (with pre-built index): < 1 second
  - Custom repo (fresh analysis): 100+ solutions analyzed in ~30-60 seconds
  - Subsequent queries: Instant (cached)

## Comparison to Python Version

This TypeScript implementation provides:

- **Feature Parity**: All 6 detection methods implemented
- **Same Logic**: Matching parsing and resolution algorithms
- **MCP Integration**: Exposed via Model Context Protocol for AI agents
- **Multi-Repository**: Analyze any GitHub repo, not just official Azure repo
- **Pre-built Index**: Instant startup (< 1s) vs. full analysis every time
- **GitHub API Access**: No cloning, no storage, instant start
- **Better Distribution**: Runnable via npx, no Python or Git dependency
- **Type Safety**: Full TypeScript type definitions
- **Auto-updates**: Weekly index refresh via GitHub Actions

## Troubleshooting

### GitHub API Rate Limiting

The server uses GitHub's public API which has rate limits:
- **Unauthenticated**: 60 requests/hour
- **With GitHub Token**: 5000 requests/hour

For heavy use or private repositories, set a GitHub personal access token:
```bash
export MCP_GITHUB_TOKEN=your_token_here  # Preferred
# OR
export GITHUB_TOKEN=your_token_here      # Also supported
npx sentinel-solutions-mcp
```

### Custom Repository Configuration

To analyze a custom or private repository:

**Via Environment Variables:**
```bash
export SENTINEL_REPO_OWNER=MyOrganization
export SENTINEL_REPO_NAME=PrivateSentinelRepo
export SENTINEL_REPO_BRANCH=main
export SENTINEL_SOLUTIONS_PATH=CustomSolutions
export MCP_GITHUB_TOKEN=your_token_here  # Required for private repos

npx sentinel-solutions-mcp
```

**Via Tool Parameters:**
Use the repository configuration parameters directly in your MCP tool calls (see `analyze_solutions` documentation above).

### Analysis Takes Too Long

Use the `summary` output format for faster results:

```json
{
  "output_format": "summary"
}
```

Or use `force_refresh: false` to use cached results.

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Dev Mode

```bash
npm run dev
```

## Contributing

Contributions welcome! This project maintains feature parity with the Microsoft Sentinel Solutions Analyzer Python tool while adding MCP integration.

## License

MIT

## Credits

Based on the Microsoft Sentinel Solutions Analyzer Python tool from the [Azure-Sentinel](https://github.com/Azure/Azure-Sentinel) repository.

## Related Projects

- [Microsoft Sentinel](https://github.com/Azure/Azure-Sentinel) - Official Microsoft Sentinel repository
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
