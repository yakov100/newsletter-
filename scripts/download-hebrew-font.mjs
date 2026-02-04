#!/usr/bin/env node
/**
 * מוריד Heebo-Regular.ttf לתמיכה ב־PDF בעברית.
 * הרץ: node scripts/download-hebrew-font.mjs
 * אחר כך האפליקציה טוענת את הגופן מ־/fonts/Heebo-Regular.ttf.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, "..", "public", "fonts");
const outPath = path.join(fontsDir, "Heebo-Regular.ttf");

const URLs = [
  "https://raw.githubusercontent.com/OdedEzer/heebo/main/fonts/ttf/Heebo-Regular.ttf",
  "https://raw.githubusercontent.com/OdedEzer/heebo/master/fonts/ttf/Heebo-Regular.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo-Regular.ttf",
  "https://github.com/google/fonts/raw/main/ofl/heebo/Heebo-Regular.ttf",
];

async function download(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0",
      Accept: "application/octet-stream,*/*",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function main() {
  if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
  function isLikelyFont(buf) {
    if (!buf || buf.length < 100) return false;
    const head = buf.subarray(0, 200).toString("utf8");
    if (/<\s*!?\s*DOCTYPE|<\s*html\s/i.test(head) || head.trimStart().startsWith("<")) return false;
    return true;
  }

  for (const url of URLs) {
    try {
      console.log("מנסה", url);
      const buf = await download(url);
      if (buf && buf.length > 1000 && isLikelyFont(buf)) {
        fs.writeFileSync(outPath, buf);
        console.log("נשמר: public/fonts/Heebo-Regular.ttf");
        return;
      }
      if (buf && !isLikelyFont(buf)) console.warn("התשובה נראית כמו HTML, מדלג.");
    } catch (e) {
      console.warn(e?.message ?? e);
    }
  }
  console.error("לא הצלחתי להוריד את הגופן.");
  console.error("ידני: היכנס ל־https://fonts.google.com/specimen/Heebo → Download family → חלץ את Heebo-Regular.ttf ל־public/fonts/");
  process.exit(1);
}

main();
