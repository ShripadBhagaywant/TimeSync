// src/features/workspace/components/editor/EditorToolbar.tsx
import React, { useEffect, useRef, useState, memo } from "react";
import { Editor } from "@tiptap/react";
import {
  Clock,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Code,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  X,
  Pilcrow,
  ImageIcon,
  Highlighter,
  Trash2,
} from "lucide-react";
import { TableControls } from "./TableControls";
import { CodeLanguageSelect } from "./CodeLanguageSelect";
import type { EditorDisplayMode } from "./editorFormatting";
import { normalizeWebUrl } from "./LinkExtension";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

interface EditorToolbarProps {
  editor: Editor | null;
  currentTime: number;
  formatTime: (seconds: number) => string;
  onInsertTimestamp: () => void;
  onImageUpload: (file: File) => void;
  onRequestClear: () => void;
  displayMode: EditorDisplayMode;
}

const HIGHLIGHT_COLORS = [
  {
    color: "#fef08a",
    bgClass: "bg-yellow-200 border-yellow-300",
    title: "Yellow Highlight",
  },
  {
    color: "#bbf7d0",
    bgClass: "bg-green-200 border-green-300",
    title: "Green Highlight",
  },
  {
    color: "#bfdbfe",
    bgClass: "bg-blue-200 border-blue-300",
    title: "Blue Highlight",
  },
  {
    color: "#fecaca",
    bgClass: "bg-red-200 border-red-300",
    title: "Red Highlight",
  },
];

