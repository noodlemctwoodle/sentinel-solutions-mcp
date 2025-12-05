/**
 * GitHub API Client for accessing Microsoft Sentinel repositories remotely
 * No cloning required - uses GitHub API and raw file URLs
 * Supports any GitHub repository containing Sentinel solutions
 */

import { RepositoryConfig, DEFAULT_REPOSITORY_CONFIG } from '../types/repository.js';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export class GitHubClient {
  private cache: Map<string, any> = new Map();
  private config: RepositoryConfig;
  private token?: string;

  constructor(config?: Partial<RepositoryConfig>) {
    this.config = {
      ...DEFAULT_REPOSITORY_CONFIG,
      ...config,
    };
    // Check MCP_GITHUB_TOKEN first, then fall back to GITHUB_TOKEN
    this.token = process.env.MCP_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  }

  /**
   * Get fetch headers with optional authentication
   */
  private getFetchHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Get the repository configuration
   */
  getConfig(): RepositoryConfig {
    return { ...this.config };
  }

  /**
   * Get the latest commit SHA for the repository
   */
  async getLatestCommitSha(): Promise<string> {
    const url = `${GITHUB_API_BASE}/repos/${this.config.owner}/${this.config.name}/commits/${this.config.branch}`;

    try {
      const response = await fetch(url, { headers: this.getFetchHeaders() });
      if (!response.ok) {
        throw new Error(`Failed to fetch commit: ${response.statusText}`);
      }

      const data = (await response.json()) as { sha: string };
      return data.sha;
    } catch (error) {
      console.error('Warning: Failed to get latest commit SHA:', error);
      return 'unknown';
    }
  }

  /**
   * Get file content from GitHub
   */
  async getFileContent(path: string): Promise<string> {
    const cacheKey = `file:${path}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const url = `${GITHUB_RAW_BASE}/${this.config.owner}/${this.config.name}/${this.config.branch}/${path}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
      }

      const content = await response.text();
      this.cache.set(cacheKey, content);
      return content;
    } catch (error) {
      throw new Error(`Error fetching ${path}: ${error}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(path: string): Promise<GitHubTreeItem[]> {
    const cacheKey = `dir:${path}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const url = `${GITHUB_API_BASE}/repos/${this.config.owner}/${this.config.name}/contents/${path}?ref=${this.config.branch}`;

    try {
      const response = await fetch(url, { headers: this.getFetchHeaders() });
      if (!response.ok) {
        throw new Error(`Failed to list ${path}: ${response.statusText}`);
      }

      const items = (await response.json()) as GitHubTreeItem[];
      this.cache.set(cacheKey, items);
      return items;
    } catch (error) {
      throw new Error(`Error listing ${path}: ${error}`);
    }
  }

  /**
   * Get full directory tree recursively (for Solutions directory)
   */
  async getTree(treeSha?: string): Promise<GitHubTree> {
    // If no treeSha provided, get it from the latest commit
    if (!treeSha) {
      const commitSha = await this.getLatestCommitSha();
      if (commitSha === 'unknown') {
        throw new Error('Unable to get latest commit SHA');
      }

      const commitUrl = `${GITHUB_API_BASE}/repos/${this.config.owner}/${this.config.name}/git/commits/${commitSha}`;
      const commitResponse = await fetch(commitUrl, { headers: this.getFetchHeaders() });

      if (!commitResponse.ok) {
        throw new Error(`Failed to fetch commit: ${commitResponse.statusText}`);
      }

      const commitData = (await commitResponse.json()) as { tree: { sha: string } };

      if (!commitData.tree || !commitData.tree.sha) {
        throw new Error('Invalid commit response: missing tree.sha');
      }

      treeSha = commitData.tree.sha;
    }

    const url = `${GITHUB_API_BASE}/repos/${this.config.owner}/${this.config.name}/git/trees/${treeSha}?recursive=1`;

    try {
      const response = await fetch(url, { headers: this.getFetchHeaders() });
      if (!response.ok) {
        throw new Error(`Failed to fetch tree: ${response.statusText}`);
      }

      return (await response.json()) as GitHubTree;
    } catch (error) {
      throw new Error(`Error fetching tree: ${error}`);
    }
  }

  /**
   * Find all files matching a pattern in the tree
   */
  filterTreeByPattern(tree: GitHubTree, pattern: RegExp): GitHubTreeItem[] {
    return tree.tree.filter((item) => item.type === 'blob' && pattern.test(item.path));
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Generate GitHub web URL for a path
   */
  getGitHubUrl(path: string): string {
    return `https://github.com/${this.config.owner}/${this.config.name}/tree/${this.config.branch}/${path}`;
  }

  /**
   * Generate GitHub blob URL for a file
   */
  getGitHubBlobUrl(path: string): string {
    return `https://github.com/${this.config.owner}/${this.config.name}/blob/${this.config.branch}/${path}`;
  }
}
