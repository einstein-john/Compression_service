import path from "node:path";

type LogLevel = "debug" | "info" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  error: 30,
};

function getEnvLogLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "error") {
    return raw;
  }
  return "info";
}

let currentLevel: LogLevel = getEnvLogLevel();

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export const logger = {
  debug(message: string): void {
    if (shouldLog("debug")) {
      // eslint-disable-next-line no-console
      console.debug(`[debug] ${message}`);
    }
  },
  info(message: string): void {
    if (shouldLog("info")) {
      // eslint-disable-next-line no-console
      console.log(`[info] ${message}`);
    }
  },
  error(message: string): void {
    if (shouldLog("error")) {
      // eslint-disable-next-line no-console
      console.error(`[error] ${message}`);
    }
  },
};

export interface ResourceUsage {
  cpuUserMs: number;
  cpuSystemMs: number;
  rssStartMB: number;
  rssEndMB: number;
  heapUsedStartMB: number;
  heapUsedEndMB: number;
}

export interface CompressionResult {
  outputPath: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
  strategy: "image" | "pdf" | "video" | "document" | "passthrough";
  durationMs: number;
  resourceUsage?: ResourceUsage;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)}${units[i]}`;
}

export function logCompressionSummary(result: CompressionResult): void {
  const originalName = path.basename(result.originalName);
  const outputName = path.basename(result.outputPath);
  const original = formatBytes(result.originalSize);
  const compressed = formatBytes(result.compressedSize);

  const reduction =
    result.originalSize > 0
      ? ((result.originalSize - result.compressedSize) /
          result.originalSize) *
        100
      : 0;

  const reductionText =
    reduction > 0
      ? `${reduction.toFixed(0)}% smaller`
      : reduction < 0
      ? `${Math.abs(reduction).toFixed(0)}% larger`
      : "no size change";

  const durationMs = result.durationMs.toFixed(0);

  let line = `[compress] ${originalName} -> ${outputName} | ${original} -> ${compressed} (${reductionText}) | ${durationMs}ms`;
  if (result.resourceUsage) {
    const r = result.resourceUsage;
    const cpuUserSec = (r.cpuUserMs / 1000).toFixed(1);
    const cpuSystemSec = (r.cpuSystemMs / 1000).toFixed(1);
    line += ` | CPU: ${cpuUserSec}s user, ${cpuSystemSec}s system`;
    line += ` | RSS: ${r.rssStartMB.toFixed(0)}MB → ${r.rssEndMB.toFixed(0)}MB`;
    line += ` | Heap: ${r.heapUsedStartMB.toFixed(0)}MB → ${r.heapUsedEndMB.toFixed(0)}MB`;
  }
  logger.info(line);
}
