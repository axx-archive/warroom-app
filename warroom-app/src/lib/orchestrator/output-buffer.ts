// OutputBuffer - Manages stdout/stderr capture for Claude Code processes
// Stores the last MAX_LINES lines per lane and parses output for progress/errors

import { TokenUsage, CostTracking } from "@/lib/plan-schema";

const MAX_LINES = 1000;

// Model pricing in USD per million tokens (as of 2025)
// These are approximate prices - update as needed
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
  "claude-opus-4-20250514": { input: 15.0, output: 75.0, cacheRead: 1.50, cacheWrite: 18.75 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
  "claude-3-opus-20240229": { input: 15.0, output: 75.0, cacheRead: 1.50, cacheWrite: 18.75 },
  "claude-3-5-haiku-20241022": { input: 0.80, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
  // Default fallback for unknown models (using sonnet pricing)
  "default": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
};

// Token usage patterns in Claude Code output
// Claude Code outputs token info in various formats
const TOKEN_PATTERNS = [
  // Pattern: "Total tokens: 12,345" or "tokens: 12345"
  /(?:total\s+)?tokens?:\s*([\d,]+)/i,
  // Pattern: "Input: 1,000 tokens, Output: 500 tokens"
  /input:\s*([\d,]+)\s*tokens?,?\s*output:\s*([\d,]+)\s*tokens?/i,
  // Pattern: "Usage: 1000 input, 500 output"
  /usage:\s*([\d,]+)\s*input,?\s*([\d,]+)\s*output/i,
  // Pattern: "(12345 tokens)"
  /\(([\d,]+)\s*tokens?\)/i,
  // Pattern: "prompt tokens: 1000, completion tokens: 500"
  /prompt\s*tokens?:\s*([\d,]+).*?completion\s*tokens?:\s*([\d,]+)/i,
  // Pattern for cache tokens: "cache read: 1000, cache write: 500"
  /cache\s*read(?:\s*tokens?)?:\s*([\d,]+)/i,
  /cache\s*write(?:\s*tokens?)?:\s*([\d,]+)/i,
];

// Model detection patterns
const MODEL_PATTERNS = [
  /model[:\s]+([a-z0-9-]+)/i,
  /using\s+([a-z0-9-]+)/i,
  /(claude-[a-z0-9-]+)/i,
];

// Progress indicator patterns detected in Claude Code output
const PROGRESS_PATTERNS = [
  /(\d+(?:\.\d+)?%)/,                    // Percentage: 75% or 75.5%
  /\[(\d+)\/(\d+)\]/,                    // Step count: [3/5]
  /step\s+(\d+)\s+of\s+(\d+)/i,          // Step X of Y
  /processing\s+(\d+)\s+of\s+(\d+)/i,    // Processing X of Y
  /completed\s+(\d+)\s+of\s+(\d+)/i,     // Completed X of Y
];

// Error patterns to detect in output
const ERROR_PATTERNS = [
  { pattern: /error:?\s*(.+)/i, type: "general" as const },
  { pattern: /API\s*error/i, type: "api" as const },
  { pattern: /rate\s*limit/i, type: "rate_limit" as const },
  { pattern: /authentication\s*(failed|error)/i, type: "auth" as const },
  { pattern: /connection\s*(failed|error|refused)/i, type: "connection" as const },
  { pattern: /timeout/i, type: "timeout" as const },
  { pattern: /crash(ed)?/i, type: "crash" as const },
  { pattern: /SIGTERM|SIGKILL|signal\s+\d+/i, type: "signal" as const },
  { pattern: /out\s+of\s+memory|OOM/i, type: "oom" as const },
  { pattern: /permission\s+denied/i, type: "permission" as const },
];

// Warning patterns
const WARNING_PATTERNS = [
  /warning:?\s*(.+)/i,
  /deprecated/i,
  /retry(ing)?/i,
];

// Output line with metadata
export interface OutputLine {
  timestamp: string;
  stream: "stdout" | "stderr";
  content: string;
  lineNumber: number;
}

// Parsed progress indicator
export interface ProgressIndicator {
  type: "percentage" | "step";
  value: number;
  total?: number;
  raw: string;
}

// Detected error
export interface DetectedError {
  timestamp: string;
  type: "general" | "api" | "rate_limit" | "auth" | "connection" | "timeout" | "crash" | "signal" | "oom" | "permission";
  message: string;
  lineNumber: number;
}

// Output buffer state for a lane
export interface LaneOutputState {
  laneId: string;
  lines: OutputLine[];
  totalLines: number;
  lastProgress?: ProgressIndicator;
  errors: DetectedError[];
  warnings: string[];
  startedAt: string;
  lastActivityAt: string;
  // Token/cost tracking
  tokenUsage: TokenUsage;
  costTracking: CostTracking;
}

// Buffer for a single lane
class LaneOutputBuffer {
  private lines: OutputLine[] = [];
  private totalLines = 0;
  private lastProgress?: ProgressIndicator;
  private errors: DetectedError[] = [];
  private warnings: string[] = [];
  private startedAt: string;
  private lastActivityAt: string;
  // Token/cost tracking
  private tokenUsage: TokenUsage;
  private detectedModel?: string;

  constructor(private laneId: string) {
    this.startedAt = new Date().toISOString();
    this.lastActivityAt = this.startedAt;
    // Initialize token usage with zeros
    this.tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      updatedAt: this.startedAt,
    };
  }

  // Add a line of output
  addLine(content: string, stream: "stdout" | "stderr"): void {
    this.totalLines++;
    this.lastActivityAt = new Date().toISOString();

    const line: OutputLine = {
      timestamp: this.lastActivityAt,
      stream,
      content,
      lineNumber: this.totalLines,
    };

    this.lines.push(line);

    // Prune if over max lines
    if (this.lines.length > MAX_LINES) {
      this.lines = this.lines.slice(-MAX_LINES);
    }

    // Parse for progress and errors
    this.parseContent(content, line.lineNumber);
  }

  // Parse line content for progress and errors
  private parseContent(content: string, lineNumber: number): void {
    // Check for progress indicators
    for (const pattern of PROGRESS_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        if (match[1] && match[1].endsWith("%")) {
          this.lastProgress = {
            type: "percentage",
            value: parseFloat(match[1]),
            raw: match[0],
          };
        } else if (match[1] && match[2]) {
          this.lastProgress = {
            type: "step",
            value: parseInt(match[1], 10),
            total: parseInt(match[2], 10),
            raw: match[0],
          };
        }
        break;
      }
    }

    // Check for error patterns
    for (const { pattern, type } of ERROR_PATTERNS) {
      if (pattern.test(content)) {
        const error: DetectedError = {
          timestamp: this.lastActivityAt,
          type,
          message: content.trim(),
          lineNumber,
        };
        this.errors.push(error);

        // Keep only recent errors (last 50)
        if (this.errors.length > 50) {
          this.errors = this.errors.slice(-50);
        }
        break;
      }
    }

    // Check for warning patterns
    for (const pattern of WARNING_PATTERNS) {
      if (pattern.test(content)) {
        this.warnings.push(content.trim());

        // Keep only recent warnings (last 50)
        if (this.warnings.length > 50) {
          this.warnings = this.warnings.slice(-50);
        }
        break;
      }
    }

    // Parse token usage information
    this.parseTokenInfo(content);
  }

  // Parse token usage from output
  private parseTokenInfo(content: string): void {
    const lowerContent = content.toLowerCase();

    // Skip if no token-related content
    if (!lowerContent.includes("token") && !lowerContent.includes("usage") && !lowerContent.includes("cache")) {
      return;
    }

    // Try to detect model
    if (!this.detectedModel) {
      for (const pattern of MODEL_PATTERNS) {
        const modelMatch = content.match(pattern);
        if (modelMatch && modelMatch[1]) {
          this.detectedModel = modelMatch[1].toLowerCase();
          break;
        }
      }
    }

    // Parse for input/output token patterns
    for (const pattern of TOKEN_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        // Check if this is an input/output combined pattern
        if (match[2] !== undefined) {
          // Pattern has both input and output
          const inputTokens = parseInt(match[1].replace(/,/g, ""), 10);
          const outputTokens = parseInt(match[2].replace(/,/g, ""), 10);
          if (!isNaN(inputTokens)) {
            this.tokenUsage.inputTokens += inputTokens;
          }
          if (!isNaN(outputTokens)) {
            this.tokenUsage.outputTokens += outputTokens;
          }
        } else if (match[1]) {
          // Single total or we need to determine context
          const tokens = parseInt(match[1].replace(/,/g, ""), 10);
          if (!isNaN(tokens)) {
            // Check context to determine if this is input, output, cache, or total
            if (lowerContent.includes("input") || lowerContent.includes("prompt")) {
              this.tokenUsage.inputTokens += tokens;
            } else if (lowerContent.includes("output") || lowerContent.includes("completion")) {
              this.tokenUsage.outputTokens += tokens;
            } else if (lowerContent.includes("cache read")) {
              this.tokenUsage.cacheReadTokens += tokens;
            } else if (lowerContent.includes("cache write")) {
              this.tokenUsage.cacheWriteTokens += tokens;
            } else if (lowerContent.includes("total")) {
              // If we get a total and have no other info, estimate 80% input, 20% output
              if (this.tokenUsage.inputTokens === 0 && this.tokenUsage.outputTokens === 0) {
                this.tokenUsage.inputTokens = Math.floor(tokens * 0.8);
                this.tokenUsage.outputTokens = Math.floor(tokens * 0.2);
              }
            }
          }
        }
        break; // Only match once per line
      }
    }

    // Update total tokens and timestamp
    this.tokenUsage.totalTokens = this.tokenUsage.inputTokens + this.tokenUsage.outputTokens;
    this.tokenUsage.updatedAt = this.lastActivityAt;
  }

  // Calculate cost from token usage
  private calculateCost(): CostTracking {
    const model = this.detectedModel || "default";
    const pricing = MODEL_PRICING[model] || MODEL_PRICING["default"];

    // Calculate cost in USD (pricing is per million tokens)
    const inputCost = (this.tokenUsage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (this.tokenUsage.outputTokens / 1_000_000) * pricing.output;
    const cacheReadCost = (this.tokenUsage.cacheReadTokens / 1_000_000) * pricing.cacheRead;
    const cacheWriteCost = (this.tokenUsage.cacheWriteTokens / 1_000_000) * pricing.cacheWrite;

    const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

    return {
      model: this.detectedModel,
      tokenUsage: { ...this.tokenUsage },
      estimatedCostUsd: Math.round(totalCost * 1000) / 1000, // Round to 3 decimal places
      isEstimate: true, // Always an estimate since we're parsing output
    };
  }

  // Get the current state
  getState(): LaneOutputState {
    return {
      laneId: this.laneId,
      lines: [...this.lines],
      totalLines: this.totalLines,
      lastProgress: this.lastProgress,
      errors: [...this.errors],
      warnings: [...this.warnings],
      startedAt: this.startedAt,
      lastActivityAt: this.lastActivityAt,
      tokenUsage: { ...this.tokenUsage },
      costTracking: this.calculateCost(),
    };
  }

  // Get only recent lines (for API response)
  getRecentLines(count: number = 100): OutputLine[] {
    return this.lines.slice(-count);
  }

  // Clear the buffer
  clear(): void {
    this.lines = [];
    this.totalLines = 0;
    this.lastProgress = undefined;
    this.errors = [];
    this.warnings = [];
    this.lastActivityAt = new Date().toISOString();
    // Reset token usage
    this.tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      updatedAt: this.lastActivityAt,
    };
    this.detectedModel = undefined;
  }

  // Get cost tracking data
  getCostTracking(): CostTracking {
    return this.calculateCost();
  }
}

