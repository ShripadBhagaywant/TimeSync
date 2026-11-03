// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeExportHtml } from "@/lib/noteHtml";
describe("shared note HTML", () => {
  it("removes executable attributes and unsafe links", () => {
    const html = sanitizeExportHtml('<p onclick="alert(1)">Notes</p><a href="javascript:alert(1)">Link</a><img src="https://example.com/image.png" onerror="alert(1)">');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("https://example.com/image.png");
  });
  it("retains semantic indentation while stripping internal workspace attributes", () => {
    const html = sanitizeExportHtml('<h2 data-playlist-video-id="one" data-indent="2">Lesson</h2>');
    expect(html).not.toContain("data-playlist-video-id");
    expect(html).toContain('data-indent="2"');
  });
});
