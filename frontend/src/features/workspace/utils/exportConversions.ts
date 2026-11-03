export const htmlToMarkdown = (title: string, htmlContent: string): string => {
  let md = `# ${title}\n\n`;

  md += htmlContent
    .replace(/<(p|h[1-6])\b([^>]*)>(.*?)<\/\1>/gis, (_match, tag: string, attrs: string, body: string) => {
      const depth = Math.min(6, Number(attrs.match(/data-indent=["']([0-6])["']/)?.[1] || 0));
      const heading = tag.toLowerCase() === "p" ? "" : "#".repeat(Number(tag[1])) + " ";
      return ("> ".repeat(depth) + heading + body).replace(/\n/g, "\n" + "> ".repeat(depth)) + "\n\n";
    })
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<ul>(.*?)<\/ul>/gi, "$1\n")
    .replace(/<ol>(.*?)<\/ol>/gi, "$1\n")
    .replace(/<li>(.*?)<\/li>/gi, "1. $1\n")
    .replace(/<span data-type="timestamp"[^>]*>(.*?)<\/span>/gi, " [$1] ")
    .replace(
      /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi,
      "![$2]($1)\n\n",
    )
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "![]($1)\n\n")
    .replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return md.trim();
};

export const htmlToPlainText = (title: string, htmlContent: string): string =>
  htmlToMarkdown(title, htmlContent)
    .replace(/^(?:> )+/gm, (prefix) => "  ".repeat(prefix.length / 2))
    .replace(/!\[(.*?)\]\((.*?)\)/g, "[Image: $1]")
    .replace(/```[\s\S]*?```/g, "[Code Block]")
    .replace(/#+\s/g, "")
    .replace(/\*+/g, "");

