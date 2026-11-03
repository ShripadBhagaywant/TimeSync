import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export const MAX_INDENT = 6;
export const CODE_INDENT_SIZE = 2;
export const clampIndent = (value: unknown): number => {
  const depth = Number(value);
  return Number.isFinite(depth) ? Math.max(0, Math.min(MAX_INDENT, Math.trunc(depth))) : 0;
};

/** Editor-scoped keys only. Tables and code blocks retain their own keymaps. */
export const EditorIndentExtension = Extension.create({
  name: "editorIndent",
  priority: 1000,
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => clampIndent(element.getAttribute("data-indent")),
          renderHTML: (attributes) => ({ "data-indent": clampIndent(attributes.indent) }),
        },
      },
    }];
  },
  addKeyboardShortcuts() {
    const changeIndent = (delta: number) => {
      const { editor } = this;
      if (!editor.isEditable || !(editor.state.selection instanceof TextSelection)) return false;
      if (editor.isActive("codeBlock") || editor.isActive("table")) return false;
      if (editor.isActive("listItem")) {
        return delta > 0
          ? editor.commands.sinkListItem("listItem")
          : editor.commands.liftListItem("listItem");
      }
      const { from, to, $from } = editor.state.selection;
      if (!["paragraph", "heading"].includes($from.parent.type.name)) return false;
      return editor.commands.command(({ tr }) => {
        tr.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "listItem" || node.type.name === "table") return false;
          if (["paragraph", "heading"].includes(node.type.name)) {
            const indent = clampIndent(clampIndent(node.attrs.indent) + delta);
            if (indent !== node.attrs.indent) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
          }
        });
        return true;
      });
    };
    return {
      Tab: () => changeIndent(1),
      "Shift-Tab": () => changeIndent(-1),
      // Escape releases focus; the next Tab uses normal browser navigation.
      Escape: () => this.editor.commands.blur(),
    };
  },
});
