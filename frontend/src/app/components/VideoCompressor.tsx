import { useState, useRef } from "react";
import { Upload, Download, Video, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function VideoCompressor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState("medium");
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
    if (file && file.type.startsWith("video/")) {
      setSelectedFile(file);
      setOriginalSize(file.size);
      setCompressedBlob(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setSelectedFile(file);
      setOriginalSize(file.size);
      setCompressedBlob(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const compressVideo = async () => {
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

      const inputName = "input.mp4";
      const outputName = "output.mp4";

      await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

      // Quality presets
      const qualitySettings: Record<string, string> = {
        low: "-crf 32 -preset fast",
        medium: "-crf 28 -preset medium",
        high: "-crf 23 -preset slow",
      };

      const settings = qualitySettings[quality] || qualitySettings.medium;

      await ffmpeg.exec([
        "-i", inputName,
        ...settings.split(" "),
        "-c:a", "aac",
        "-b:a", "128k",
        outputName
      ]);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: "video/mp4" });
      
      setCompressedBlob(blob);
      setCompressedSize(blob.size);
      setProgress(100);
    } catch (error) {
      console.error("Error compressing video:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCompressed = () => {
    if (!compressedBlob) return;

    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedFile?.name.split(".")[0] || "video"}_compressed.mp4`;
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
          <p>Video compression requires downloading FFmpeg (about 32MB). This happens once and may take a moment.</p>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drop a video here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supports: MP4, MOV, AVI, WebM, and more
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
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

          {preview && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Original</p>
                <video
                  src={preview}
                  controls
                  className="w-full rounded border"
                />
              </div>
              {compressedBlob && (
                <div>
                  <p className="text-sm font-medium mb-2">Compressed</p>
                  <video
                    src={URL.createObjectURL(compressedBlob)}
                    controls
                    className="w-full rounded border"
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Compression Quality</label>
            <Select value={quality} onValueChange={setQuality} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (Smallest file, lower quality)</SelectItem>
                <SelectItem value="medium">Medium (Balanced)</SelectItem>
                <SelectItem value="high">High (Better quality, larger file)</SelectItem>
              </SelectContent>
            </Select>
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
              onClick={compressVideo}
              disabled={isProcessing}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isProcessing ? "Compressing..." : "Compress Video"}
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
