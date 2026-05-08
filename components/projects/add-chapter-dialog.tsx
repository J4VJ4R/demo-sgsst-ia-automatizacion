"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { addChapterActivities } from "@/app/actions/chapter-actions";

interface AddChapterDialogProps {
  projectId: string;
  currentChapter?: string | null;
}

export function AddChapterDialog({
  projectId,
  currentChapter = "0",
}: AddChapterDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [isAddingChapter, startTransition] = useTransition();
  const router = useRouter();

  const currentChapterNum = parseInt(currentChapter || "0", 10);
  
  // If already max chapter (3), don't show the button or disable it?
  // Let's hide it if maxed out or show disabled.
  const isMaxChapter = currentChapterNum >= 3;

  if (isMaxChapter) return null;

  const handleAddChapter = async () => {
    if (!selectedChapter) return;
    
    const promise = new Promise(async (resolve, reject) => {
        const result = await addChapterActivities(projectId, selectedChapter);
        if (result.success) resolve(result);
        else reject(new Error(result.error));
    });

    toast.promise(promise, {
        loading: 'Agregando actividades del capítulo...',
        success: () => {
            setOpen(false);
            setSelectedChapter("");
            router.refresh();
            return 'Actividades agregadas correctamente';
        },
        error: (err) => {
            return err.message || 'Error al agregar capítulo';
        }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 gap-2 sm:w-auto"
        >
          <Layers className="h-4 w-4" />
          Agregar Capítulo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-blue-700">
            Agregar Capítulo (Lote)
          </DialogTitle>
          <DialogDescription>
            Agrega todas las actividades de un capítulo al proyecto. Esta acción es acumulativa.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex gap-2">
                    <Select 
                        value={selectedChapter} 
                        onValueChange={setSelectedChapter}
                        disabled={isAddingChapter}
                    >
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Seleccione un capítulo..." />
                        </SelectTrigger>
                        <SelectContent>
                            {currentChapterNum < 2 && (
                                <SelectItem value="2">Capítulo 2 (Agregar 17 actividades)</SelectItem>
                            )}
                            {currentChapterNum < 3 && (
                                <SelectItem value="3">Capítulo 3 (Agregar 38 actividades)</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <p className="mt-4 text-xs text-blue-600">
                    * Esta acción agregará múltiples actividades y no se puede deshacer.
                </p>
            </div>
        </div>
        
        <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button 
                onClick={handleAddChapter}
                disabled={!selectedChapter || isAddingChapter}
                className="bg-blue-600 text-white hover:bg-blue-700"
            >
                Agregar Capítulo
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
