import { Mark, mergeAttributes } from "@tiptap/core";

export const normalizeWebUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const LinkExtension = Mark.create({
  name: "link",
  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeWebUrl(element.getAttribute("href") ?? ""),
        renderHTML: (attributes: { href?: string | null }) => ({ href: attributes.href }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[href]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, {
      target: "_blank",
      rel: "noopener noreferrer",
    }), 0];
  },
});
