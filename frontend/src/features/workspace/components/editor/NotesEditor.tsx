// src/features/workspace/components/editor/NotesEditor.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { PlaylistHeadingAttributes } from "./PlaylistHeadingExtension";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { LinkExtension } from "./LinkExtension";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { TableKit } from "@tiptap/extension-table";
import { common, createLowlight } from "lowlight";
import { CustomImageNode } from "./ImageExtension";
import { TimestampNode } from "./TimestampExtension";
import { EditorIndentExtension, CODE_INDENT_SIZE } from "./EditorIndentExtension";
import { EditorToolbar } from "./EditorToolbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ShortcutsModal } from "@/features/workspace/components/shortcuts/ShortcutsModal";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useWorkspaceShortcuts } from "../../hooks/useWorkspaceShortcuts";
import { type SaveStatus } from "../../hooks/useIndexedDBSave";
import { useEditorPersistence } from "../../hooks/useEditorPersistence";
import { notify } from "@/lib/toast";
import type { EditorDisplayMode } from "./editorFormatting";

const lowlight = createLowlight(common);

interface NotesEditorProps {
  onContentChange?: (html: string) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
  editorRef?: React.Ref<HTMLDivElement>;
  displayMode?: EditorDisplayMode;
  onDisplayModeChange?: (mode: EditorDisplayMode) => void;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({
  onContentChange,
  onSaveStatusChange,
  editorRef,
  displayMode = "normal",
  onDisplayModeChange,
}) => {
  const currentTime = useWorkspaceStore((state) => state.currentTime);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "javascript",
        enableTabIndentation: true,
        tabSize: CODE_INDENT_SIZE,
      }),
      TableKit.configure({
        table: {
          resizable: true,
          HTMLAttributes: { class: "timesync-table" },
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LinkExtension,
      CustomImageNode,
      TimestampNode,
      PlaylistHeadingAttributes,
      EditorIndentExtension,
    ],
    editorProps: {
      attributes: {
        "aria-label": "Notes content. Tab indents; Shift+Tab outdents. Escape releases editor focus.",
        class:
          "focus:outline-none outline-none border-0 focus:ring-0 prose prose-slate max-w-none text-sm min-h-[300px]",
      },
    },
    content: "<p>Loading workspace contents...</p>",

  });

  const { clearDraft } = useEditorPersistence(editor, onContentChange, onSaveStatusChange);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleInsertTimestamp = useCallback(() => {
    if (!editor) return;
    const formatted = formatTime(currentTime);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "timestamp",
        attrs: { timestamp: formatted, seconds: Math.floor(currentTime) },
      })
      .run();
  }, [editor, currentTime, formatTime]);

  const { isHelpOpen, setIsHelpOpen } = useWorkspaceShortcuts({
    onInsertTimestamp: handleInsertTimestamp,
  });

  useEffect(() => {
    if (displayMode !== "maximized") return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('[role="dialog"], dialog'))) return;
      if (event.key === "Escape") onDisplayModeChange?.("normal");
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [displayMode, onDisplayModeChange]);

  const handleImageUpload = useCallback(
    (file: File) => {
      if (!editor) return;

      if (file.size > 5 * 1024 * 1024) {
        notify.error("File Too Large", "Images must be under 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: { src: reader.result },
            })
            .run();
          notify.success(
            "Image Inserted",
            "Image stored locally in IndexedDB.",
          );
        }
      };
      reader.readAsDataURL(file);
    },
    [editor],
  );

  const handleConfirmClearDraft = () => {
    if (!editor) return;
    setIsClearDialogOpen(false);
    void clearDraft();
  };

  return (
    <div
      className={`bg-white border border-slate-200 flex min-h-0 min-w-0 flex-col overflow-hidden shadow-xs focus-within:ring-1 focus-within:ring-slate-300 transition-all ${
        displayMode === "maximized"
          ? "min-h-0 flex-1 rounded-2xl"
          : displayMode === "minimized"
            ? "h-auto rounded-xl"
            : "min-h-0 flex-1 rounded-2xl"
      }`}
      aria-label="Notes editor"
    >
      <EditorToolbar
        editor={editor}
        currentTime={currentTime}
        formatTime={formatTime}
        onInsertTimestamp={handleInsertTimestamp}
        onImageUpload={handleImageUpload}
        onRequestClear={() => setIsClearDialogOpen(true)}
        displayMode={displayMode}
      />

      {displayMode !== "minimized" && (
        <div
          ref={editorRef}
          style={{ position: "relative" }}
          className="min-h-0 flex-1 p-4 sm:p-6 overflow-y-auto outline-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror-focused]:outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-relaxed [&_code]:font-mono [&_code]:bg-slate-100 [&_code]:text-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_pre_code]:bg-transparent [&_pre_code]:text-slate-100 [&_pre_code]:p-0"
        >
          <EditorContent editor={editor} />
        </div>
      )}

      <ConfirmDialog
        isOpen={isClearDialogOpen}
        title="Delete Note Draft?"
        description="Clear this note draft and its saved edits from this device? Your imported transcript and video information will remain available."
        confirmText="Yes, Delete Draft"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmClearDraft}
        onCancel={() => setIsClearDialogOpen(false)}
      />
      
      <ShortcutsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
};
