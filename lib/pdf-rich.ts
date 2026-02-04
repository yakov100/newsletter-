/**
 * ספריית יצירת PDF מעברית – פירוק HTML ל־בלוקים ורינדור עם עיצוב RTL.
 */

import type { jsPDF } from "jspdf";

export type PdfBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "list-item"
  | "list-item-ordered"
  | "blockquote";

export interface PdfSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface PdfBlock {
  type: PdfBlockType;
  segments: PdfSegment[];
}

const BLOCK_TAGS: Record<string, PdfBlockType> = {
  P: "paragraph",
  H1: "heading1",
  H2: "heading2",
  H3: "heading3",
  H4: "heading4",
  LI: "list-item",
  BLOCKQUOTE: "blockquote",
};

function getBlockType(el: Element, parentTag: string): PdfBlockType | null {
  const tag = el.tagName.toUpperCase();
  if (tag === "LI") {
    const list = el.parentElement;
    return list?.tagName.toUpperCase() === "OL" ? "list-item-ordered" : "list-item";
  }
  return BLOCK_TAGS[tag] ?? null;
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function collectSegments(node: Node, segments: PdfSegment[]): void {
  if (node.nodeType === TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) segments.push({ text: text + " " });
    return;
  }
  if (node.nodeType !== ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  const bold = tag === "STRONG" || tag === "B";
  const italic = tag === "EM" || tag === "I";
  if (tag === "BR") {
    segments.push({ text: "\n" });
    return;
  }
  if (bold || italic) {
    for (const child of el.childNodes) collectSegments(child, segments);
    const last = segments[segments.length - 1];
    if (last && last.text !== "\n") {
      last.bold = last.bold || bold;
      last.italic = last.italic || italic;
    }
    return;
  }
  for (const child of el.childNodes) collectSegments(child, segments);
}

function normalizeSegments(segments: PdfSegment[]): PdfSegment[] {
  const out: PdfSegment[] = [];
  for (const s of segments) {
    const t = s.text.replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t === "\n") {
      out.push({ text: "\n" });
      continue;
    }
    out.push({ ...s, text: t + (s.text.endsWith("\n") ? "\n" : " ") });
  }
  const last = out[out.length - 1];
  if (last && last.text !== "\n") last.text = last.text.trimEnd();
  return out;
}

/**
 * מפרק את גוף ה־DOM לרשימת בלוקים ל־PDF. מתאים לדפדפן (DOMParser) ולשרת (JSDOM).
 */
export function parseHtmlToPdfBlocksFromBody(body: Element): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  let listIndex = 0;

  const walk = (parent: Element, parentTag: string) => {
    if (parentTag === "OL") listIndex = 0;
    for (const el of parent.children) {
      const blockType = getBlockType(el, parentTag);
      if (blockType) {
        const segments: PdfSegment[] = [];
        collectSegments(el, segments);
        const normalized = normalizeSegments(segments);
        if (normalized.length) {
          if (blockType === "list-item-ordered") {
            listIndex += 1;
            const firstText = normalized[0]?.text?.trim() ?? "";
            const rest = normalized.slice(1);
            blocks.push({
              type: blockType,
              segments: [{ text: `${listIndex}. ${firstText} `, bold: normalized[0]?.bold }, ...rest],
            });
          } else {
            blocks.push({ type: blockType, segments: normalized });
          }
        }
      } else {
        walk(el, el.tagName.toUpperCase());
      }
    }
  };

  walk(body, "");
  return blocks;
}

/**
 * מפרק מחרוזת HTML ל־בלוקי PDF (דפדפן: משתמש ב־DOMParser).
 */
export function parseHtmlToPdfBlocks(html: string): PdfBlock[] {
  const doc = new DOMParser().parseFromString(html || "<p>אין תוכן.</p>", "text/html");
  return parseHtmlToPdfBlocksFromBody(doc.body);
}

/** גדלי גופן לפי סוג בלוק – עיצוב היררכי */
const FONT_SIZES: Record<PdfBlockType, number> = {
  paragraph: 11,
  heading1: 24,
  heading2: 18,
  heading3: 15,
  heading4: 13,
  "list-item": 11,
  "list-item-ordered": 11,
  blockquote: 10,
};

/** גובה שורה לפי סוג בלוק */
const LINE_HEIGHTS: Record<PdfBlockType, number> = {
  paragraph: 17,
  heading1: 32,
  heading2: 24,
  heading3: 20,
  heading4: 17,
  "list-item": 17,
  "list-item-ordered": 17,
  blockquote: 15,
};

/** ריווח אחרי בלוק */
const BLOCK_SPACING: Record<PdfBlockType, number> = {
  paragraph: 6,
  heading1: 14,
  heading2: 10,
  heading3: 8,
  heading4: 6,
  "list-item": 2,
  "list-item-ordered": 2,
  blockquote: 8,
};

/** הזחה לציטוט (ימין ב־RTL) */
const BLOCKQUOTE_INDENT = 20;

export interface RenderPdfOptions {
  margin: number;
  pageW: number;
  pageH: number;
  maxW: number;
  startY?: number;
  fontName?: string;
  /** כשמופעל – משתמש רק ב־normal (לגופנים ללא bold/italic). */
  fontStyleNormalOnly?: boolean;
}

/**
 * מצייר את כל הבלוקים ב־PDF עם עיצוב עברי RTL.
 */
export function renderPdfBlocks(
  pdf: InstanceType<typeof jsPDF>,
  blocks: PdfBlock[],
  opts: RenderPdfOptions
): void {
  const {
    margin,
    pageW,
    pageH,
    maxW,
    startY,
    fontName = "helvetica",
    fontStyleNormalOnly = false,
  } = opts;
  let y = startY ?? margin;

  const checkNewPage = (need: number) => {
    if (y + need > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  for (const block of blocks) {
    const fontSize = FONT_SIZES[block.type];
    const lineHeight = LINE_HEIGHTS[block.type];
    const spacing = BLOCK_SPACING[block.type];
    const isList = block.type === "list-item" || block.type === "list-item-ordered";
    const isBlockquote = block.type === "blockquote";
    const listIndent = isList ? 18 : 0;
    const quoteIndent = isBlockquote ? BLOCKQUOTE_INDENT : 0;
    const contentMaxW = maxW - listIndent - quoteIndent;
    pdf.setFontSize(fontSize);

    let firstSegment = true;
    for (const seg of block.segments) {
      if (seg.text === "\n") {
        y += lineHeight;
        checkNewPage(lineHeight);
        continue;
      }
      const style = fontStyleNormalOnly ? "normal" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
      pdf.setFont(fontName, style);
      const bullet = block.type === "list-item" && firstSegment ? "• " : "";
      firstSegment = false;
      const textToDraw = (bullet + seg.text.replace(/\n/g, " ")).trim();
      if (!textToDraw) continue;
      const lines = pdf.splitTextToSize(textToDraw, contentMaxW);
      for (const line of lines) {
        checkNewPage(lineHeight);
        pdf.text(line, margin + listIndent + quoteIndent, y);
        y += lineHeight;
      }
    }
    y += spacing;
  }
}
