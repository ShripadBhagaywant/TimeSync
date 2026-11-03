// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { normalizePdfHtml, pdfFilename } from "@/features/workspace/utils/exportHtmlNormalizer";
import { createPdfTitle } from "@/features/workspace/utils/pdfLayout";

const normalize = (html: string) => normalizePdfHtml(html, document);
describe("PDF-only normalization", () => {
  it("turns standalone separators into rules, including existing hr", () => {
    expect(normalize("<p>---</p><hr>").querySelectorAll("hr")).toHaveLength(2);
    expect(normalize("<pre><code>---</code></pre><p>before --- after</p>").textContent).toContain("---");
  });
  it.each(["NOTE", "KEY TAKEAWAY"])("groups %s with its blockquote", (marker) => {
    const root = normalize(`<p>[!${marker}]</p><blockquote><p>Body हिंदी</p></blockquote>`);
    expect(root.querySelectorAll(".pdf-callout")).toHaveLength(1);
    expect(root.querySelector(".pdf-callout-content")?.textContent).toBe("Body हिंदी");
    expect(root.textContent).not.toContain("[!");
  });
  it("recognizes a marker inside a blockquote", () => {
    expect(normalize("<blockquote><p>[!NOTE]</p><p>Body</p></blockquote>").textContent).toBe("NoteBody");
  });
  it("preserves ordinary bracketed prose and code markers", () => {
    expect(normalize("<p>[array index]</p><p>[!NOTE] is syntax</p><pre>[!NOTE]</pre>").textContent)
      .toBe("[array index][!NOTE] is syntax[!NOTE]");
  });
  it("preserves headings, nested lists, numbering, formatting and links", () => {
    const root = normalize('<h2>A &amp; B</h2><ol start="7"><li><p><strong>Bold</strong> <em>italic</em></p><ul><li>Nested</li></ul></li></ol><a href="https://example.com">Link</a>');
    expect(root.querySelector("h2")?.textContent).toBe("A & B");
    expect(root.querySelector("ol")?.getAttribute("start")).toBe("7");
    expect(root.querySelector("ol li ul li")?.textContent).toBe("Nested");
    expect(root.querySelector("strong")?.textContent).toBe("Bold");
    expect(root.querySelector("em")?.textContent).toBe("italic");
    expect(root.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
  });
  it("preserves Unicode, inline code and HTML special characters", () => {
    const root = normalize('<p>हिंदी 🙂 ∑ <code>O(n * d)</code> &lt;x&gt; &amp; y</p>');
    expect(root.textContent).toBe("हिंदी 🙂 ∑ O(n * d) <x> & y");
    expect(root.querySelector("code")?.textContent).toBe("O(n * d)");
  });
  it("escapes a long title as text without truncation", () => {
    const title = '<script> & हिंदी '.repeat(30);
    const card = createPdfTitle(document, title, "2026-09-22");
    expect(card.querySelector("h1")?.textContent).toBe(title);
    expect(card.querySelector("script")).toBeNull();
  });
  it("handles empty content and empty title", () => {
    expect(normalize("").children).toHaveLength(0);
    expect(createPdfTitle(document, "", "date").textContent).toContain("Untitled Notes");
  });
  it("joins an already-formatted quoted label with its body and removes empty quote artifacts", () => {
    const root = normalize('<blockquote><p><strong><mark>KEY TAKEAWAY</mark></strong></p></blockquote><blockquote><p>Keep this body.</p></blockquote><blockquote><p><br></p></blockquote>');
    expect(root.querySelectorAll(".pdf-callout")).toHaveLength(1);
    expect(root.querySelector(".pdf-callout-content")?.textContent).toBe("Keep this body.");
    expect(root.querySelectorAll("blockquote")).toHaveLength(0);
  });
  it("keeps bold section labels with following content without changing prose", () => {
    const root = normalize('<p><strong>Storage Overhead:</strong></p><ul><li>Details</li></ul><p><strong>Important</strong> ordinary prose.</p>');
    expect(root.querySelector("p")?.classList.contains("pdf-keep-next")).toBe(true);
    expect(root.querySelectorAll(".pdf-keep-next")).toHaveLength(1);
    expect(root.textContent).toContain("Important ordinary prose.");
  });
  it("keeps safe filenames and removes invalid filesystem characters", () => {
    expect(pdfFilename("my-study-notes")).toBe("my-study-notes.pdf");
    expect(pdfFilename('a<b>:c/d\\e|f?g*')).toBe("abcdefg.pdf");
    expect(pdfFilename("...")).toBe("notes.pdf");
    expect(pdfFilename("CON")).toBe("notes.pdf");
    expect(pdfFilename("हिंदी".repeat(100)).length).toBeLessThan(200);
  });
});
