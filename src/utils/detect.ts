import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";

export type DetectedCategory = "image" | "pdf" | "video" | "document" | "unknown";

export interface DetectedType {
  mimeType: string;
  extension: string | null;
  category: DetectedCategory;
}

function categorize(mimeType: string, ext: string | null): DetectedCategory {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (
    mimeType.startsWith("video/") ||
    ["mp4", "mov", "avi", "mkv", "webm"].includes((ext || "").toLowerCase())
  ) {
    return "video";
  }

  const lowerExt = (ext || "").toLowerCase();
  if (["docx", "xlsx", "pptx"].includes(lowerExt)) {
    return "document";
  }

  return "unknown";
}

export async function detectFileType(filePath: string): Promise<DetectedType> {
  const fd = await fs.promises.open(filePath, "r");
  try {
    const { size } = await fd.stat();
    const toRead = Math.min(size, 4100);
    const buffer = Buffer.alloc(toRead);
    await fd.read(buffer, 0, toRead, 0);

    const { fromBuffer } = await import("file-type");
    const ft = await fromBuffer(buffer);

    let mimeType: string | false | null = ft?.mime ?? null;
    let ext: string | null = ft?.ext ?? null;

    if (!mimeType) {
      const guessed = mime.lookup(filePath);
      mimeType = guessed || "application/octet-stream";
      const guessedExt = mime.extension(mimeType);
      ext = guessedExt || path.extname(filePath).replace(/^\./, "") || null;
    }

    if (!ext) {
      ext = path.extname(filePath).replace(/^\./, "") || null;
    }

    const category = categorize(String(mimeType), ext);

    return {
      mimeType: String(mimeType),
      extension: ext,
      category,
    };
  } finally {
    await fd.close();
  }
}

