import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { sanitizeExportHtml } from "@/lib/noteHtml";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { notify } from "@/lib/toast";
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
  const navigate = useNavigate();

  const handleBackHome = () => {
    notify.info("Returning home", "This shared note is read-only.");
    navigate("/");
  };

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

          <button
            type="button"
            onClick={handleBackHome}
              className="mt-5 inline-flex min-h-9 items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <header className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex min-h-6 items-center rounded-lg border border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold text-blue-700">
                  Read-only snapshot
                </span>
                <span className="inline-flex min-h-6 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-600">
                  Shared note
                </span>
              </div>
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {note.videoTitle || "Untitled video"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                <span className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-lg bg-amber-50 px-2">
                  <Video className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate">{note.videoId}</span>
                </span>
                {note.createdAt && (
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-emerald-50 px-2">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>Created {formatTimestamp(note.createdAt)}</span>
                  </span>
                )}
                {note.expiresAt && (
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-red-50 px-2">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span>Expires {formatTimestamp(note.expiresAt)}</span>
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleBackHome}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:self-center"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Home
            </button>
          </div>
        </header>

        <main
          className="shared-note-content rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          dangerouslySetInnerHTML={{ __html: sanitizeExportHtml(note.noteContent) }}
        />
      </div>
    </div>
  );
};
