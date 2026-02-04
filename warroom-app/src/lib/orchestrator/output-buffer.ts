// OutputBuffer - Manages stdout/stderr capture for Claude Code processes
// Stores the last MAX_LINES lines per lane and parses output for progress/errors

const MAX_LINES = 1000;

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

  constructor(private laneId: string) {
    this.startedAt = new Date().toISOString();
    this.lastActivityAt = this.startedAt;
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
