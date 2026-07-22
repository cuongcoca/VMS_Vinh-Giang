#!/usr/bin/env node
/**
 * Phase 4 codemod #2 — Auto replace alert() → toast.error()/warning()/success()
 * + Tự inject import useToast + hook const { toast } = useToast();
 *
 * Lưu ý: confirm() KHÔNG xử lý tự động (cần async/await + Promise).
 *
 * Sử dụng:
 *   node scripts/codemod-alert-to-toast.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = path.join(__dirname, "..");

// Replace patterns (chỉ alert, không xử lý confirm vì cần async)
const ALERT_PATTERNS = [
  [/alert\(("Vui lòng[^"]+"|"Chọn[^"]+"|"Nhập[^"]+"|"Mời[^"]+")\)/g, "toast.warning($1)"],
  [/alert\(("Đã[^"]+"|"Thành công[^"]+"|"Tạo thành công[^"]+"|"Hoàn tất[^"]+")\)/g, "toast.success($1)"],
  [/alert\(([^)]+)\)/g, "toast.error($1)"],
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

function ensureUseToast(content) {
  let changed = false;

  // Add import nếu thiếu
  const hasUiImport = /from\s+["']@\/components\/ui["']/.test(content);
  const hasUseToastImport = /useToast/.test(content);
  if (!hasUseToastImport) {
    // Tìm dòng "use client" hoặc dòng import đầu tiên
    if (/^"use client";/m.test(content)) {
      content = content.replace(/("use client";)/, `$1\nimport { useToast } from "@/components/ui";`);
    } else if (/^import /m.test(content)) {
      content = content.replace(/(^import [^\n]+;\n)/m, `$1import { useToast } from "@/components/ui";\n`);
    } else {
      content = `import { useToast } from "@/components/ui";\n` + content;
    }
    changed = true;
  }

  // Add hook const { toast } = useToast(); nếu thiếu
  const hasToastHook = /const\s*\{\s*toast\s*[},:]/.test(content);
  if (!hasToastHook) {
    // Tìm function/component có dùng toast. Inject sau dòng có `function ComponentName(` hoặc `= (...) =>` hoặc `= () => {` ngay bên trong body
    // Heuristic: thêm vào trước useState/useEffect đầu tiên
    const stateMatch = content.match(/(\n\s+)(const\s+\[\s*\w+\s*,\s*set\w+\s*\]\s*=\s*useState)/);
    if (stateMatch) {
      content = content.replace(stateMatch[0], `${stateMatch[1]}const { toast } = useToast();${stateMatch[0]}`);
      changed = true;
    } else {
      // Fallback: tìm `export default function NAME(...) {` rồi thêm const ngay sau {
      const fnMatch = content.match(/(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{)/);
      if (fnMatch) {
        content = content.replace(fnMatch[0], `${fnMatch[0]}\n  const { toast } = useToast();`);
        changed = true;
      }
    }
  }

  return { content, changed };
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

    // Skip nếu không có alert
    if (!/\balert\s*\(/.test(content)) continue;

    let changes = 0;
    for (const [pattern, replacement] of ALERT_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        changes += matches.length;
        content = content.replace(pattern, replacement);
      }
    }

    if (changes > 0) {
      // Auto-inject import + hook
      const { content: enriched, changed: enrichChanged } = ensureUseToast(content);
      content = enriched;

      totalChanged++;
      totalReplacements += changes;
      const rel = path.relative(ROOT, file);
      console.log(`  ${DRY_RUN ? "(dry) " : ""}✓ ${rel}: ${changes} alert → toast${enrichChanged ? "  ➜ injected import+hook" : ""}`);
      if (!DRY_RUN) {
        fs.writeFileSync(file, content);
      }
    }
  }
}

console.log("");
console.log("─".repeat(60));
console.log(`📊 Scan: ${totalFiles} file`);
console.log(`📝 Changed: ${totalChanged} file (${totalReplacements} alert() replaced)`);
console.log(`💡 Mode: ${DRY_RUN ? "DRY RUN" : "Đã ghi"}`);
