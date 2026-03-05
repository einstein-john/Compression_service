#!/usr/bin/env node
import { compressFile } from "./compress";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    logger.error("No input files provided.\nUsage: npx ts-node src/index.ts <file1> [file2 ...]");
    process.exitCode = 1;
    return;
  }

  const failures: { path: string; error: string }[] = [];

  for (const filePath of args) {
    try {
      await compressFile(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process ${filePath}: ${message}`);
      failures.push({ path: filePath, error: message });
    }
  }

  if (failures.length > 0) {
    logger.error(
      `Completed with ${failures.length} failure(s): ${failures
        .map((f) => `${f.path} (${f.error})`)
        .join(", ")}`
    );
    process.exitCode = 1;
  }
}

void main();

