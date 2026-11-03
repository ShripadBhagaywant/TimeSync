// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { EditorIndentExtension, CODE_INDENT_SIZE } from "@/features/workspace/components/editor/EditorIndentExtension";
import { sanitizeExportHtml } from "@/lib/noteHtml";
import { htmlToMarkdown, htmlToPlainText } from "@/features/workspace/utils/exportConversions";

const editors: Editor[] = [];
// jsdom has no layout engine; ProseMirror's native arrow handlers request Range geometry.
Object.defineProperty(Range.prototype, "getClientRects", { value: () => [], configurable: true });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { value: () => new DOMRect(), configurable: true });
const create = (content: string) => {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({ element, extensions: [
    StarterKit.configure({ codeBlock: { enableTabIndentation: true, tabSize: CODE_INDENT_SIZE } }),
    EditorIndentExtension,
  ], content });
  editors.push(editor);
  return editor;
};
const key = (editor: Editor, value: string, shiftKey = false) => {
  const event = new KeyboardEvent("keydown", { key: value, code: value, shiftKey, bubbles: true, cancelable: true });
  editor.view.dom.dispatchEvent(event);
  return event.defaultPrevented;
};
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); document.body.innerHTML = ""; });

describe("editor indentation", () => {
  for (const tag of ["ul", "ol"]) it(`sinks and lifts ${tag} items using list nodes`, () => {
    const editor = create(`<${tag}><li><p>Parent</p></li><li><p>Child</p></li></${tag}>`);
    editor.commands.setTextSelection(13);
    expect(key(editor, "Tab")).toBe(true);
    expect(editor.state.doc.child(0).child(0).child(1).type.name).toBe(tag === "ul" ? "bulletList" : "orderedList");
    key(editor, "Tab", true);
    expect(editor.state.doc.child(0).childCount).toBe(2);
  });
  for (const tag of ["p", "h2", "h6"]) it(`indents ${tag}, caps depth, outdents and restores HTML`, () => {
    const editor = create(`<${tag}>Notes</${tag}>`);
    editor.commands.setTextSelection(2);
    key(editor, "Tab");
    expect(editor.state.doc.child(0).attrs.indent).toBe(1);
    for (let i = 0; i < 8; i++) key(editor, "Tab");
    expect(editor.state.doc.child(0).attrs.indent).toBe(6);
    key(editor, "Tab", true);
    const restored = create(editor.getHTML());
    expect(restored.state.doc.child(0).attrs.indent).toBe(5);
    expect(restored.state.doc.child(0).textContent).toBe("Notes");
  });
  it("inserts two code spaces and outdents the current line", () => {
    const editor = create("<pre><code>hello</code></pre>");
    editor.commands.setTextSelection(1);
    key(editor, "Tab");
    expect(editor.state.doc.child(0).textContent).toBe("  hello");
    key(editor, "Tab", true);
    expect(editor.state.doc.child(0).textContent).toBe("hello");
  });
  it("supports undo/redo and leaves arrows to ProseMirror/browser", () => {
    const editor = create("<p>One</p><h2>Two</h2>");
    key(editor, "Tab");
    editor.commands.undo();
    expect(editor.state.doc.child(0).attrs.indent).toBe(0);
    editor.commands.redo();
    expect(editor.state.doc.child(0).attrs.indent).toBe(1);
    editor.commands.setTextSelection(2);
    for (const arrow of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) expect(key(editor, arrow)).toBe(false);
  });
  it("preserves semantic indentation in safe HTML and exports", () => {
    const html = '<p data-indent="2" onclick="alert(1)">First</p><h2>Second</h2>';
    const safe = sanitizeExportHtml(html);
    expect(safe).toContain('data-indent="2"');
    expect(safe).toContain("margin-left: 4em");
    expect(safe).not.toContain("onclick");
    expect(htmlToMarkdown("Title", html)).toContain("> > First");
    expect(htmlToPlainText("Title", html)).toContain("    First");
    expect(sanitizeExportHtml('<h6 data-indent="1">Heading</h6>')).toContain('<h6 data-indent="1"');
  });
  it("edits and restores standalone single-video content without playlist state", () => {
    const editor = create("<p>Single video</p>");
    editor.commands.setTextSelection(13);
    editor.commands.insertContent(" edited");
    key(editor, "Tab");
    const restored = create(editor.getHTML());
    expect(restored.state.doc.child(0).textContent).toBe("Single video edited");
    expect(restored.state.doc.child(0).attrs.indent).toBe(1);
    expect(htmlToPlainText("Single", restored.getHTML())).toContain("  Single video edited");
  });
});