// Main output buffer manager (singleton)
class OutputBufferManager {
  private static instance: OutputBufferManager | null = null;
  private buffers: Map<string, Map<string, LaneOutputBuffer>> = new Map(); // runSlug -> laneId -> buffer

  private constructor() {}

  // Get singleton instance
  public static getInstance(): OutputBufferManager {
    if (!OutputBufferManager.instance) {
      OutputBufferManager.instance = new OutputBufferManager();
    }
    return OutputBufferManager.instance;
  }

  // Get or create buffer for a lane
  getBuffer(runSlug: string, laneId: string): LaneOutputBuffer {
    if (!this.buffers.has(runSlug)) {
      this.buffers.set(runSlug, new Map());
    }
    const runBuffers = this.buffers.get(runSlug)!;

    if (!runBuffers.has(laneId)) {
      runBuffers.set(laneId, new LaneOutputBuffer(laneId));
    }

    return runBuffers.get(laneId)!;
  }

  // Add output line for a lane
  addLine(runSlug: string, laneId: string, content: string, stream: "stdout" | "stderr"): void {
    const buffer = this.getBuffer(runSlug, laneId);
    buffer.addLine(content, stream);
  }

  // Get output state for a lane
  getLaneOutput(runSlug: string, laneId: string): LaneOutputState | null {
    const runBuffers = this.buffers.get(runSlug);
    if (!runBuffers) return null;

    const buffer = runBuffers.get(laneId);
    if (!buffer) return null;

    return buffer.getState();
  }

