# Usage Guide: Azure Sentinel Solutions Analyzer MCP Server

## Quick Start

### 1. Install and Run

```bash
# Run directly via npx
npx sentinel-analyzer-mcp

# Or install globally
npm install -g sentinel-analyzer-mcp
sentinel-analyzer-mcp
```

### 2. Configure with Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sentinel-analyzer": {
      "command": "npx",
      "args": ["sentinel-analyzer-mcp"]
    }
  }
}
```

Restart Claude Desktop to load the server.

## Example Queries with Claude

Once configured, you can ask Claude questions like:

### Discover Solutions

```
"Search for Azure Active Directory solutions"
```

Claude will use the `search_solutions` tool to find matching solutions.

### Analyze Connectors

```
"What tables does the Azure AD connector populate?"
```

Claude will use `get_connector_tables` to retrieve table mappings.

### Solution Details

```
"Give me details about the Microsoft 365 Defender solution"
```

Claude will use `get_solution_details` for comprehensive information.

### Find Tables

```
"List all custom log tables (_CL) across all solutions"
```

Claude will use `list_tables` with `table_type: 'custom'`.

### Validate Definitions

```
"Validate this connector JSON: {...}"
```

Claude will use `validate_connector` to check structure and extract tables.

## Tool Reference

### analyze_solutions

Performs complete analysis of all Azure Sentinel solutions.

**When to use:**
- First time running the server
- Want to refresh data from latest Azure-Sentinel repository
- Need comprehensive statistics

**Parameters:**
```json
{
  "force_refresh": false,
  "output_format": "summary"
}
```

**Output formats:**
- `summary`: Quick overview with top tables and issue counts
- `json`: Complete analysis results
- `csv`: Structured CSV data (useful for exports)

**Example response (summary):**
```json
{
  "summary": {
    "totalSolutions": 243,
    "totalConnectors": 387,
    "totalTables": 156,
    "totalIssues": 12,
    "analysisDate": "2024-12-05T13:00:00Z",
    "repositoryCommit": "abc123..."
  },
  "topTables": [
    { "table": "SecurityEvent", "connectorCount": 45 },
    { "table": "Syslog", "connectorCount": 38 }
  ],
  "issueBreakdown": {
    "json_parse_error": 3,
    "no_table_definitions": 9
  }
}
```

### get_connector_tables

Retrieves tables for a specific connector.

**When to use:**
- Know the connector ID
- Want to see which tables a connector uses
- Need detection method details

**Parameters:**
```json
{
  "connector_id": "AzureActiveDirectory"
}
```

**Example response:**
```json
{
  "connectorId": "AzureActiveDirectory",
  "connectorTitle": "Azure Active Directory",
  "tables": [
    {
      "tableName": "SigninLogs",
      "detectionMethod": "graphQueries.0.baseQuery"
    },
    {
      "tableName": "AuditLogs",
      "detectionMethod": "sampleQueries.1.query"
    }
  ]
}
```

### search_solutions

Finds solutions matching criteria.

**When to use:**
- Exploring available solutions
- Filter by publisher or support tier
- Research specific vendors

**Parameters:**
```json
{
  "query": "Azure",
  "publisher": "Microsoft",
  "support_tier": "Microsoft"
}
```

**Example response:**
```json
{
  "solutions": [
    {
      "name": "Azure Active Directory",
      "publisher": "Microsoft",
      "version": "3.0.0",
      "supportTier": "Microsoft",
      "connectorCount": 4,
      "tableCount": 8
    }
  ]
}
```

### get_solution_details

Gets complete information about a solution.

**When to use:**
- Deep dive into a specific solution
- Understand solution architecture
- See all connectors and tables

**Parameters:**
```json
{
  "solution_name": "Azure Active Directory"
}
```

**Example response:**
```json
{
  "metadata": {
    "name": "Azure Active Directory",
    "publisher": "Microsoft",
    "version": "3.0.0",
    "supportTier": "Microsoft"
  },
  "connectors": [
    {
      "id": "AzureActiveDirectory",
      "title": "Azure Active Directory",
      "description": "Connect to Azure AD...",
      "tables": ["SigninLogs", "AuditLogs"]
    }
  ],
  "uniqueTables": ["SigninLogs", "AuditLogs", "AADNonInteractiveUserSignInLogs"],
  "githubUrl": "https://github.com/Azure/Azure-Sentinel/tree/master/Solutions/Azure%20Active%20Directory"
}
```

### list_tables

Lists all unique tables across solutions.

**When to use:**
- Inventory of available tables
- Filter custom vs standard tables
- Understanding data landscape

**Parameters:**
```json
{
  "table_type": "custom"
}
```

**Options:**
- `all`: All tables
- `custom`: Only custom logs (_CL suffix)
- `standard`: Only standard Log Analytics tables

**Example response:**
```json
[
  {
    "tableName": "MyCustomLogs_CL",
    "isCustomLog": true,
    "connectors": [
      {
        "connectorId": "MyCustomConnector",
        "connectorTitle": "My Custom Connector",
        "solution": "Custom Solution"
      }
    ]
  }
]
```

### validate_connector

Validates connector JSON and extracts tables.

**When to use:**
- Building new connectors
- Debugging connector definitions
- Testing before deployment

**Parameters:**
```json
{
  "connector_json": "{\"id\": \"test\", \"title\": \"Test\", \"graphQueries\": [{\"baseQuery\": \"SecurityEvent | take 10\"}]}"
}
```

**Example response:**
```json
{
  "isValid": true,
  "errors": [],
  "warnings": ["Missing recommended field: description"],
  "extractedTables": ["SecurityEvent"]
}
```

## Advanced Usage

### Understanding Detection Methods

When tables are extracted, the `detectionMethod` indicates how they were discovered:

1. **graphQueries.{N}.baseQuery**: Found in graph query definition
2. **sampleQueries.{N}.query**: Extracted from sample query
3. **dataTypes.{N}.lastDataReceivedQuery**: In health check query
4. **connectivityCriterias.{N}.value**: In connectivity validation
5. **variables.logAnalyticsTableId**: ARM template variable
6. **parser_resolution**: Resolved from YAML parser function

### Working with Custom Tables

Custom log tables (ending in `_CL`) are prioritized during resolution:

```
"List all connectors that use custom log tables"
```

Claude will filter for tables ending in `_CL`.

### Issue Reporting

Issues are categorized by type:

- **json_parse_error**: Malformed JSON in connector definition
- **no_table_definitions**: Connector has no table references
- **parser_tables_only**: Only parser refs, couldn't resolve to tables
- **missing_metadata**: SolutionMetadata.json not found
- **loganalytics_mismatch**: Declared table doesn't match discovered

### Repository Access

The server accesses the Azure-Sentinel repository via GitHub API:

**How it works:**
- Fetches files directly from GitHub (no cloning)
- No local storage required
- Caches file contents and analysis results in memory
- Always uses the latest commit from master branch

**Force refresh:**
```json
{
  "force_refresh": true
}
```

Clears the cache and re-analyzes from GitHub.

## Performance Tips

### 1. Use Summary Format

For quick stats without full data:

```json
{
  "output_format": "summary"
}
```

### 2. Cache Awareness

Results are cached by repository commit hash. Subsequent queries are instant.

### 3. Specific Queries

Instead of analyzing everything, use targeted tools:
- `get_connector_tables` for single connector
- `search_solutions` for filtered results
- `list_tables` with type filter

## Troubleshooting

### "Analysis results not available"

Run `analyze_solutions` first:

```
"Analyze all Azure Sentinel solutions"
```

### Slow First Run

The first analysis fetches many files from GitHub. Subsequent runs use cached results and are instant (unless the repository has new commits).

### GitHub API Access Issues

Check network connectivity to GitHub:

```bash
curl -I https://api.github.com
curl -I https://raw.githubusercontent.com
```

If you're behind a corporate firewall, you may need to configure proxy settings.

### Rate Limiting

If you see rate limit errors, use a GitHub personal access token:

```bash
export GITHUB_TOKEN=your_token_here
```

Create a token at: https://github.com/settings/tokens (no special scopes required)

### Server Won't Start

Verify Node.js version:

```bash
node --version  # Should be 18+
```

## Integration Examples

### With GitHub Copilot

```python
# In VS Code with Copilot Chat
"@sentinel-analyzer what tables does the AWS connector use?"
```

### With Custom Automation

```typescript
import { spawn } from 'child_process';

const server = spawn('npx', ['sentinel-analyzer-mcp']);

// Send MCP request
server.stdin.write(JSON.stringify({
  method: 'tools/call',
  params: {
    name: 'analyze_solutions',
    arguments: { output_format: 'summary' }
  }
}));
```

### With Other MCP Clients

Any MCP-compatible client can use this server by spawning the process and communicating via stdin/stdout.

## Best Practices

1. **Run analysis once** at the start of your session
2. **Use summary format** for quick insights
3. **Cache connector lookups** if querying repeatedly
4. **Validate connectors** before submitting to Azure Sentinel
5. **Check issues report** to identify problematic solutions
6. **Use specific tools** instead of full analysis when possible

## Next Steps

- Explore the [API Reference](README.md#available-tools)
- Check the [Architecture](README.md#architecture) section
- Review [Comparison to Python Version](README.md#comparison-to-python-version)
- Join discussions about Azure Sentinel solutions
