import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { logger } from "../utils/logger";

import type { StrategyResult } from "./image.strategy";

export async function compressVideo(
  inputPath: string,
  outputDir: string,
  originalSize: number
): Promise<StrategyResult> {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "video-compress-")
  );
  const tmpOutput = path.join(tmpDir, `${baseName}.mp4`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-crf 28",
        "-preset medium",
        "-movflags +faststart",
        "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2",
      ])
      .on("progress", (progress) => {
        if (typeof progress.percent === "number") {
          logger.info(`ffmpeg progress for ${path.basename(inputPath)}: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on("error", (err) => {
        reject(err);
      })
      .on("end", () => {
        resolve();
      })
      .save(tmpOutput);
  });

  const outputPath = path.join(outputDir, `${baseName}.mp4`);

  const outStat = await fs.promises.stat(tmpOutput);

  if (outStat.size >= originalSize) {
    await fs.promises.copyFile(inputPath, outputPath);
    return { outputPath, compressedSize: originalSize };
  }

  await fs.promises.copyFile(tmpOutput, outputPath);

  try {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  return { outputPath, compressedSize: outStat.size };
}