  // Get recent lines for a lane
  getRecentLines(runSlug: string, laneId: string, count: number = 100): OutputLine[] {
    const runBuffers = this.buffers.get(runSlug);
    if (!runBuffers) return [];

    const buffer = runBuffers.get(laneId);
    if (!buffer) return [];

    return buffer.getRecentLines(count);
  }

  // Get all lane outputs for a run
  getRunOutputs(runSlug: string): Record<string, LaneOutputState> {
    const runBuffers = this.buffers.get(runSlug);
    if (!runBuffers) return {};

    const result: Record<string, LaneOutputState> = {};
    for (const [laneId, buffer] of runBuffers) {
      result[laneId] = buffer.getState();
    }
    return result;
  }

  // Clear buffer for a lane
  clearLaneBuffer(runSlug: string, laneId: string): void {
    const runBuffers = this.buffers.get(runSlug);
    if (runBuffers) {
      runBuffers.delete(laneId);
    }
  }

  // Clear all buffers for a run
  clearRunBuffers(runSlug: string): void {
    this.buffers.delete(runSlug);
  }

  // Check if lane has any errors
  hasErrors(runSlug: string, laneId: string): boolean {
    const output = this.getLaneOutput(runSlug, laneId);
    return output !== null && output.errors.length > 0;
  }

