"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const TRAINING_FLAG_KEY = "sgsst_ai_model_trained";
const TRAINING_AT_KEY = "sgsst_ai_model_trained_at";

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("es-CO");
}

export function AiTrainingSettings() {
  const [isTraining, setIsTraining] = useState(false);
  const [trained, setTrained] = useState(false);
  const [trainedAt, setTrainedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTrained(window.localStorage.getItem(TRAINING_FLAG_KEY) === "1");
      setTrainedAt(window.localStorage.getItem(TRAINING_AT_KEY));
    } catch {
      setTrained(false);
      setTrainedAt(null);
    }
  }, []);

  const handleTrain = async () => {
    if (isTraining) return;
    setIsTraining(true);
    try {
      await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 2200));
      try {
        window.localStorage.setItem(TRAINING_FLAG_KEY, "1");
        window.localStorage.setItem(TRAINING_AT_KEY, new Date().toISOString());
      } catch {}
      setTrained(true);
      setTrainedAt(new Date().toISOString());
      toast.success("IA entrenada con datos históricos (simulación).");
    } catch {
      toast.error("No se pudo entrenar la IA (simulación).");
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-base">Capa de Inteligencia (Demo)</CardTitle>
        <div className="text-sm text-slate-600">
          Entrena la IA con datos históricos para actualizar los indicadores de riesgo (simulado).
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-sm text-slate-700">
          Estado del modelo:{" "}
          <span className="font-semibold text-slate-900">{trained ? "Entrenado" : "Demo"}</span>
          {trained ? (
            <span className="text-slate-600">
              {formatDate(trainedAt) ? ` · Última actualización: ${formatDate(trainedAt)}` : null}
            </span>
          ) : null}
        </div>
        <div>
          <Button
            type="button"
            onClick={handleTrain}
            disabled={isTraining}
            className="h-11 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {isTraining ? "Entrenando IA..." : "Entrenar IA con Datos Históricos"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

