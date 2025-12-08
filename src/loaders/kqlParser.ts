/**
 * KQL (Kusto Query Language) parser for extracting table names
 * Implements context-aware parsing matching the Python version
 */

// KQL operators that indicate field context (not table references)
const PIPE_BLOCK_COMMANDS = new Set([
  'project',
  'project-away',
  'project-keep',
  'project-rename',
  'project-reorder',
  'extend',
  'summarize',
  'distinct',
  'where',
  'order',
  'sort',
  'top',
  'limit',
  'take',
  'sample',
  'join',
  'union',
  'datatable',
  'evaluate',
  'invoke',
  'as',
]);

// Tokens that are not table names
const NON_TABLE_TOKENS = new Set([
  'ago',
  'now',
  'true',
  'false',
  'null',
  'and',
  'or',
  'not',
  'between',
  'in',
  'contains',
  'startswith',
  'endswith',
  'has',
  'let',
  'print',
  'search',
]);

// Regular expression patterns
const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;
const ARM_VARIABLE_PATTERN = /\[variables\('([^']+)'\)\]/g;
const LET_ASSIGNMENT_PATTERN = /^\s*let\s+(\w+)\s*=/;
const TOKEN_PATTERN = /[A-Za-z0-9_.]+/g;

// Plural corrections for common table name mistakes
const PLURAL_TABLE_CORRECTIONS: Record<string, string> = {
  securityevents: 'SecurityEvent',
  syslog: 'Syslog',
  syslogs: 'Syslog',
  commonlogs: 'CommonSecurityLog',
  commonSecurityLogs: 'CommonSecurityLog',
  signinlogs: 'SigninLogs',
  auditlogs: 'AuditLogs',
};

/**
 * Extract table names from a KQL query string
 */
export function extractTablesFromQuery(
  query: string,
  variables?: Record<string, string>
): Set<string> {
  const tables = new Set<string>();

  if (!query || typeof query !== 'string') {
    return tables;
  }

  // Remove line comments (preserving URLs)
  const cleanedQuery = removeLineComments(query);

  // Strip pipe command blocks (content after operators that indicate field context)
  const queryWithoutFieldContext = stripPipeCommandBlocks(cleanedQuery);

  // Extract tokens that appear at pipeline heads
  const pipelineHeads = detectPipelineHeads(queryWithoutFieldContext);

  pipelineHeads.forEach((token) => {
    // Resolve ARM template variables if provided
    if (variables && token.match(ARM_VARIABLE_PATTERN)) {
      const resolved = resolveArmVariable(token, variables);
      if (resolved) {
        tables.add(resolved);
        return;
      }
    }

    // Skip non-table tokens
    if (NON_TABLE_TOKENS.has(token.toLowerCase())) {
      return;
    }

    // Skip let assignments
    if (token.match(LET_ASSIGNMENT_PATTERN)) {
      return;
    }

    // Apply plural corrections
    const corrected = PLURAL_TABLE_CORRECTIONS[token.toLowerCase()] || token;

    // Validate as a potential table name
    if (isValidTableToken(corrected)) {
      tables.add(corrected);
    }
  });

  return tables;
}

/**
 * Remove line comments from KQL, preserving URLs
 */
function removeLineComments(query: string): string {
  const lines = query.split('\n');
  return lines
    .map((line) => {
      // Don't strip // from http:// or https://
      if (line.includes('http://') || line.includes('https://')) {
        return line;
      }
      // Remove // comments
      const commentIndex = line.indexOf('//');
      if (commentIndex >= 0) {
        return line.substring(0, commentIndex);
      }
      return line;
    })
    .join('\n');
}

/**
 * Strip content after pipe operators that indicate field context
 */
function stripPipeCommandBlocks(query: string): string {
  let result = query;

  PIPE_BLOCK_COMMANDS.forEach((command) => {
    // Remove content after | command until next pipe
    const pattern = new RegExp(`\\|\\s*${command}\\s+[^|]*`, 'gi');
    result = result.replace(pattern, '|');
  });

  return result;
}

/**
 * Detect tokens that appear at the start of pipeline chains
 */
function detectPipelineHeads(query: string): Set<string> {
  const heads = new Set<string>();

  // Split by pipe operator
  const segments = query.split('|');

  // First segment is always a potential table reference
  if (segments.length > 0) {
    const tokens = extractTokens(segments[0]);
    tokens.forEach((token) => heads.add(token));
  }

  return heads;
}

/**
 * Extract valid identifier tokens from a string
 */
function extractTokens(text: string): string[] {
  const tokens: string[] = [];
  const matches = text.matchAll(TOKEN_PATTERN);

  for (const match of matches) {
    const token = match[0];
    if (token && token.length > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Resolve ARM template variable reference
 */
function resolveArmVariable(
  token: string,
  variables: Record<string, string>
): string | null {
  const match = token.match(ARM_VARIABLE_PATTERN);
  if (match && match[1]) {
    const varName = match[1];
    return variables[varName] || null;
  }
  return null;
}

/**
 * Validate if a token is a valid table name candidate
 */
function isValidTableToken(token: string): boolean {
  if (!token || token.length === 0) {
    return false;
  }

  // Must start with a letter
  if (!/^[A-Za-z]/.test(token)) {
    return false;
  }

  // Must contain only alphanumeric and underscore
  if (!/^[A-Za-z0-9_]+$/.test(token)) {
    return false;
  }

  // Minimum length
  if (token.length < 2) {
    return false;
  }

  return true;
}

/**
 * Extract placeholder variables from query (e.g., {{ tableName }})
 */
export function extractPlaceholders(query: string): string[] {
  const placeholders: string[] = [];
  const matches = query.matchAll(PLACEHOLDER_PATTERN);

  for (const match of matches) {
    if (match[1]) {
      placeholders.push(match[1]);
    }
  }

  return placeholders;
}
