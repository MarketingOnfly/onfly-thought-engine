#!/usr/bin/env node
/**
 * Extrai texto de PDFs usando pdfjs-dist (já está no node_modules do projeto).
 * Saída: arquivos .txt em ./pdf-extracts/, um por PDF.
 *
 * Uso:
 *   node scripts/extract-pdfs.mjs "C:\caminho\pra\pasta\com\pdfs"
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SRC_DIR = process.argv[2];
if (!SRC_DIR) {
  console.error("Uso: node scripts/extract-pdfs.mjs <pasta com PDFs>");
  process.exit(1);
}

const OUT_DIR = path.resolve("pdf-extracts");
if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

const files = (await readdir(SRC_DIR)).filter((f) => f.toLowerCase().endsWith(".pdf"));
console.log(`Encontrei ${files.length} PDFs em ${SRC_DIR}`);

for (const f of files) {
  const inPath = path.join(SRC_DIR, f);
  const outName = f.replace(/\.pdf$/i, ".txt");
  const outPath = path.join(OUT_DIR, outName);

  if (existsSync(outPath)) {
    console.log(`✓ já extraído: ${outName}`);
    continue;
  }

  try {
    const buf = await readFile(inPath);
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items;
      const text = items
        .map((it) => (typeof it.str === "string" ? it.str : ""))
        .filter(Boolean)
        .join(" ");
      pageTexts.push(`--- page ${i} ---\n${text.trim()}`);
    }
    await pdf.destroy();
    const all = pageTexts.join("\n\n");
    await writeFile(outPath, all, "utf8");
    console.log(`✓ ${outName} (${pdf.numPages} pg, ${all.length} chars)`);
  } catch (err) {
    console.error(`❌ ${f}: ${err.message}`);
  }
}

console.log(`\nFeito. Saída em: ${OUT_DIR}`);
