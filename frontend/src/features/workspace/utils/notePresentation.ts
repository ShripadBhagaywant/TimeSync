import type { CleaningStage } from "@/features/extraction/types/extraction.types";

const STAGE_LABELS: Record<CleaningStage, string> = {
  RAW_TRANSCRIPT: "Transcript ready",
  REGEX_SANITIZED: "Transcript cleaned",
  GEMINI_AI_REFINED: "AI refined",
  FALLBACK_REGEX: "Basic cleanup",
  GEMINI_METADATA_GENERATED: "Metadata note refined",
  METADATA_FALLBACK: "Metadata note ready",
};

export const getPreparationLabel = (stage?: CleaningStage) =>
  stage ? STAGE_LABELS[stage] : "Note ready";
