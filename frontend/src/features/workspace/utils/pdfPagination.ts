import { createPdfPage, PDF_BODY_HEIGHT } from "./pdfLayout";

type Boundary = { node: Node; offset: number };
const keepWithNext = (element: Element) => /^(H[1-6]|HR)$/.test(element.tagName) || element.classList.contains("pdf-keep-next");

/** Layout happens in the isolated, fully styled document, never in a canvas. */
export const paginatePdf = async (doc: Document, source: HTMLElement, title: string, date: string, signal?: AbortSignal): Promise<HTMLElement[]> => {
  const measure = doc.createElement("div");
  measure.className = "pdf-flow pdf-measure";
  doc.body.append(measure);
  const height = (elements: Element[]) => {
    measure.replaceChildren(...elements.map((element) => element.cloneNode(true)));
    return measure.getBoundingClientRect().height;
  };
  const pages: HTMLElement[] = [];
  let flow: HTMLElement;
  const newPage = () => {
    const page = createPdfPage(doc, title, date);
    doc.body.append(page);
    pages.push(page);
    flow = page.querySelector<HTMLElement>(".pdf-flow")!;
  };
  newPage();

  const fragment = (element: Element, boundary: Boundary, before: boolean): HTMLElement => {
    const range = doc.createRange();
    range.selectNodeContents(element);
    if (before) range.setEnd(boundary.node, boundary.offset);
    else range.setStart(boundary.node, boundary.offset);
    const copy = element.cloneNode(false) as HTMLElement;
    copy.append(range.cloneContents());
    // Ranges can leave empty ancestor shells at a split boundary.
    Array.from(copy.querySelectorAll("p, li, ul, ol, tbody, tr, blockquote, div")).reverse().forEach((node) => {
      if (!node.textContent?.trim() && !node.querySelector("img, br, hr")) node.remove();
    });
    return copy;
  };

  const split = (element: HTMLElement, capacity: number): [HTMLElement, HTMLElement] | null => {
    const preferred: Boundary[] = [];
    const words: Boundary[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === 3) {
        const text = node.textContent || "";
        for (const match of text.matchAll(/\s+|\S+/gu)) {
          words.push({ node, offset: match.index + match[0].length });
          if (element.tagName === "PRE" && match[0].includes("\n")) {
            preferred.push({ node, offset: match.index + match[0].lastIndexOf("\n") + 1 });
          }
        }
      } else {
        Array.from(node.childNodes).forEach((child, index) => {
          walk(child);
          if (child.nodeType === 1) {
            const tag = (child as Element).tagName;
            const list = element.tagName === "OL" || element.tagName === "UL";
            const table = element.tagName === "TABLE";
            if (list ? tag === "LI" && node === element
                : table ? tag === "TR" && !(child as Element).closest("thead")
                : /^(P|LI|TR|PRE|BLOCKQUOTE|TABLE|IMG)$/.test(tag)) {
              preferred.push({ node, offset: index + 1 });
            }
            if (/^(IMG|BR|HR)$/.test(tag)) words.push({ node, offset: index + 1 });
          }
        });
      }
    };
    walk(element);
    // Candidate order follows document traversal. Keep entire child blocks first.
    const choose = (candidates: Boundary[]) => {
      let low = 0, high = candidates.length - 1;
      let best: Boundary | undefined;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = candidates[mid]!;
        if (height([fragment(element, candidate, true)]) <= capacity) {
          best = candidate;
          low = mid + 1;
        } else high = mid - 1;
      }
      return best;
    };
    let boundary = choose(preferred);
    const structured = /^(OL|UL|TABLE|PRE)$/.test(element.tagName);
    if (!boundary && /^(OL|UL|TABLE)$/.test(element.tagName)) {
      const first = preferred[0];
      if (first && height([fragment(element, first, true)]) <= PDF_BODY_HEIGHT) return null;
    }
    if (!boundary || (!structured && height([fragment(element, boundary, true)]) < Math.min(100, capacity / 3))) {
      boundary = choose(words);
    }
    if (!boundary) {
      // A single very long token still needs a safe Unicode boundary.
      const graphemes: Boundary[] = [];
      const walker = doc.createTreeWalker(element, 4);
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const part of segmenter.segment(node.textContent || "")) {
          graphemes.push({ node, offset: part.index + part.segment.length });
        }
      }
      boundary = choose(graphemes);
    }
    if (!boundary) return null;
    const head = fragment(element, boundary, true);
    const tail = fragment(element, boundary, false);
    if (!head.textContent?.trim() && !head.querySelector("img")) return null;
    if (!tail.textContent?.trim() && !tail.querySelector("img")) return null;

    if (element.tagName === "OL" || element.tagName === "UL") {
      const items = Array.from(element.children);
      const completed = items.length - tail.children.length;
      if (element.tagName === "OL") {
        const direction = element.hasAttribute("reversed") ? -1 : 1;
        let number = Number(element.getAttribute("start") || (direction === -1 ? items.length : 1));
        items.slice(0, completed + 1).forEach((item, index) => {
          if (item.hasAttribute("value")) number = Number(item.getAttribute("value"));
          if (index < completed) number += direction;
        });
        tail.setAttribute("start", String(number));
      }
      if (head.children.length + tail.children.length > items.length) {
        tail.firstElementChild?.classList.add("pdf-list-continuation");
      }
    }
    if (element.tagName === "TABLE") {
      const heading = element.querySelector("thead");
      if (heading && !tail.querySelector("thead")) tail.prepend(heading.cloneNode(true));
    }
    if (element.classList.contains("pdf-callout")) {
      const label = element.querySelector(".pdf-callout-label");
      if (label && !tail.querySelector(".pdf-callout-label")) tail.prepend(label.cloneNode(true));
    }
    return [head, tail];
  };

  const queue = Array.from(source.children) as HTMLElement[];
  try {
    let batches = 0;
    while (queue.length) {
      signal?.throwIfAborted();
      if (batches++ % 8 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
      const element = queue.shift()!;
      const current = Array.from(flow!.children);
      const group = [element];
      if (keepWithNext(element)) {
        for (const following of queue) {
          group.push(following);
          if (!keepWithNext(following)) break;
        }
      }
      if (group.length > 1 && height(group) <= PDF_BODY_HEIGHT
          && current.length && height([...current, ...group]) > PDF_BODY_HEIGHT) {
        newPage();
      }
      // A page boundary already separates sections; omit a decorative leading rule.
      if (element.tagName === "HR" && !flow!.children.length) continue;
      if (height([...Array.from(flow!.children), element]) <= PDF_BODY_HEIGHT) {
        flow!.append(element);
        continue;
      }
      const trailingHeadings: Element[] = [];
      for (let last = flow!.lastElementChild; last && keepWithNext(last); last = last.previousElementSibling) {
        trailingHeadings.unshift(last);
      }
      if (height([element]) <= PDF_BODY_HEIGHT && height([...trailingHeadings, element]) <= PDF_BODY_HEIGHT) {
        // Move trailing headings/rules along with the block that follows them.
        const trailing: Element[] = [];
        while (flow!.lastElementChild && keepWithNext(flow!.lastElementChild)) {
          trailing.unshift(flow!.lastElementChild);
          flow!.lastElementChild.remove();
        }
        newPage();
        flow!.append(...trailing, element);
        if (height(Array.from(flow!.children)) > PDF_BODY_HEIGHT) {
          element.remove();
          queue.unshift(element);
        }
        continue;
      }
      // This block is taller than a whole page: split its DOM, preserving markup.
      const capacity = PDF_BODY_HEIGHT - height(Array.from(flow!.children)) - 20;
      const pieces = capacity >= 70 ? split(element, capacity) : null;
      if (pieces) {
        flow!.append(pieces[0]);
        if (flow!.getBoundingClientRect().height > PDF_BODY_HEIGHT + 1) {
          pieces[0].remove();
          throw new Error("PDF block exceeded its measured page area");
        }
        newPage();
        queue.unshift(pieces[1]);
      } else if (flow!.children.length > trailingHeadings.length) {
        trailingHeadings.forEach((node) => node.remove());
        newPage();
        flow!.append(...trailingHeadings);
        queue.unshift(element);
      } else {
        throw new Error("A note block cannot fit on an A4 page without clipping");
      }
    }
    pages.forEach((page, index) => {
      page.querySelector(".pdf-page-number")!.textContent = `Page ${index + 1} of ${pages.length}`;
    });
    return pages;
  } finally {
    measure.remove();
  }
};
