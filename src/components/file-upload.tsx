"use client";
import { useState, useRef, useCallback } from "react";
import { uploadFile, deleteFileRecord } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import type { ProjectFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, File, Trash2, Download, Loader2, FileText, Image, FileArchive } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (contentType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (contentType.includes("zip") || contentType.includes("archive")) return <FileArchive className="h-4 w-4 text-yellow-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

interface FileUploadProps {
  projectId: string;
  files: ProjectFile[];
  onFilesChange: (files: ProjectFile[]) => void;
  readOnly?: boolean;
  canDelete?: boolean;
}

export function FileUpload({ projectId, files, onFilesChange, readOnly = false, canDelete = false }: FileUploadProps) {
  const { userId } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !userId) return;
    const file = fileList[0];
    if (file.size > MAX_FILE_SIZE) { toast.error("File too large. Max 10MB."); return; }
    setUploading(true);
    try {
      const uploaded = await uploadFile(projectId, file, userId);
      onFilesChange([uploaded, ...files]);
      toast.success(`Uploaded ${file.name}`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [projectId, userId, files, onFilesChange]);

  const handleDelete = async (file: ProjectFile) => {
    try {
      await deleteFileRecord(file.id);
      onFilesChange(files.filter((f) => f.id !== file.id));
      toast.success(`Deleted ${file.file_name}`);
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <File className="h-4 w-4" /> Files
          {files.length > 0 && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{files.length}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!readOnly && (
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Drop a file here or <span className="text-primary underline">browse</span></span>
                <span className="text-xs text-muted-foreground">Max 10MB</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
          </div>
        )}
        {files.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No files uploaded yet.</p>}
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors">
            {getFileIcon(file.content_type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.file_name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(file.file_url, "_blank")} title="Download">
                <Download className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(file)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
