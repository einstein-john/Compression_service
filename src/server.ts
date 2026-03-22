import fs from "node:fs";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import cors from "cors";
import express from "express";
import multer from "multer";
import { compressFile } from "./compress";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors({ origin: true, credentials: true }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `compress-upload-${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/compress", upload.single("file"), async (req, res) => {
  const uploaded = req.file;
  if (!uploaded) {
    res.status(400).json({ error: 'No file uploaded. Use multipart field name "file".' });
    return;
  }

  const inputPath = uploaded.path;
  let outputPath: string | undefined;

  try {
    const result = await compressFile(inputPath);
    outputPath = result.outputPath;
    await fs.promises.unlink(inputPath).catch(() => {});

    const downloadName = path.basename(result.outputPath);
    res.setHeader("Content-Type", result.mimeType || "application/octet-stream");
    res.setHeader("X-Original-Size", String(result.originalSize));
    res.setHeader("X-Compressed-Size", String(result.compressedSize));
    res.setHeader("X-Strategy", result.strategy);
    res.setHeader("X-Duration-Ms", String(result.durationMs));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadName.replace(/"/g, "\\\"")}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );

    await pipeline(createReadStream(outputPath), res);
  } catch (error) {
    await fs.promises.unlink(inputPath).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.destroy();
    }
  } finally {
    if (outputPath) {
      await fs.promises.unlink(outputPath).catch(() => {});
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Compression API listening on 0.0.0.0:${PORT}`);
});
