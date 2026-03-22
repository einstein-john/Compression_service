import { useState, useRef } from "react";
import { Upload, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";

export function ImageCompressor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [quality, setQuality] = useState([0.8]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
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
    if (file && file.type.startsWith("image/")) {
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

  const compressImage = async () => {
    if (!selectedFile || !preview) return;

    setIsProcessing(true);

    try {
      const img = new Image();
      img.src = preview;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            setCompressedBlob(blob);
            setCompressedSize(blob.size);
          }
          setIsProcessing(false);
        },
        "image/webp",
        quality[0]
      );
    } catch (error) {
      console.error("Error compressing image:", error);
      setIsProcessing(false);
    }
  };

  const downloadCompressed = () => {
    if (!compressedBlob) return;

    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedFile?.name.split(".")[0] || "image"}.webp`;
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
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drop an image here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supports: JPG, PNG, GIF, BMP → WebP
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
                <img
                  src={preview}
                  alt="Original"
                  className="w-full h-auto rounded border"
                />
              </div>
              {compressedBlob && (
                <div>
                  <p className="text-sm font-medium mb-2">Compressed (WebP)</p>
                  <img
                    src={URL.createObjectURL(compressedBlob)}
                    alt="Compressed"
                    className="w-full h-auto rounded border"
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Quality: {Math.round(quality[0] * 100)}%</label>
            </div>
            <Slider
              value={quality}
              onValueChange={setQuality}
              min={0.1}
              max={1}
              step={0.05}
              disabled={isProcessing}
            />
          </div>

          {isProcessing && (
            <Progress value={50} className="w-full" />
          )}

          <div className="flex gap-2">
            <Button
              onClick={compressImage}
              disabled={isProcessing}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Convert to WebP
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
