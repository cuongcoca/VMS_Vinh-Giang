#!/usr/bin/env node
/**
 * Tablet responsive codemod — nâng font size 10/11px lên 12px (text-xs) trên iPad+
 *
 * Replace (idempotent — skip nếu đã có md:text-):
 *   text-[10px]  →  text-[10px] md:text-xs
 *   text-[11px]  →  text-[11px] md:text-xs
 *
 * Mục đích: pass App Store / Google Play review về readability trên iPad retina.
 * Phone UX không bị phá (text-[10/11px] giữ nguyên trên mobile).
 *
 * Usage:
 *   node scripts/codemod-tablet-fontsize.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = path.join(__dirname, "..");

// Match text-[10px] / text-[11px] but NOT if already followed by md:text-
// Negative lookahead để idempotent
const PATTERNS = [
  {
    re: /(\btext-\[10px\])(?!\s+md:text-)/g,
    replace: "text-[10px] md:text-xs",
  },
  {
    re: /(\btext-\[11px\])(?!\s+md:text-)/g,
    replace: "text-[11px] md:text-xs",
  },
];

function walk(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
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

// Scope: tất cả page mobile + admin (vì admin cũng có thể xem trên tablet)
const targetDirs = [
  path.join(ROOT, "src/app/thukho"),
  path.join(ROOT, "src/app/forklift"),
  path.join(ROOT, "src/app/kiemke"),
  path.join(ROOT, "src/components/thukho"),
  path.join(ROOT, "src/components/forklift"),
  path.join(ROOT, "src/components/kiemke"),
  path.join(ROOT, "src/components/mobile"),
  path.join(ROOT, "src/components/shared"),
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
    let changes = 0;

    for (const { re, replace } of PATTERNS) {
      const matches = content.match(re);
      if (matches) {
        changes += matches.length;
        content = content.replace(re, replace);
      }
    }

    if (changes > 0) {
      totalChanged++;
      totalReplacements += changes;
      const rel = path.relative(ROOT, file);
      console.log(`  ${DRY_RUN ? "(dry) " : ""}✓ ${rel}: +${changes} md:text-xs`);
      if (!DRY_RUN) {
        fs.writeFileSync(file, content);
      }
    }
  }
}

console.log("");
console.log("─".repeat(60));
console.log(`📊 Scan: ${totalFiles} file`);
console.log(`📝 Changed: ${totalChanged} file (+${totalReplacements} tablet font hint)`);
console.log(`💡 Mode: ${DRY_RUN ? "DRY RUN" : "Đã ghi"}`);
