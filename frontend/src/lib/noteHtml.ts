const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "img",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);
const ALLOWED_ATTRIBUTES = new Set([
  "alt",
  "class",
  "colspan",
  "data-type",
  "data-indent",
  "href",
  "src",
  "style",
  "rowspan",
  "timestamp",
  "title",
]);

const isSafeUrl = (value: string, allowDataImage = false) => {
  if (
    allowDataImage &&
    /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)
  ) {
    return true;
  }
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const SAFE_COLOR_VALUE =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+(?:\s*,\s*[\d.]+){2,3}\s*\))$/i;

const sanitizeInlineStyle = (style: string) =>
  style
    .split(";")
    .map((declaration) => declaration.split(":", 2).map((part) => part.trim()))
    .filter(([property, value]) => {
      if ((property === "color" || property === "background-color") &&
          SAFE_COLOR_VALUE.test(value ?? "")) return true;
      return property === "text-align" &&
        ["left", "right", "center", "justify", "start", "end"].includes((value ?? "").toLowerCase());
    })
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

export const sanitizeExportHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelectorAll("*").forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const isUrlAttribute = name === "href" || name === "src";
      if (name === "style") {
        const safeStyle = sanitizeInlineStyle(attribute.value);
        if (safeStyle) element.setAttribute("style", safeStyle);
        else element.removeAttribute("style");
        return;
      }
      if (
        !ALLOWED_ATTRIBUTES.has(name) ||
        (isUrlAttribute && !isSafeUrl(attribute.value, name === "src"))
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  doc.body.querySelectorAll("[data-indent]").forEach((element) => {
    const depth = element.getAttribute("data-indent") || "0";
    if (!/^[0-6]$/.test(depth) || !/^(P|H[1-6])$/.test(element.tagName)) {
      element.removeAttribute("data-indent");
    } else if (Number(depth) > 0) {
      (element as HTMLElement).style.marginLeft = `${Number(depth) * 2}em`;
    }
  });
  return doc.body.innerHTML;
};

