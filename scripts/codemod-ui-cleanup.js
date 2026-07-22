#!/usr/bin/env node
/**
 * Phase 4 codemod — Replace toàn bộ:
 *   1. HEX cứng trong className="text-[#XXX]" / bg-[#XXX] / border-[#XXX] → design token
 *   2. Tailwind slate-* (text/bg/border) → design token
 *   3. Backdrop bg-slate-900/40 → bg-black/40
 *   4. Inline `<style>` keyframe fadeIn/scaleIn (gom vào globals.css)
 *
 * Sử dụng:
 *   node scripts/codemod-ui-cleanup.js
 *   node scripts/codemod-ui-cleanup.js --dry-run   (chỉ xem, không sửa)
 */

const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = path.join(__dirname, "..");

// Map HEX → token (theo globals.css)
const HEX_TO_TOKEN = [
  // Primary navy đen
  [/text-\[#000e24\]/g, "text-primary"],
  [/bg-\[#000e24\]/g, "bg-primary"],
  [/border-\[#000e24\]/g, "border-primary"],
  [/text-\[#022448\]/g, "text-primary-container"],
  [/bg-\[#022448\]/g, "bg-primary-container"],
  [/border-\[#022448\]/g, "border-primary-container"],
  [/text-\[#081a36\]/g, "text-primary-hover"],
  [/bg-\[#081a36\]/g, "bg-primary-hover"],
  [/text-\[#728cb6\]/g, "text-on-primary-container"],

  // Secondary xám xanh
  [/text-\[#455f87\]/g, "text-secondary"],
  [/bg-\[#455f87\]/g, "bg-secondary"],
  [/border-\[#455f87\]/g, "border-secondary"],
  [/text-\[#3e5980\]/g, "text-on-secondary-container"],
  [/bg-\[#3e5980\]/g, "bg-on-secondary-container"],
  [/text-\[#b5d0fd\]/g, "text-secondary-container"],
  [/bg-\[#b5d0fd\]/g, "bg-secondary-container"],

  // Surface
  [/bg-\[#faf9f6\]/g, "bg-bg"],
  [/bg-\[#ffffff\]/g, "bg-surface"],
  [/bg-\[#f4f3f1\]/g, "bg-surface-low"],
  [/bg-\[#efeeeb\]/g, "bg-surface-mid"],
  [/bg-\[#e9e8e5\]/g, "bg-surface-high"],
  [/bg-\[#e3e2e0\]/g, "bg-surface-variant"],
  [/border-\[#e3e2e0\]/g, "border-surface-variant"],
  [/border-\[#e7e5e0\]/g, "border-outline-variant"], // close enough

  // On-surface
  [/text-\[#1a1c1a\]/g, "text-on-surface"],
  [/text-\[#43474e\]/g, "text-on-surface-variant"],

  // Outline
  [/text-\[#74777f\]/g, "text-outline"],
  [/bg-\[#74777f\]/g, "bg-outline"],
  [/border-\[#74777f\]/g, "border-outline"],
  [/text-\[#c4c6cf\]/g, "text-outline-variant"],
  [/bg-\[#c4c6cf\]/g, "bg-outline-variant"],
  [/border-\[#c4c6cf\]/g, "border-outline-variant"],

  // Error
  [/text-\[#ba1a1a\]/g, "text-error"],
  [/bg-\[#ba1a1a\]/g, "bg-error"],
  [/border-\[#ba1a1a\]/g, "border-error"],
  [/bg-\[#ffdad6\]/g, "bg-error-container"],

  // Success
  [/text-\[#3b9d56\]/g, "text-success"],
  [/bg-\[#3b9d56\]/g, "bg-success"],
  [/border-\[#3b9d56\]/g, "border-success"],
  [/bg-\[#95f8a7\]/g, "bg-success-container"],

  // Warning
  [/text-\[#f0ad4e\]/g, "text-warning"],
  [/bg-\[#f0ad4e\]/g, "bg-warning"],
  [/border-\[#f0ad4e\]/g, "border-warning"],

  // Opacity variants thường gặp
  [/text-\[#022448\]\/(\d+)/g, "text-primary-container/$1"],
  [/bg-\[#022448\]\/(\d+)/g, "bg-primary-container/$1"],
  [/bg-\[#ffdad6\]\/(\d+)/g, "bg-error-container/$1"],
  [/bg-\[#95f8a7\]\/(\d+)/g, "bg-success-container/$1"],
];

// Map slate-* → design token
const SLATE_TO_TOKEN = [
  [/\btext-slate-300\b/g, "text-on-surface-variant/50"],
  [/\btext-slate-400\b/g, "text-on-surface-variant/70"],
  [/\btext-slate-500\b/g, "text-on-surface-variant"],
  [/\btext-slate-600\b/g, "text-on-surface-variant"],
  [/\btext-slate-700\b/g, "text-on-surface"],
  [/\btext-slate-800\b/g, "text-on-surface"],
  [/\btext-slate-900\b/g, "text-on-surface"],
  [/\bbg-slate-50\b/g, "bg-surface-low"],
  [/\bbg-slate-100\b/g, "bg-surface-low"],
  [/\bbg-slate-200\b/g, "bg-surface-mid"],
  [/\bbg-slate-300\b/g, "bg-surface-mid"],
  [/\bbg-slate-400\b/g, "bg-outline-variant"],
  [/\bbg-slate-700\b/g, "bg-primary-hover"],
  [/\bbg-slate-800\b/g, "bg-primary"],
  [/\bbg-slate-900\/40\b/g, "bg-black/40"],
  [/\bbg-slate-900\/50\b/g, "bg-black/50"],
  [/\bbg-slate-900\b/g, "bg-primary"],   // dark bg → primary navy
  [/\bborder-slate-100\b/g, "border-outline-variant/50"],
  [/\bborder-slate-200\b/g, "border-outline-variant"],
  [/\bborder-slate-300\b/g, "border-outline-variant"],
  [/\bborder-slate-400\b/g, "border-outline-variant"],
  [/\bborder-slate-900\b/g, "border-primary"],
];

const ALL_REPLACEMENTS = [...HEX_TO_TOKEN, ...SLATE_TO_TOKEN];

// Walk thư mục
function walk(dir) {
  const results = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item === "node_modules" || item === ".next" || item.startsWith(".next-")) continue;
      results.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(item)) {
      results.push(full);
    }
  }
  return results;
}

const targetDirs = [
  path.join(ROOT, "src/app"),
  path.join(ROOT, "src/components"),
];

let totalFiles = 0;
let totalChanged = 0;
let totalReplacements = 0;

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = walk(dir);
  for (const file of files) {
    totalFiles++;
    let content = fs.readFileSync(file, "utf8");
    const original = content;
    let changes = 0;
    for (const [pattern, replacement] of ALL_REPLACEMENTS) {
      const matches = content.match(pattern);
      if (matches) {
        changes += matches.length;
        content = content.replace(pattern, replacement);
      }
    }
    if (changes > 0) {
      totalChanged++;
      totalReplacements += changes;
      const rel = path.relative(ROOT, file);
      console.log(`  ${DRY_RUN ? "(dry) " : ""}✓ ${rel}: ${changes} replacements`);
      if (!DRY_RUN) {
        fs.writeFileSync(file, content);
      }
    }
  }
}

console.log("");
console.log("─".repeat(60));
console.log(`📊 Scan: ${totalFiles} file .tsx/.ts`);
console.log(`📝 Changed: ${totalChanged} file (${totalReplacements} replacements)`);
console.log(`💡 Mode: ${DRY_RUN ? "DRY RUN — chưa ghi" : "Đã ghi vào disk"}`);
if (DRY_RUN) console.log("→ Bỏ flag --dry-run để áp dụng thật.");