  // Get recent errors for a lane
  getRecentErrors(runSlug: string, laneId: string): DetectedError[] {
    const output = this.getLaneOutput(runSlug, laneId);
    return output?.errors ?? [];
  }

  // Get cost tracking for a lane
  getLaneCostTracking(runSlug: string, laneId: string): CostTracking | null {
    const runBuffers = this.buffers.get(runSlug);
    if (!runBuffers) return null;

    const buffer = runBuffers.get(laneId);
    if (!buffer) return null;

    return buffer.getCostTracking();
  }

  // Get total cost tracking for a run (sum of all lanes)
  getRunCostTracking(runSlug: string): { totalCostUsd: number; laneCosts: Record<string, CostTracking> } {
    const runBuffers = this.buffers.get(runSlug);
    if (!runBuffers) {
      return { totalCostUsd: 0, laneCosts: {} };
    }

    const laneCosts: Record<string, CostTracking> = {};
    let totalCostUsd = 0;

    for (const [laneId, buffer] of runBuffers) {
      const cost = buffer.getCostTracking();
      laneCosts[laneId] = cost;
      totalCostUsd += cost.estimatedCostUsd;
    }

    return {
      totalCostUsd: Math.round(totalCostUsd * 1000) / 1000,
      laneCosts,
    };
  }
}

// Export singleton getter
export function getOutputBufferManager(): OutputBufferManager {
  return OutputBufferManager.getInstance();
}

// Convenience functions
export function addOutputLine(
  runSlug: string,
  laneId: string,
  content: string,
  stream: "stdout" | "stderr"
): void {
  getOutputBufferManager().addLine(runSlug, laneId, content, stream);
}

export function getLaneOutput(runSlug: string, laneId: string): LaneOutputState | null {
  return getOutputBufferManager().getLaneOutput(runSlug, laneId);
}

export function getRecentOutput(runSlug: string, laneId: string, count?: number): OutputLine[] {
  return getOutputBufferManager().getRecentLines(runSlug, laneId, count);
}

export function getRunOutputs(runSlug: string): Record<string, LaneOutputState> {
  return getOutputBufferManager().getRunOutputs(runSlug);
}

export function clearLaneOutput(runSlug: string, laneId: string): void {
  getOutputBufferManager().clearLaneBuffer(runSlug, laneId);
}

export function clearRunOutputs(runSlug: string): void {
  getOutputBufferManager().clearRunBuffers(runSlug);
}

export function hasLaneErrors(runSlug: string, laneId: string): boolean {
  return getOutputBufferManager().hasErrors(runSlug, laneId);
}

export function getLaneErrors(runSlug: string, laneId: string): DetectedError[] {
  return getOutputBufferManager().getRecentErrors(runSlug, laneId);
}

export function getLaneCostTracking(runSlug: string, laneId: string): CostTracking | null {
  return getOutputBufferManager().getLaneCostTracking(runSlug, laneId);
}

export function getRunCostTracking(runSlug: string): { totalCostUsd: number; laneCosts: Record<string, CostTracking> } {
  return getOutputBufferManager().getRunCostTracking(runSlug);
}
