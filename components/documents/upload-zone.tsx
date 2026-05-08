'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cancelActivityUpload, createActivityUploadRequest, finalizeActivityUpload, logClientUploadError } from "@/app/actions";
import { toast } from "sonner";
import { Upload } from "lucide-react";

interface UploadZoneProps {
  activities: { id: string; title: string }[];
}

export function UploadZone({ activities }: UploadZoneProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [activityId, setActivityId] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const encryption = "AES256";

  const uploadToPresignedUrlWithProgress = async (uploadUrl: string, file: File) => {
    const contentType = file.type || "application/octet-stream";
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.setRequestHeader("x-amz-server-side-encryption", encryption);
      xhr.timeout = 2 * 60 * 1000;

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const next = Math.max(0, Math.min(99, Math.round((evt.loaded / evt.total) * 99)));
        setProgress(next);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.ontimeout = () => reject(new Error("Timeout"));
      xhr.onabort = () => reject(new Error("Aborted"));
      xhr.send(file);
    });
  };

  const logUploadError = async (stage: string, data: Record<string, unknown>) => {
    try {
      const fd = new FormData();
      fd.append("activityId", activityId);
      fd.append("stage", stage);
      fd.append("extra", JSON.stringify(data));
      await logClientUploadError(fd);
    } catch {
      // ignore
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files || []));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !activityId) {
      toast.error("Por favor seleccione un archivo y una actividad");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setUploadIndex(0);

    try {
      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadIndex(i + 1);
        setProgress(0);

        let key = "";
        const requestFormData = new FormData();
        requestFormData.append("activityId", activityId);
        requestFormData.append("fileName", file.name);
        requestFormData.append("fileType", file.type || "application/octet-stream");
        requestFormData.append("fileSize", file.size.toString());

        const requestResult = await createActivityUploadRequest(requestFormData);
        if (!requestResult?.success || !requestResult.uploadUrl || !requestResult.key) {
          await logUploadError("prepare", {
            error: requestResult?.error || "Upload request failed",
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          });
          toast.error(requestResult?.error || `No se pudo preparar "${file.name}".`);
          continue;
        }

        key = requestResult.key;
        try {
          await uploadToPresignedUrlWithProgress(requestResult.uploadUrl, file);

          const finalizeFormData = new FormData();
          finalizeFormData.append("activityId", activityId);
          finalizeFormData.append("originalName", file.name);
          finalizeFormData.append("key", requestResult.key);
          finalizeFormData.append("fileSize", file.size.toString());

          const finalizeResult = await finalizeActivityUpload(finalizeFormData);
          if (!finalizeResult?.success) {
            await logUploadError("finalize", {
              error: finalizeResult?.error || "Finalize upload failed",
              key: requestResult.key,
              fileName: file.name,
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            });
            toast.error(finalizeResult?.error || `Error al registrar "${file.name}".`);
            continue;
          }
        } catch (error) {
          await logUploadError("exception", {
            message: error instanceof Error ? error.message : String(error),
            key,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          });
          toast.error(`Error al subir "${file.name}".`, {
            description: "Verifique su conexión y vuelva a intentar.",
          });
          if (key) {
            try {
              const fd = new FormData();
              fd.append("key", key);
              await cancelActivityUpload(fd);
            } catch {
            }
          }
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        setProgress(100);
        toast.success(successCount === 1 ? "Documento subido exitosamente" : "Documentos subidos exitosamente");
      }
      router.refresh();
      setFiles([]);
      setActivityId("");
      setProgress(0);
    } catch (error) {
      toast.error("Error al subir el documento.", {
        description: "Verifique su conexión y vuelva a intentar.",
      });
    } finally {
      setIsUploading(false);
      setUploadIndex(0);
    }
  };

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 bg-slate-50 text-center">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex justify-center">
          <div className="bg-blue-100 p-3 rounded-full">
            <Upload className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <h3 className="text-lg font-medium">Subir Documento</h3>
        
        <div className="space-y-4 text-left">
          <div className="space-y-2">
            <Label>Seleccionar Actividad</Label>
            <Select onValueChange={setActivityId} value={activityId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una actividad..." />
              </SelectTrigger>
              <SelectContent>
                {activities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Seleccionar Archivo</Label>
            <Input type="file" multiple onChange={handleFileChange} disabled={isUploading} />
          </div>

          {isUploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>
                  Subiendo...
                  {files.length > 1 ? ` (${uploadIndex}/${files.length})` : ""}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button 
            className="w-full" 
            onClick={handleUpload} 
            disabled={files.length === 0 || !activityId || isUploading}
          >
            {isUploading ? "Subiendo..." : "Subir Documento"}
          </Button>
        </div>
      </div>
    </div>
  );
}
