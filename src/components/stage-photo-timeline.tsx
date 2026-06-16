"use client";
import { useEffect, useState, useCallback } from "react";
import { getStagePhotos } from "@/lib/data";
import type { ProjectFile, ProjectStage } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, X } from "lucide-react";

/** Client-facing gallery of progress photos, grouped by stage. */
export function StagePhotoTimeline({ projectId, stages }: { projectId: string; stages: ProjectStage[] }) {
  const [photos, setPhotos] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPhotos(await getStagePhotos(projectId));
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading || photos.length === 0) return null;

  const stageName = (id: string | null | undefined) => stages.find((s) => s.id === id)?.name || "Progress";
  const byStage = new Map<string, ProjectFile[]>();
  for (const p of photos) {
    const key = p.stage_id || "other";
    if (!byStage.has(key)) byStage.set(key, []);
    byStage.get(key)!.push(p);
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-4 pb-4">
        <p className="text-sm font-medium flex items-center gap-2 mb-3"><Camera className="h-4 w-4 text-primary" /> Progress photos</p>
        <div className="space-y-4">
          {[...byStage.entries()].map(([stageId, group]) => (
            <div key={stageId}>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{stageName(stageId)}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {group.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.file_url}
                    alt={`${stageName(stageId)} progress`}
                    className="aspect-square w-full rounded-md object-cover border cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightbox(p.file_url)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}><X className="h-6 w-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Progress" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        </div>
      )}
    </Card>
  );
}
