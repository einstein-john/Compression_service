import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Download, File, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

interface FileInfo {
  name: string;
  size: number;
  type: string;
  file: File;
}

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  blob: Blob;
  filename: string;
  strategy: string;
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(disposition);
  if (quoted) return quoted[1];
  const loose = /filename=([^;]+)/i.exec(disposition);
  return loose ? loose[1].trim().replace(/^["']|["']$/g, '') : null;
}

function parseXhrHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  raw
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      const i = line.indexOf(':');
      if (i < 0) return;
      const k = line.slice(0, i).trim().toLowerCase();
      const v = line.slice(i + 1).trim();
      out[k] = v;
    });
  return out;
}

function postCompress(
  file: File,
  onUploadProgress: (percent: number) => void
): Promise<{
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
  strategy: string;
}> {
  const url = `${apiBase.replace(/\/$/, '')}/api/compress`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'blob';

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && e.total > 0) {
        onUploadProgress(Math.min(48, (e.loaded / e.total) * 48));
      }
    });

    xhr.addEventListener('load', () => {
      void (async () => {
        const blob = xhr.response as Blob;
        const h = parseXhrHeaders(xhr.getAllResponseHeaders());
        if (xhr.status >= 200 && xhr.status < 300) {
          const filename =
            parseFilename(h['content-disposition'] ?? null) ?? 'compressed';
          const originalSize = parseInt(h['x-original-size'] || '0', 10);
          const compressedSize = parseInt(
            h['x-compressed-size'] || String(blob.size),
            10
          );
          const strategy = h['x-strategy'] || 'unknown';
          resolve({ blob, filename, originalSize, compressedSize, strategy });
          return;
        }
        let msg = xhr.statusText || 'Compression failed';
        try {
          const t = await blob.text();
          const j = JSON.parse(t) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      })();
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Aborted')));

    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

export function FileCompressor() {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFile = useCallback((file: File) => {
    setFileInfo({
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
    });
    setResult(null);
    setProgress(0);
    setError(null);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const runCompress = async () => {
    if (!fileInfo) return;

    setCompressing(true);
    setProgress(5);
    setError(null);

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => (p < 92 ? Math.min(p + 2, 92) : p));
    }, 350);

    try {
      const data = await postCompress(fileInfo.file, (uploadPct) => {
        setProgress((p) => Math.max(p, 5 + uploadPct));
      });

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      const orig = data.originalSize || fileInfo.size;
      const comp = data.compressedSize;
      const compressionRatio =
        orig > 0 ? Math.max(0, (1 - comp / orig) * 100) : 0;

      setResult({
        originalSize: orig,
        compressedSize: comp,
        compressionRatio,
        blob: data.blob,
        filename: data.filename,
        strategy: data.strategy,
      });
      setProgress(100);
    } catch (err) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      const message =
        err instanceof Error ? err.message : 'Failed to compress file.';
      setError(message);
      setProgress(0);
    } finally {
      setCompressing(false);
    }
  };

  const downloadCompressed = () => {
    if (!result) return;

    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFileInfo(null);
    setResult(null);
    setProgress(0);
    setCompressing(false);
    setError(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl">File Compressor</h1>
        <p className="text-muted-foreground">
          Images, PDFs, video, and Office documents are compressed on the server
          using this project&apos;s compression pipeline
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!fileInfo ? (
        <Card className={`border-2 border-dashed transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}>
          <CardContent className="p-12">
            <div
              className="flex flex-col items-center justify-center space-y-4 text-center"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="rounded-full bg-primary/10 p-6">
                <Upload className="size-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl">Drop your file here</h3>
                <p className="text-sm text-muted-foreground">
                  or click to browse from your computer
                </p>
              </div>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileInput}
              />
              <Button asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  Select File
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <File className="size-5" />
                File Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">File Name</span>
                  <span className="text-sm font-medium">{fileInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">File Size</span>
                  <span className="text-sm font-medium">{formatBytes(fileInfo.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">File Type</span>
                  <span className="text-sm font-medium">{fileInfo.type || 'Unknown'}</span>
                </div>
              </div>

              {!result && !compressing && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={runCompress} className="flex-1">
                    Compress File
                  </Button>
                  <Button onClick={reset} variant="outline">
                    Cancel
                  </Button>
                </div>
              )}

              {compressing && (
                <div className="space-y-2 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Compressing...</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} />
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                    <Loader2 className="size-4 animate-spin" />
                    Uploading and processing on the server...
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="size-5" />
                  Compression Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Strategy</span>
                    <span className="text-sm font-medium capitalize">{result.strategy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Original Size</span>
                    <span className="text-sm font-medium">
                      {formatBytes(result.originalSize)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Compressed Size</span>
                    <span className="text-sm font-medium">
                      {formatBytes(result.compressedSize)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Space Saved</span>
                    <span className="text-sm font-medium text-green-600">
                      {result.compressionRatio.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={downloadCompressed} className="flex-1 gap-2">
                    <Download className="size-4" />
                    Download compressed file
                  </Button>
                  <Button onClick={reset} variant="outline">
                    Compress Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
