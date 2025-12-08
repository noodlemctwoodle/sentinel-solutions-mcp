/**
 * Optimized Index Builder - Creates LLM-friendly index
 * Reduces token usage by excluding large KQL queries
 */

import { createHash } from 'crypto';
import { AnalysisResult } from '../types/index.js';
import {
  OptimizedIndex,
  LightweightDetection,
  LightweightHuntingQuery,
  LightweightWorkbook,
  LightweightPlaybook,
  LightweightParser,
} from '../types/optimizedIndex.js';

export class OptimizedIndexBuilder {
  /**
   * Build optimized index from full analysis result
   * Excludes KQL queries to reduce size by ~80%
   */
  static build(fullIndex: AnalysisResult): OptimizedIndex {
    return {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      repositoryCommit: fullIndex.metadata.repositoryCommit,

      stats: {
        totalSolutions: fullIndex.metadata.totalSolutions,
        totalConnectors: fullIndex.metadata.totalConnectors,
        totalTables: fullIndex.metadata.totalTables,
        totalDetections: fullIndex.detections?.length || 0,
        totalWorkbooks: fullIndex.workbooks?.length || 0,
        totalHuntingQueries: fullIndex.huntingQueries?.length || 0,
        totalPlaybooks: fullIndex.playbooks?.length || 0,
        totalParsers: fullIndex.parsers?.length || 0,
      },

      content: {
        detections: this.buildLightweightDetections(fullIndex.detections || []),
        huntingQueries: this.buildLightweightHuntingQueries(
          fullIndex.huntingQueries || []
        ),
        workbooks: this.buildLightweightWorkbooks(fullIndex.workbooks || []),
        playbooks: this.buildLightweightPlaybooks(fullIndex.playbooks || []),
        parsers: this.buildLightweightParsers(fullIndex.parsers || []),
      },

      mappings: fullIndex.mappings.map((m) => ({
        solution: m.solution,
        connectorId: m.connectorId,
        connectorTitle: m.connectorTitle,
        tableName: m.tableName,
      })),
    };
  }

  /**
   * Create lightweight detection (without query)
   */
  private static buildLightweightDetections(
    detections: any[]
  ): LightweightDetection[] {
    return detections.map((d) => ({
      id: d.id,
      name: d.name,
      description: this.truncateDescription(d.description, 200),
      severity: d.severity,
      status: d.status,
      tactics: d.tactics,
      techniques: d.techniques,
      queryHash: d.query ? this.hashQuery(d.query) : undefined,
      querySize: d.query?.length,
      filePath: d.filePath,
      solution: d.solution,
    }));
  }

  /**
   * Create lightweight hunting query (without query)
   */
  private static buildLightweightHuntingQueries(
    queries: any[]
  ): LightweightHuntingQuery[] {
    return queries.map((q) => ({
      id: q.id,
      name: q.name,
      description: this.truncateDescription(q.description, 200),
      tactics: q.tactics,
      techniques: q.techniques,
      queryHash: q.query ? this.hashQuery(q.query) : undefined,
      querySize: q.query?.length,
      filePath: q.filePath,
      solution: q.solution,
    }));
  }

  /**
   * Create lightweight workbook
   */
  private static buildLightweightWorkbooks(workbooks: any[]): LightweightWorkbook[] {
    return workbooks.map((w) => ({
      id: w.id,
      name: w.name,
      description: this.truncateDescription(w.description, 200),
      category: w.category,
      dataTypes: w.dataTypes,
      filePath: w.filePath,
      solution: w.solution,
    }));
  }

  /**
   * Create lightweight playbook
   */
  private static buildLightweightPlaybooks(playbooks: any[]): LightweightPlaybook[] {
    return playbooks.map((p) => ({
      id: p.id,
      name: p.name,
      description: this.truncateDescription(p.description, 200),
      filePath: p.filePath,
      solution: p.solution,
    }));
  }

  /**
   * Create lightweight parser (without query)
   */
  private static buildLightweightParsers(parsers: any[]): LightweightParser[] {
    return parsers.map((p) => ({
      id: p.id,
      name: p.name,
      description: this.truncateDescription(p.description, 200),
      queryHash: p.query ? this.hashQuery(p.query) : undefined,
      querySize: p.query?.length,
      filePath: p.filePath,
      solution: p.solution,
    }));
  }

  /**
   * Truncate long descriptions to save tokens
   */
  private static truncateDescription(
    description: string | undefined,
    maxLength: number
  ): string | undefined {
    if (!description) return undefined;
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  }

  /**
   * Create hash of query for lookup
   */
  private static hashQuery(query: string): string {
    return createHash('md5').update(query).digest('hex').substring(0, 12);
  }

  /**
   * Calculate size reduction
   */
  static calculateSizeReduction(
    fullIndex: AnalysisResult,
    optimizedIndex: OptimizedIndex
  ): { fullSize: number; optimizedSize: number; reduction: string } {
    const fullSize = JSON.stringify(fullIndex).length;
    const optimizedSize = JSON.stringify(optimizedIndex).length;
    const reduction = (((fullSize - optimizedSize) / fullSize) * 100).toFixed(1);

    return {
      fullSize,
      optimizedSize,
      reduction: `${reduction}%`,
    };
  }
}
