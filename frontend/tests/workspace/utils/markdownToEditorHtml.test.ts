import { describe, expect, it } from "vitest";
import { markdownToEditorHtml } from "@/features/workspace/utils/markdownToEditorHtml";

describe("markdownToEditorHtml", () => {
  it("converts headings, lists, and fenced code", () => {
    const markdown = [
      "## Topic",
      "",
      "- First",
      "- Second",
      "",
      "\x60\x60\x60java",
      "System.out.println(\"ok\");",
      "\x60\x60\x60",
    ].join("\n");

    const html = markdownToEditorHtml(markdown);
    expect(html).toContain("<h2>Topic</h2>");
    expect(html).toContain("<ul><li>First</li><li>Second</li></ul>");
    expect(html).toContain('<code class="language-java">');
  });

  it("escapes raw HTML before rendering", () => {
    const html = markdownToEditorHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
