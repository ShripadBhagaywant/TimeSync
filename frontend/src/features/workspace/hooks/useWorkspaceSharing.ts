import { useRef, useState, type RefObject } from "react";
import type { TranscriptResponse } from "@/features/extraction/types/extraction.types";
import { notesApi } from "@/features/notes/api/notesApi";
import { notify } from "@/lib/toast";
import { notifyApiError } from "@/lib/apiErrorNotifications";

interface Options {
  activeVideo: TranscriptResponse | null;
  currentTitle: string;
  content: string;
  editorRef: RefObject<HTMLDivElement | null>;
}
export function useWorkspaceSharing({ activeVideo, currentTitle, content, editorRef }: Options) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const pendingRef = useRef(false);
  const handleShareWorkspace = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify.success(
        "Workspace link copied",
        "This link returns to the workspace route. Use Snapshot for a read-only copy of the notes.",
      );
    } catch {
      notify.error(
        "Copy failed",
        "Unable to copy the workspace link. Copy it from the address bar.",
      );
    }
  };

  const handleSnapshot = async () => {
    if (pendingRef.current) return;
    if (!activeVideo) {
      notify.error(
        "Snapshot unavailable",
        "Load a workspace before creating a snapshot.",
      );
      return;
    }

    const noteContent = (
      content ||
      editorRef.current?.innerHTML ||
      ""
    ).trim();
    const visibleText = noteContent
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim();
    const hasVisualContent = /<(img|table)\b/i.test(noteContent);
    if (!visibleText && !hasVisualContent) {
      notify.error(
        "Empty notes",
        "Write a few notes before creating a snapshot.",
      );
      return;
    }

    pendingRef.current = true;
    setIsSharing(true);
    try {
      const response = await notesApi.createSnapshot({
        videoId: activeVideo.videoId,
        videoTitle: currentTitle,
        noteContent,
        cleaningStage: activeVideo.cleaningStage,
      });

      const createdUrl = response.shareUrl
        ? new URL(response.shareUrl, window.location.origin).toString()
        : `${window.location.origin}/notes/${response.hashId}`;
      setShareUrl(createdUrl);

      try {
        await navigator.clipboard.writeText(createdUrl);
        notify.success(
          "Shareable note created",
          "The read-only link was copied.",
        );
      } catch {
        notify.success(
          "Shareable note created",
          "Copy the link from the share dialog.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create a snapshot right now.";
      notifyApiError(error, "Share failed", message);
    } finally {
      pendingRef.current = false;
      setIsSharing(false);
    }
  };


  return { isSharing, shareUrl, closeShareDialog: () => setShareUrl(""), handleSnapshot, handleShareWorkspace };
}
