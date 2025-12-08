/**
 * Centralized content filtering utilities
 * Provides consistent filtering logic across all content tools
 */

import { Detection, HuntingQuery, Workbook, Playbook, Parser } from '../types/content.js';

/**
 * Apply filters to detections
 */
export function filterDetections(
  detections: Detection[],
  filters: {
    solution?: string;
    severity?: string;
    tactic?: string;
    technique?: string;
    status?: string;
    name?: string;
    query_contains?: string;
    path_contains?: string;
  }
): Detection[] {
  let filtered = detections;

  if (filters.solution) {
    filtered = filtered.filter(d =>
      d.solution?.toLowerCase().includes(filters.solution!.toLowerCase())
    );
  }

  if (filters.severity) {
    filtered = filtered.filter(d =>
      d.severity?.toLowerCase() === filters.severity!.toLowerCase()
    );
  }

  if (filters.tactic) {
    filtered = filtered.filter(d =>
      d.tactics?.some(t => t.toLowerCase().includes(filters.tactic!.toLowerCase()))
    );
  }

  if (filters.technique) {
    filtered = filtered.filter(d =>
      d.techniques?.some(t => t.toLowerCase().includes(filters.technique!.toLowerCase()))
    );
  }

  if (filters.status) {
    filtered = filtered.filter(d =>
      d.status?.toLowerCase().includes(filters.status!.toLowerCase())
    );
  }

  if (filters.name) {
    filtered = filtered.filter(d =>
      d.name?.toLowerCase().includes(filters.name!.toLowerCase())
    );
  }

  if (filters.query_contains) {
    const searchTerm = filters.query_contains.toLowerCase();
    const hasQueryContent = filtered.some(d => d.query !== undefined);

    if (!hasQueryContent) {
      // Optimized index - queries excluded
      console.error('⚠️  Query content search not available: The optimized index excludes KQL queries for token efficiency.');
      console.error('    Use force_refresh: true to fetch from GitHub and search query content (takes 30-60 seconds).');
      console.error('    Tip: Try searching by name, path_contains, solution, tactic, technique, severity, or status instead.');
      // Don't filter - return results based on other criteria
    } else {
      // Full index with queries - apply filter
      filtered = filtered.filter(d => d.query && d.query.toLowerCase().includes(searchTerm));
    }
  }

  if (filters.path_contains) {
    filtered = filtered.filter(d =>
      d.filePath?.toLowerCase().includes(filters.path_contains!.toLowerCase())
    );
  }

  return filtered;
}

/**
 * Apply filters to hunting queries
 */
export function filterHuntingQueries(
  queries: HuntingQuery[],
  filters: {
    solution?: string;
    tactic?: string;
    technique?: string;
    name?: string;
    query_contains?: string;
    path_contains?: string;
  }
): HuntingQuery[] {
  let filtered = queries;

  if (filters.solution) {
    filtered = filtered.filter(q =>
      q.solution?.toLowerCase().includes(filters.solution!.toLowerCase())
    );
  }

  if (filters.tactic) {
    filtered = filtered.filter(q =>
      q.tactics?.some(t => t.toLowerCase().includes(filters.tactic!.toLowerCase()))
    );
  }

  if (filters.technique) {
    filtered = filtered.filter(q =>
      q.techniques?.some(t => t.toLowerCase().includes(filters.technique!.toLowerCase()))
    );
  }

  if (filters.name) {
    filtered = filtered.filter(q =>
      q.name?.toLowerCase().includes(filters.name!.toLowerCase())
    );
  }

  if (filters.query_contains) {
    const searchTerm = filters.query_contains.toLowerCase();
    const hasQueryContent = filtered.some(q => q.query !== undefined);

    if (!hasQueryContent) {
      // Optimized index - queries excluded
      console.error('⚠️  Query content search not available: The optimized index excludes KQL queries for token efficiency.');
      console.error('    Use force_refresh: true to fetch from GitHub and search query content (takes 30-60 seconds).');
      console.error('    Tip: Try searching by name, path_contains, solution, tactic, or technique instead.');
      // Don't filter - return results based on other criteria
    } else {
      // Full index with queries - apply filter
      filtered = filtered.filter(q => q.query && q.query.toLowerCase().includes(searchTerm));
    }
  }

  if (filters.path_contains) {
    filtered = filtered.filter(q =>
      q.filePath?.toLowerCase().includes(filters.path_contains!.toLowerCase())
    );
  }

  return filtered;
}

/**
 * Apply generic filters to any content type
 */
export function filterGenericContent<T extends { solution?: string; name?: string; filePath?: string }>(
  items: T[],
  filters: {
    solution?: string;
    name?: string;
    path_contains?: string;
  }
): T[] {
  let filtered = items;

  if (filters.solution) {
    filtered = filtered.filter(item =>
      item.solution?.toLowerCase().includes(filters.solution!.toLowerCase())
    );
  }

  if (filters.name) {
    filtered = filtered.filter(item =>
      item.name?.toLowerCase().includes(filters.name!.toLowerCase())
    );
  }

  if (filters.path_contains) {
    filtered = filtered.filter(item =>
      item.filePath?.toLowerCase().includes(filters.path_contains!.toLowerCase())
    );
  }

  return filtered;
}

/**
 * Apply filters to workbooks
 */
export function filterWorkbooks(
  workbooks: Workbook[],
  filters: {
    solution?: string;
    category?: string;
    name?: string;
    path_contains?: string;
  }
): Workbook[] {
  let filtered = workbooks;

  if (filters.solution) {
    filtered = filtered.filter(w =>
      w.solution?.toLowerCase().includes(filters.solution!.toLowerCase())
    );
  }

  if (filters.category) {
    filtered = filtered.filter(w =>
      w.category?.toLowerCase().includes(filters.category!.toLowerCase())
    );
  }

  if (filters.name) {
    filtered = filtered.filter(w =>
      w.name?.toLowerCase().includes(filters.name!.toLowerCase())
    );
  }

  if (filters.path_contains) {
    filtered = filtered.filter(w =>
      w.filePath?.toLowerCase().includes(filters.path_contains!.toLowerCase())
    );
  }

  return filtered;
}

/**
 * Apply filters to playbooks
 */
export function filterPlaybooks(
  playbooks: Playbook[],
  filters: {
    solution?: string;
    name?: string;
    path_contains?: string;
  }
): Playbook[] {
  return filterGenericContent(playbooks, filters);
}

/**
 * Apply filters to parsers
 */
export function filterParsers(
  parsers: Parser[],
  filters: {
    solution?: string;
    name?: string;
    path_contains?: string;
  }
): Parser[] {
  return filterGenericContent(parsers, filters);
}

/**
 * Apply result limiting with user feedback
 */
export function applyLimit<T>(
  items: T[],
  limit: number | undefined,
  contentType: string
): T[] {
  const totalResults = items.length;
  const effectiveLimit = Math.min(limit || 1000, 5000);

  if (totalResults > effectiveLimit) {
    console.error(`⚠️  Returning ${effectiveLimit} of ${totalResults} ${contentType}. Use 'limit' parameter to adjust (max: 5000).`);
  }

  return items.slice(0, effectiveLimit);
}
