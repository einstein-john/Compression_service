import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { StrategyResult } from "./image.strategy";

const execFileAsync = promisify(execFile);

export async function compressPdf(
  inputPath: string,
  outputDir: string,
  originalSize: number
): Promise<StrategyResult> {
  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "pdf-compress-")
  );

  const inPath = path.join(tmpDir, "pdf-in.pdf");
  const outPath = path.join(tmpDir, "pdf-out.pdf");

  await fs.promises.copyFile(inputPath, inPath);

  try {
    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.6",
      "-dPDFSETTINGS=/prepress",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outPath}`,
      inPath,
    ];

    await execFileAsync("gs", args);

    const baseName = path.basename(inputPath);
    const outputPath = path.join(outputDir, baseName);

    const outStat = await fs.promises.stat(outPath);

    if (outStat.size >= originalSize) {
      await fs.promises.copyFile(inputPath, outputPath);
      return { outputPath, compressedSize: originalSize };
    }

    await fs.promises.copyFile(outPath, outputPath);
    return { outputPath, compressedSize: outStat.size };
  } finally {
    // Cleanup temp files
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

