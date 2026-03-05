import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { detectFileType } from "./utils/detect";
import {
  CompressionResult,
  logger,
  logCompressionSummary,
} from "./utils/logger";
import { compressImage } from "./strategies/image.strategy";
import { compressPdf } from "./strategies/pdf.strategy";
import { compressVideo } from "./strategies/video.strategy";
import { compressDocument } from "./strategies/document.strategy";

dotenv.config();

const REQUIRED_ENV = "OUTPUT_TEMP_DIR";

let hasGhostscript = false;
let hasFfmpeg = false;

function resolveBinary(binary: string): boolean {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "where" : "which";
  const result = spawnSync(cmd, [binary], { stdio: "ignore" });
  return result.status === 0;
}

function checkSystemBinaries(): void {
  hasGhostscript = resolveBinary("gs");
  hasFfmpeg = resolveBinary("ffmpeg");

  if (!hasGhostscript) {
    logger.info(
      "Ghostscript (gs) is not available. PDF compression strategy will be unavailable."
    );
  }

  if (!hasFfmpeg) {
    logger.info(
      "ffmpeg is not available. Video compression strategy will be unavailable."
    );
  }
}

function ensureOutputDir(): string {
  const dir = process.env[REQUIRED_ENV];
  if (!dir) {
    throw new Error("OUTPUT_TEMP_DIR is not set in .env");
  }

  const resolved = path.resolve(dir);

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  try {
    fs.accessSync(resolved, fs.constants.W_OK);
  } catch {
    throw new Error("OUTPUT_TEMP_DIR exists but is not writable");
  }

  return resolved;
}

checkSystemBinaries();
const OUTPUT_DIR = ensureOutputDir();

export { CompressionResult };

async function copyPassthrough(
  inputPath: string,
  outputDir: string
): Promise<string> {
  const baseName = path.basename(inputPath);
  const destination = path.join(outputDir, baseName);
  await fs.promises.copyFile(inputPath, destination);
  return destination;
}

const bytesToMB = (bytes: number): number => bytes / (1024 * 1024);

export async function compressFile(inputPath: string): Promise<CompressionResult> {
  const start = Date.now();
  const startCpu = process.cpuUsage();
  const startMem = process.memoryUsage();
  const absoluteInput = path.resolve(inputPath);

  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const stat = await fs.promises.stat(absoluteInput);
  const originalSize = stat.size;

  const detected = await detectFileType(absoluteInput);
  const strategy =
    detected.category === "image"
      ? "image"
      : detected.category === "pdf"
      ? "pdf"
      : detected.category === "video"
      ? "video"
      : detected.category === "document"
      ? "document"
      : "passthrough";

  let outputPath: string;
  let compressedSize: number;
  let finalStrategy: CompressionResult["strategy"] = strategy;

  try {
    switch (strategy) {
      case "image": {
        const { outputPath: outPath, compressedSize: size } =
          await compressImage(absoluteInput, OUTPUT_DIR, originalSize);
        outputPath = outPath;
        compressedSize = size;
        break;
      }
      case "pdf": {
        if (!hasGhostscript) {
          throw new Error("gs is not installed. Run: apt-get install ghostscript");
        }
        const { outputPath: outPath, compressedSize: size } =
          await compressPdf(absoluteInput, OUTPUT_DIR, originalSize);
        outputPath = outPath;
        compressedSize = size;
        break;
      }
      case "video": {
        if (!hasFfmpeg) {
          throw new Error("ffmpeg is not installed. Run: apt-get install ffmpeg");
        }
        const { outputPath: outPath, compressedSize: size } =
          await compressVideo(absoluteInput, OUTPUT_DIR, originalSize);
        outputPath = outPath;
        compressedSize = size;
        break;
      }
      case "document": {
        const { outputPath: outPath, compressedSize: size } =
          await compressDocument(absoluteInput, OUTPUT_DIR, originalSize);
        outputPath = outPath;
        compressedSize = size;
        break;
      }
      case "passthrough":
      default: {
        outputPath = await copyPassthrough(absoluteInput, OUTPUT_DIR);
        compressedSize = originalSize;
        finalStrategy = "passthrough";
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.startsWith("gs is not installed") ||
      message.startsWith("ffmpeg is not installed")
    ) {
      // Propagate missing binary errors as specified.
      throw error;
    }

    logger.error(
      `Compression failed for ${inputPath}: ${message}. Falling back to passthrough copy.`
    );

    outputPath = await copyPassthrough(absoluteInput, OUTPUT_DIR);
    compressedSize = originalSize;
    finalStrategy = "passthrough";
  } finally {
    // Cleanup any OS-specific temp files that may have been created
    // Strategies are responsible for their own detailed cleanup logic.
    void os.tmpdir();
  }

  const durationMs = Date.now() - start;
  const endCpu = process.cpuUsage(startCpu);
  const endMem = process.memoryUsage();

  const result: CompressionResult = {
    outputPath,
    originalName: absoluteInput,
    originalSize,
    compressedSize,
    mimeType: detected.mimeType,
    strategy: finalStrategy,
    durationMs,
    resourceUsage: {
      cpuUserMs: endCpu.user / 1000,
      cpuSystemMs: endCpu.system / 1000,
      rssStartMB: bytesToMB(startMem.rss),
      rssEndMB: bytesToMB(endMem.rss),
      heapUsedStartMB: bytesToMB(startMem.heapUsed),
      heapUsedEndMB: bytesToMB(endMem.heapUsed),
    },
  };

  logCompressionSummary(result);

  return result;
}

