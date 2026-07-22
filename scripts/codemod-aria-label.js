#!/usr/bin/env node
/**
 * Phase 6.2 — Auto inject `aria-label` cho icon-only button dựa trên `title`.
 *
 * Pattern: <button onClick={...} title="Xóa" className="..."><span class="material-symbols-outlined">delete</span></button>
 * → Thêm aria-label="Xóa" (nếu chưa có)
 *
 * Heuristic an toàn:
 *   - button có title="..." nhưng KHÔNG có aria-label → add aria-label = title
 */

const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = path.join(__dirname, "..");

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

// Pattern: <button [...stuff_không_chứa_aria-label...] title="X" [...stuff...] >
// → thêm aria-label="X" trước title
//
// Vì JSX phức tạp, dùng regex non-greedy, match đến `>` đầu tiên không nằm trong attribute value.
const BUTTON_WITH_TITLE = /<button\b([^>]*?\btitle=("[^"]+"|'[^']+')[^>]*?)>/g;

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
    let changes = 0;

    content = content.replace(BUTTON_WITH_TITLE, (match, attrs, titleAttr) => {
      // Skip nếu đã có aria-label
      if (/aria-label\s*=/.test(attrs)) return match;
      changes++;
      // Add aria-label sau title
      const titleStr = titleAttr; // bao gồm cả "..." hoặc '...'
      return match.replace(`title=${titleStr}`, `title=${titleStr} aria-label=${titleStr}`);
    });

    if (changes > 0) {
      totalChanged++;
      totalReplacements += changes;
      const rel = path.relative(ROOT, file);
      console.log(`  ${DRY_RUN ? "(dry) " : ""}✓ ${rel}: +${changes} aria-label`);
      if (!DRY_RUN) {
        fs.writeFileSync(file, content);
      }
    }
  }
}

console.log("");
console.log("─".repeat(60));
console.log(`📊 Scan: ${totalFiles} file`);
console.log(`📝 Changed: ${totalChanged} file (${totalReplacements} aria-label thêm)`);
console.log(`💡 Mode: ${DRY_RUN ? "DRY RUN" : "Đã ghi"}`);
