import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { StrategyResult } from "./image.strategy";

const execAsync = promisify(exec);

export async function compressDocument(
  inputPath: string,
  outputDir: string,
  originalSize: number
): Promise<StrategyResult> {
  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "doc-compress-")
  );

  const ext = path.extname(inputPath) || ".docx";
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const recompressedPath = path.join(tmpDir, `output${ext}`);

  // Unzip and re-zip at level 9
  const unzipCmd = `unzip -q "${inputPath}" -d "${tmpDir}/unzipped"`;
  const zipCmd = `cd "${tmpDir}/unzipped" && zip -r -9 -q "${recompressedPath}" .`;

  try {
    await execAsync(unzipCmd);
    await execAsync(zipCmd);

    const outputPath = path.join(outputDir, `${baseName}${ext}`);

    const outStat = await fs.promises.stat(recompressedPath);

    if (outStat.size >= originalSize) {
      await fs.promises.copyFile(inputPath, outputPath);
      return { outputPath, compressedSize: originalSize };
    }

    await fs.promises.copyFile(recompressedPath, outputPath);
    return { outputPath, compressedSize: outStat.size };
  } finally {
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

