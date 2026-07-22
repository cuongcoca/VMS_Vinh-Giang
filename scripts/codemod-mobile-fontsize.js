#!/usr/bin/env node
/**
 * Phase 5 codemod #3 — Nâng font-size mobile để đạt min readable.
 *
 * Replace:
 *   - text-[9px] → text-[11px]
 *   - text-[10px] trong context info quan trọng → text-[11px]
 *   - Nâng tap target nhỏ (giữ nguyên các icon size)
 *
 * Chỉ áp dụng cho mobile pages (thukho/forklift/kiemke).
 */

const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = path.join(__dirname, "..");

// Patterns text size
const PATTERNS = [
  // text-[9px] → text-[11px] (luôn nâng để readable)
  [/text-\[9px\]/g, "text-[11px]"],
  // text-[8px] → text-[10px] (nâng nhưng nhẹ hơn)
  [/text-\[8px\]/g, "text-[10px]"],
];

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
  path.join(ROOT, "src/app/thukho"),
  path.join(ROOT, "src/app/forklift"),
  path.join(ROOT, "src/app/kiemke"),
  path.join(ROOT, "src/components/forklift"),
  path.join(ROOT, "src/components/shared"),
  path.join(ROOT, "src/components/mobile"),
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

    for (const [pattern, replacement] of PATTERNS) {
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
      console.log(`  ${DRY_RUN ? "(dry) " : ""}✓ ${rel}: ${changes} font-size nâng`);
      if (!DRY_RUN) {
        fs.writeFileSync(file, content);
      }
    }
  }
}

console.log("");
console.log("─".repeat(60));
console.log(`📊 Scan: ${totalFiles} file mobile`);
console.log(`📝 Changed: ${totalChanged} file (${totalReplacements} text size nâng)`);
console.log(`💡 Mode: ${DRY_RUN ? "DRY RUN" : "Đã ghi"}`);
