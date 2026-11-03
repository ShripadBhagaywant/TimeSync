const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const inlineMarkdown = (value: string) =>
  escapeHtml(value)
    .replace(/\x60([^\x60]+)\x60/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");

export const markdownToEditorHtml = (content: string) => {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeLanguage = "";
  let codeLines: string[] | null = null;

  const closeList = () => {
    if (listType) {
      html.push("</" + listType + ">");
      listType = null;
    }
  };

  for (const line of lines) {
    const fence = line.match(/^\x60{3}([\w#+.-]*)\s*$/);
    if (fence) {
      closeList();
      if (codeLines) {
        html.push(
          '<pre><code class="language-' +
            escapeHtml(codeLanguage || "text") +
            '">' +
            escapeHtml(codeLines.join("\n")) +
            "</code></pre>",
        );
        codeLines = null;
        codeLanguage = "";
      } else {
        codeLines = [];
        codeLanguage = fence[1] ?? "";
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (/^\s*\\?(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList();
      html.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = (heading[1] ?? "#").length;
      html.push(
        "<h" +
          level +
          ">" +
          inlineMarkdown(heading[2] ?? "") +
          "</h" +
          level +
          ">",
      );
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push("<" + nextType + ">");
      }
      const itemText = unordered?.[1] ?? ordered?.[1] ?? "";
      html.push("<li>" + inlineMarkdown(itemText) + "</li>");
      continue;
    }

    closeList();
    const callout = line.match(/^>\s*\[!([^\]]+)\]\s*$/);
    if (callout) {
      html.push("<blockquote><p><strong>" + inlineMarkdown(callout[1] ?? "") + "</strong></p></blockquote>");
      continue;
    }
    if (line.startsWith("> ")) {
      html.push(
        "<blockquote><p>" +
          inlineMarkdown(line.slice(2)) +
          "</p></blockquote>",
      );
    } else {
      html.push("<p>" + inlineMarkdown(line) + "</p>");
    }
  }

  closeList();
  if (codeLines) {
    html.push(
      '<pre><code class="language-' +
        escapeHtml(codeLanguage || "text") +
        '">' +
        escapeHtml(codeLines.join("\n")) +
        "</code></pre>",
    );
  }

  return html.join("");
};