export const EditorToolbar: React.FC<EditorToolbarProps> = memo(
  ({
    editor,
    currentTime,
    formatTime,
    onInsertTimestamp,
    onImageUpload,
    onRequestClear,
    displayMode,
  }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toolbarFrameRef = useRef<number | null>(null);
    const [, setToolbarVersion] = useState(0);
    const linkSelectionRef = useRef<{ from: number; to: number } | null>(null);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [linkError, setLinkError] = useState("");
    const linkDialogRef = useDialogFocus<HTMLDivElement>(isLinkDialogOpen, () => setIsLinkDialogOpen(false));

    useEffect(() => {
      if (!editor) return;
      const refreshToolbar = () => {
        if (toolbarFrameRef.current !== null) return;
        toolbarFrameRef.current = window.requestAnimationFrame(() => {
          toolbarFrameRef.current = null;
          setToolbarVersion((version) => version + 1);
        });
      };
      editor.on("transaction", refreshToolbar);
      return () => {
        editor.off("transaction", refreshToolbar);
        if (toolbarFrameRef.current !== null) {
          window.cancelAnimationFrame(toolbarFrameRef.current);
          toolbarFrameRef.current = null;
        }
      };
    }, [editor]);

    if (!editor) return null;

    const handleToggleCodeBlock = () => {
      const chain = editor.chain().focus();
      if (editor.isActive("codeBlock")) {
        chain.setParagraph().run();
        return;
      }
      chain.toggleCodeBlock().run();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImageUpload(file);
        e.target.value = "";
      }
    };

    const handleAddLink = () => {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");
      const currentUrl = editor.getAttributes("link").href as string | undefined;
      linkSelectionRef.current = { from, to };
      setLinkUrl(currentUrl ?? (selectedText.startsWith("http") ? selectedText : ""));
      setLinkError("");
      setIsLinkDialogOpen(true);
    };

    const handleSubmitLink = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const href = normalizeWebUrl(linkUrl);
      if (!href) {
        setLinkError("Enter a complete http or https URL.");
        return;
      }

      const selection = linkSelectionRef.current;
      if (!selection) return;
      if (selection.from !== selection.to) {
        editor.chain().focus().setTextSelection(selection).setMark("link", { href }).run();
      } else {
        editor.chain().focus().setTextSelection(selection.from).insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href } }],
        }).run();
      }
      setIsLinkDialogOpen(false);
    };

    const isMac =
      typeof window !== "undefined" &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? "⌘" : "Ctrl";

    return (
      <>
        <div className="flex min-h-11 min-w-0 flex-row items-center overflow-x-auto border-b border-slate-200 bg-slate-50/90 select-none">
          {displayMode !== "minimized" ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-2 py-1.5 [scrollbar-width:thin]">
              <div className="flex min-w-max items-center gap-1">
                {/* Inline Text Styles */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  aria-pressed={editor.isActive("bold")}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("bold")
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Bold (${modKey}+B)`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  aria-pressed={editor.isActive("italic")}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("italic")
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Italic (${modKey}+I)`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  aria-pressed={editor.isActive("underline")}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("underline")
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Underline (${modKey}+U)`}
                >
                  <UnderlineIcon className="w-3.5 h-3.5" />
                </button>

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {/* Code Block & Language */}
                <button
                  type="button"
                  onClick={handleToggleCodeBlock}
                  aria-pressed={editor.isActive("codeBlock")}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("codeBlock")
                      ? "bg-slate-800 text-white font-bold"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  aria-label={editor.isActive("codeBlock") ? "Convert code block to paragraph and keep text" : "Format as code block"}
                  title={editor.isActive("codeBlock") ? "Convert to paragraph (keeps text)" : "Code Block " + modKey + "+Alt+C"}
                >
                  <Code className="w-3 h-3" />
                </button>


                <CodeLanguageSelect editor={editor} />

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {/* Tables */}
                <TableControls editor={editor} />

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {/* Headings */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setParagraph().run()}
                  aria-label="Paragraph"
                  aria-pressed={editor.isActive("paragraph")}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("paragraph")
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title="Paragraph"
                >
                  <Pilcrow className="w-3.5 h-3.5" />
                </button>

                <div
                  className="h-5 w-px bg-slate-300 mx-1"
                  aria-hidden="true"
                />

                <button
                  type="button"
                  onClick={handleAddLink}
                  aria-label="Add link"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer text-slate-600 hover:bg-white hover:text-slate-950"
                  title="Add URL to selected text or insert a clickable URL"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>

                <div className="h-5 w-px bg-slate-300 mx-1" />

                <button
                  type="button"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("heading", { level: 1 })
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Heading 1 (${modKey}+Alt+1)`}
                >
                  <Heading1 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("heading", { level: 2 })
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Heading 2 (${modKey}+Alt+2)`}
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {/* Highlights */}
                <div className="flex items-center gap-1">
                  <Highlighter className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                  {HIGHLIGHT_COLORS.map(({ color, bgClass, title }) => (
                    <button
                      key={color}
                      onClick={() =>
                        editor.chain().focus().toggleHighlight({ color }).run()
                      }
                      className={`w-4 h-4 rounded-full hover:scale-110 border transition-transform cursor-pointer ${bgClass}`}
                      title={`${title} (${modKey}+Shift+H)`}
                    />
                  ))}
                </div>

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {/* Alignment */}
                <button
                  type="button"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                  aria-label="Align left"
                  aria-pressed={editor.isActive({ textAlign: "left" })}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive({ textAlign: "left" })
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Align Left (${modKey}+Shift+L)`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                  aria-label="Align center"
                  aria-pressed={editor.isActive({ textAlign: "center" })}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive({ textAlign: "center" })
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Align Center (${modKey}+Shift+E)`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                  aria-label="Align right"
                  aria-pressed={editor.isActive({ textAlign: "right" })}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive({ textAlign: "right" })
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Align Right (${modKey}+Shift+R)`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {/* Lists */}
                <button
                  type="button"
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  aria-pressed={editor.isActive("bulletList")}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("bulletList")
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Bullet List (${modKey}+Shift+8)`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                  aria-pressed={editor.isActive("orderedList")}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer ${
                    editor.isActive("orderedList")
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  title={`Numbered List (${modKey}+Shift+7)`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {/* Media Upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload image"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs text-slate-600 hover:bg-white hover:text-slate-950 cursor-pointer"
                  title="Upload Image"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  className="h-5 w-px bg-slate-300 mx-1"
                  aria-hidden="true"
                />

                <button
                  type="button"
                  onClick={onRequestClear}
                  aria-label="Clear draft"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 cursor-pointer"
                  title="Clear Draft"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div
                  className="h-5 w-px bg-slate-300 mx-1"
                  aria-hidden="true"
                />

                <button
                  type="button"
                  onClick={onInsertTimestamp}
                  aria-label={"Insert timestamp " + formatTime(currentTime)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer"
                  title="Insert Timestamp (Alt + N)"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stamp</span>
                  <span>{formatTime(currentTime)}</span>
                  <kbd className="hidden sm:inline-block px-1 py-0.5 text-[10px] bg-blue-700/50 rounded border border-blue-400/30">
                    Alt+N
                  </kbd>
                </button>
              </div>
            </div>
          ) : (
            <span className="flex-1 px-1 text-xs font-semibold text-slate-700">
              Notes editor minimized
            </span>
          )}
        </div>
        {isLinkDialogOpen && (
          <div
            className="ux-overlay fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setIsLinkDialogOpen(false);
            }}
          >
            <div
              ref={linkDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="editor-link-dialog-title"
              tabIndex={-1}
              className="ux-dialog w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="editor-link-dialog-title"
                    className="text-sm font-semibold text-slate-900"
                  >
                    Add a link
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Use a complete address beginning with http:// or https://.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLinkDialogOpen(false)}
                  aria-label="Close link dialog"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSubmitLink} className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="editor-link-url"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    URL
                  </label>
                  <input
                    id="editor-link-url"
                    type="url"
                    value={linkUrl}
                    onChange={(event) => {
                      setLinkUrl(event.target.value);
                      setLinkError("");
                    }}
                    placeholder="https://example.com"
                    aria-invalid={Boolean(linkError)}
                    aria-describedby={
                      linkError ? "editor-link-error" : undefined
                    }
                    data-dialog-autofocus
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  {linkError && (
                    <p
                      id="editor-link-error"
                      role="alert"
                      className="mt-1.5 text-sm text-red-600"
                    >
                      {linkError}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLinkDialogOpen(false)}
                    className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Add link
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  },
);
