import { useState, useRef } from "react";
import { Upload, Download, Music, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function AudioCompressor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [progress, setProgress] = useState(0);
  const [bitrate, setBitrate] = useState("128");
  const [format, setFormat] = useState("mp3");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef(new FFmpeg());

  const loadFFmpeg = async () => {
    const ffmpeg = ffmpegRef.current;
    
    try {
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      setFfmpegLoaded(true);
    } catch (error) {
      console.error("Error loading FFmpeg:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setSelectedFile(file);
      setOriginalSize(file.size);
      setCompressedBlob(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) {
      setSelectedFile(file);
      setOriginalSize(file.size);
      setCompressedBlob(null);
    }
  };

  const compressAudio = async () => {
    if (!selectedFile) return;

    if (!ffmpegLoaded) {
      await loadFFmpeg();
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("progress", ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });

      const inputName = "input.audio";
      const outputName = `output.${format}`;

      await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

      // Compress audio based on format
      if (format === "mp3") {
        await ffmpeg.exec([
          "-i", inputName,
          "-codec:a", "libmp3lame",
          "-b:a", `${bitrate}k`,
          outputName
        ]);
      } else if (format === "aac") {
        await ffmpeg.exec([
          "-i", inputName,
          "-codec:a", "aac",
          "-b:a", `${bitrate}k`,
          outputName
        ]);
      } else if (format === "ogg") {
        await ffmpeg.exec([
          "-i", inputName,
          "-codec:a", "libvorbis",
          "-b:a", `${bitrate}k`,
          outputName
        ]);
      }

      const data = await ffmpeg.readFile(outputName);
      const mimeType = format === "mp3" ? "audio/mpeg" : format === "aac" ? "audio/aac" : "audio/ogg";
      const blob = new Blob([data], { type: mimeType });
      
      setCompressedBlob(blob);
      setCompressedSize(blob.size);
      setProgress(100);
    } catch (error) {
      console.error("Error compressing audio:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCompressed = () => {
    if (!compressedBlob) return;

    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedFile?.name.split(".")[0] || "audio"}_compressed.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const compressionPercent = originalSize > 0 && compressedSize > 0
    ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">First-time setup</p>
          <p>Audio compression requires downloading FFmpeg (about 32MB). This happens once and may take a moment.</p>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <Music className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drop an audio file here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supports: MP3, WAV, AAC, OGG, FLAC, and more
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {selectedFile && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                Original size: {formatFileSize(originalSize)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedFile && (
              <div>
                <p className="text-sm font-medium mb-2">Original Audio</p>
                <audio
                  src={URL.createObjectURL(selectedFile)}
                  controls
                  className="w-full"
                />
              </div>
            )}
            {compressedBlob && (
              <div>
                <p className="text-sm font-medium mb-2">Compressed Audio</p>
                <audio
                  src={URL.createObjectURL(compressedBlob)}
                  controls
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Output Format</label>
              <Select value={format} onValueChange={setFormat} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="aac">AAC</SelectItem>
                  <SelectItem value="ogg">OGG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bitrate (kbps)</label>
              <Select value={bitrate} onValueChange={setBitrate} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="64">64 kbps (Low quality)</SelectItem>
                  <SelectItem value="128">128 kbps (Standard)</SelectItem>
                  <SelectItem value="192">192 kbps (Good quality)</SelectItem>
                  <SelectItem value="256">256 kbps (High quality)</SelectItem>
                  <SelectItem value="320">320 kbps (Maximum quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={compressAudio}
              disabled={isProcessing}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isProcessing ? "Compressing..." : "Compress Audio"}
            </Button>
            
            {compressedBlob && (
              <Button
                onClick={downloadCompressed}
                variant="outline"
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            )}
          </div>

          {compressedSize > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Original</p>
                  <p className="font-medium">{formatFileSize(originalSize)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Compressed</p>
                  <p className="font-medium">{formatFileSize(compressedSize)}</p>
                </div>
              </div>
              <div className="mt-2 text-center">
                <p className="text-sm font-medium text-green-600">
                  Reduced by {compressionPercent}%
                </p>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
