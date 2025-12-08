/**
 * Tolerant JSON parser with multi-stage fallback strategy
 * Matches the Python version's resilience for malformed JSON
 */

export interface JsonParseResult<T = any> {
  data?: T;
  error?: string;
}

/**
 * Parse JSON with tolerance for common formatting issues
 */
export function parseJsonTolerant<T = any>(content: string): JsonParseResult<T> {
  // Strategy 1: Standard JSON.parse
  try {
    const data = JSON.parse(content);
    return { data };
  } catch (error) {
    // Continue to fallback strategies
  }

  // Strategy 2: Strip JavaScript-style comments (preserving URLs)
  try {
    const withoutComments = stripComments(content);
    const data = JSON.parse(withoutComments);
    return { data };
  } catch (error) {
    // Continue to fallback strategies
  }

  // Strategy 3: Remove trailing commas
  try {
    const withoutTrailingCommas = removeTrailingCommas(content);
    const data = JSON.parse(withoutTrailingCommas);
    return { data };
  } catch (error) {
    // Continue to fallback strategies
  }

  // Strategy 4: Combined - strip comments AND remove trailing commas
  try {
    const cleaned = removeTrailingCommas(stripComments(content));
    const data = JSON.parse(cleaned);
    return { data };
  } catch (error) {
    return {
      error: `Failed to parse JSON after all attempts: ${error}`,
    };
  }
}

/**
 * Strip JavaScript-style line comments from JSON
 * Preserves http:// and https:// URLs
 */
function stripComments(content: string): string {
  const lines = content.split('\n');
  const cleanedLines = lines.map((line) => {
    // Find // that is not part of http:// or https://
    const match = line.match(/^(.*?)(?<!:)\/\/(.*)$/);
    if (match && !line.includes('http://') && !line.includes('https://')) {
      return match[1]; // Return everything before //
    }
    return line;
  });
  return cleanedLines.join('\n');
}

/**
 * Remove trailing commas from JSON
 * Handles commas before } and ]
 */
function removeTrailingCommas(content: string): string {
  // Remove trailing commas before closing braces/brackets
  // Pattern: comma followed by optional whitespace and closing brace/bracket
  return content
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/,(\s*\n\s*[}\]])/g, '$1');
}

/**
 * Parse JSON file content with tolerance
 */
export async function parseJsonFile<T = any>(
  filePath: string,
  content: string
): Promise<JsonParseResult<T>> {
  const result = parseJsonTolerant<T>(content);

  if (result.error) {
    return {
      error: `Error parsing ${filePath}: ${result.error}`,
    };
  }

  return result;
}
