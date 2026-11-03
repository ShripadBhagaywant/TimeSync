import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { sanitizeExportHtml } from "@/lib/noteHtml";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { notesApi } from "../api/notesApi";

const formatTimestamp = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const SharedNotePreviewPage: React.FC = () => {
  const { hashId } = useParams<{ hashId: string }>();

  const {
    data: note,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sharedNote", hashId],

    queryFn: () => notesApi.getSnapshot(hashId!),

    enabled: Boolean(hashId),

    retry: 1,
  });

  if (isLoading) {
    return <BrandLoader variant="page" size="lg" title="Loading snapshot" message="Preparing the shared note preview…" />;
  }

  if (error || !note) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />

          <h2 className="text-lg font-bold text-slate-900">
            Snapshot not found
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            This note may have expired or the link is invalid.
          </p>

          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl lg:text-2xl">
                {note.videoTitle || "Untitled video"}
              </h1>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                  Read-only snapshot
                </span>

                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Shared note
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-slate-800">
                  <Video className="h-3.5 w-3.5 text-amber-500" />
                  <span className="truncate">{note.videoId}</span>
                </span>

                {note.createdAt && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-slate-800">
                    <Clock3 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Created {formatTimestamp(note.createdAt)}</span>
                  </span>
                )}

                {note.expiresAt && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-slate-800">
                    <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
                    <span>Expires {formatTimestamp(note.expiresAt)}</span>
                  </span>
                )}

                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-slate-800 hover:bg-blue-100"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-blue-500" />
                  Back
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main
          className="shared-note-content rounded-xl border bg-white p-4 shadow-sm sm:p-6"
          dangerouslySetInnerHTML={{ __html: sanitizeExportHtml(note.noteContent) }}
        />
      </div>
    </div>
  );
};
