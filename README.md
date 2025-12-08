# Sentinel Solutions MCP Server

An MCP (Model Context Protocol) server that analyzes Microsoft Sentinel solutions from any GitHub repository and maps data connectors to Log Analytics tables. Query the official Azure Sentinel Content Hub or your own custom/private solution repositories.

## Quick Start

```bash
# Use with npx (recommended - instant startup with pre-built index)
npx 

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

- **Full Content Hub Coverage**: Analyzes the entire Microsoft Sentinel Content Hub repository
- **15+ Content Types Indexed**: Pre-built index includes 2,579 detections, 519 workbooks, 2,463 hunting queries, 696 playbooks, 895 parsers, 51 watchlists, 6 functions, 105 ASIM items, 16 summary rules, 41 tools, and more
- **8,697 Total Items**: Comprehensive index with 480 solutions and complete connector-table mappings
- **19 MCP Tools**: Query all content types including solutions, connectors, detections, workbooks, hunting queries, playbooks, parsers, watchlists, notebooks, functions, ASIM content, and summary rules
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

## Installation & Usage

```bash
# Run with npx (recommended)
npx sentinel-solutions-mcp

# Or install globally
npm install -g sentinel-solutions-mcp
```

**Claude Desktop Configuration:**

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

For detailed usage instructions, configuration options, and examples, see [USAGE.md](USAGE.md).

## Available Tools

The MCP server provides 19 tools for querying Microsoft Sentinel content:

### Solution & Connector Analysis (6 tools)

- `analyze_solutions` - Full analysis of all solutions with connector-table mappings
- `get_connector_tables` - Get Log Analytics tables for a specific connector
- `search_solutions` - Search solutions by name, publisher, or support tier
- `get_solution_details` - Comprehensive details about a specific solution
- `list_tables` - List all Log Analytics tables (all/custom/standard)
- `validate_connector` - Validate connector JSON and extract tables

### Content Analysis (13 tools)

- `list_detections` / `get_detection_details` - Detection rules with MITRE ATT&CK mappings
- `list_workbooks` / `get_workbook_details` - Workbooks and visualizations
- `list_hunting_queries` - Threat hunting queries
- `list_playbooks` - Automation playbooks (Logic Apps)
- `list_parsers` - KQL parsers and functions
- `list_watchlists` - Watchlist definitions
- `list_notebooks` - Jupyter notebooks
- `list_exploration_queries` - Exploration queries
- `list_functions` - Saved KQL functions
- `list_asim_content` - ASIM (Advanced Security Information Model) content
- `list_summary_rules` - Summary rules

All tools support filtering by solution and querying custom/private repositories via the pre-built index or live GitHub API. See [USAGE.md](USAGE.md) for detailed documentation and examples.

## How It Works

The server provides instant access to the Microsoft Sentinel Content Hub:

1. **Pre-built Index**: Ships with a comprehensive 11MB index containing all 8,697+ items from the Azure-Sentinel repository
2. **Instant Queries**: First query returns results in < 1 second using the pre-built index
3. **GitHub API Access**: Optional live queries via GitHub API for custom repositories or latest updates
4. **Smart Caching**: Results cached by repository commit SHA for optimal performance
5. **Multi-Repository Support**: Query any GitHub repository containing Sentinel solutions

The analyzer uses 6 sophisticated detection methods to identify Log Analytics tables from connector definitions, including KQL query parsing, ARM template analysis, and recursive parser resolution. See [USAGE.md](USAGE.md) for technical details.

## Architecture

Built with TypeScript and the Model Context Protocol SDK:

- **MCP Server**: Stdio-based communication for AI agent integration
- **Content Analyzer**: Parses all Sentinel content types from GitHub repositories
- **Pre-built Index**: 11MB JSON index with 8,697+ items shipped with the package
- **GitHub Client**: Direct API access with smart caching and rate limit handling
- **Type Safety**: Full TypeScript definitions for all content types

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

**GitHub API Rate Limits**: The pre-built index eliminates the need for GitHub API access in most cases. For custom repositories or live updates, use a GitHub token:

```bash
export MCP_GITHUB_TOKEN=your_token_here
```

**Custom Repositories**: Configure via environment variables or tool parameters. See [USAGE.md](USAGE.md) for details.

**Performance**: The pre-built index provides instant results (< 1s). Custom repository analysis takes 30-60 seconds for first query, then cached.

## Development

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript + pre-built index
npm run dev          # Run in development mode
npm test             # Verify index loads correctly
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
