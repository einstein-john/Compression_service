import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export interface StrategyResult {
  outputPath: string;
  compressedSize: number;
}

export async function compressImage(
  inputPath: string,
  outputDir: string,
  originalSize: number
): Promise<StrategyResult> {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${baseName}.webp`);

  const buffer = await sharp(inputPath)
    .rotate()
    .webp({ quality: 100, effort: 4, smartSubsample: true })
    .toBuffer();

  if (buffer.length >= originalSize) {
    await fs.promises.copyFile(inputPath, outputPath);
    return { outputPath, compressedSize: originalSize };
  }

  await fs.promises.writeFile(outputPath, buffer);
  return { outputPath, compressedSize: buffer.length };
}

