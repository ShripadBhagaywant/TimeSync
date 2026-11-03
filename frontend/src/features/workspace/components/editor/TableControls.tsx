import React from "react";
import type { Editor } from "@tiptap/react";
import {
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Columns3,
  Rows3,
  Table2,
  Trash2,
} from "lucide-react";

interface TableControlsProps {
  editor: Editor;
}

const controlClass =
  "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40";

export const TableControls: React.FC<TableControlsProps> = ({ editor }) => {
  const tableIsActive = editor.isActive("table");

  if (!tableIsActive) {
    return (
      <button
        type="button"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        className={controlClass}
        aria-label="Insert table"
        title="Insert a 3 × 3 table"
      >
        <Table2 className="h-4 w-4" />
        <span className="hidden sm:inline">Table</span>
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-xl border border-blue-200 bg-blue-50/70 p-0.5"
      aria-label="Table editing controls"
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className={controlClass}
        aria-label="Add row below"
        title="Add row below"
      >
        <BetweenHorizontalStart className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteRow().run()}
        className={controlClass}
        aria-label="Delete current row"
        title="Delete current row"
      >
        <Rows3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className={controlClass}
        aria-label="Add column to the right"
        title="Add column to the right"
      >
        <BetweenVerticalStart className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className={controlClass}
        aria-label="Delete current column"
        title="Delete current column"
      >
        <Columns3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className={`${controlClass} text-red-600 hover:bg-red-50 hover:text-red-700`}
        aria-label="Delete table"
        title="Delete table"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};
