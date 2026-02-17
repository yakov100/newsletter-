/**
 * יצירת PDF בשרת – עברית RTL עם גופן Heebo ועיצוב מסודר.
 * הגופן נטען מהדיסק (ללא fetch מצד הלקוח ו־CORS).
 */

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { jsPDF } from "jspdf";
import { JSDOM } from "jsdom";
import { parseHtmlToPdfBlocksFromBody, renderPdfBlocks } from "@/lib/pdf-rich";

const FONT_VFS_NAME = "Heebo-Regular.ttf";
const FONT_HEBREW = "Heebo";

/** קורא את קובץ הגופן ומחזיר Base64. זורק אם הקובץ חסר או לא תקין. */
function getFontBase64(): string {
  const fontPath = path.join(process.cwd(), "public", "fonts", "Heebo-Regular.ttf");
  if (!fs.existsSync(fontPath)) {
    throw new Error("גופן עברי לא נמצא. הרץ: npm run download-font");
  }
  const buf = fs.readFileSync(fontPath);
  const head = buf.subarray(0, 200).toString("utf8");
  if (/<\s*!?\s*DOCTYPE|<\s*html\s/i.test(head)) {
    throw new Error(
      "קובץ הגופן לא תקין. מחק את public/fonts/Heebo-Regular.ttf, הורד מ־Google Fonts (Heebo → Download family) וחלץ את Heebo-Regular.ttf לתיקיית public/fonts/"
    );
  }
  return buf.toString("base64");
}

/** שם קובץ עם עברית – לשימוש ב־filename*=UTF-8'' (רק תווים בטוחים). */
function displayFileName(title: string): string {
  const cleaned = (title ?? "article").replace(/[^\p{L}\p{N}\s\-_.]/gu, "").trim();
  return (cleaned || "article") + ".pdf";
}

/** שם קובץ ASCII בלבד – ל־Content-Disposition filename= (ByteString). */
function asciiFallbackFileName(): string {
  return "download.pdf";
}

/** בונה ערך Content-Disposition תומך עברית (RFC 5987). */
function contentDisposition(fileName: string): string {
  const ascii = asciiFallbackFileName();
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function POST(request: Request) {
  try {
    const { title, dateLabel, htmlContent, verified } = (await request.json()) as {
      title: string;
      dateLabel: string;
      htmlContent: string;
      verified?: boolean;
    };

    const fontBase64 = getFontBase64();
    const pdf = new jsPDF("p", "pt", "a4");

    pdf.addFileToVFS(FONT_VFS_NAME, fontBase64);
    pdf.addFont(FONT_VFS_NAME, FONT_HEBREW, "normal", undefined, "Identity-H");
    pdf.setR2L(true);
    pdf.setFont(FONT_HEBREW, "normal");

    const margin = 48;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    let y = margin;

    // כותרת ראשית – גדול ומודגש
    pdf.setFontSize(26);
    pdf.text(title ?? "כתבה ללא כותרת", margin, y);
    y += 36;

    // תאריך – שורה נפרדת, גופן קטן יותר
    pdf.setFontSize(11);
    pdf.setTextColor(100, 100, 100);
    pdf.text(dateLabel ?? "", margin, y);
    pdf.setTextColor(0, 0, 0);
    y += 28;

    // קו מפריד מתחת לכותרת
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageW - margin, y);
    y += 24;

    // תוכן מהמאמר
    const dom = new JSDOM(htmlContent || "<p>אין תוכן.</p>");
    const body = dom.window.document.body;
    const blocks = parseHtmlToPdfBlocksFromBody(body);
    renderPdfBlocks(pdf, blocks, {
      margin,
      pageW,
      pageH,
      maxW,
      startY: y,
      fontName: FONT_HEBREW,
      fontStyleNormalOnly: true,
    });

    // Add verification stamp in footer
    const totalPages = pdf.getNumberOfPages();
    const verifiedLabel = verified === true ? "מאומת AI ✓" : "לא מאומת";
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(verifiedLabel, margin, pageH - 20);
    }
    pdf.setTextColor(0, 0, 0);

    const buf = Buffer.from(pdf.output("arraybuffer"));
    const fileName = displayFileName(title);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(fileName),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "יצירת PDF נכשלה";
    console.error("יצירת PDF נכשלה:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
