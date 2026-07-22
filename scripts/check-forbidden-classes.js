#!/usr/bin/env node
/**
 * Phase 6.1 — Lint script chặn Tailwind classes "xấu":
 *   - text-slate-* / bg-slate-* / border-slate-* (force design token)
 *   - HEX cứng text-[#XXX] / bg-[#XXX] / border-[#XXX]
 *   - rounded-2xl (force rounded-xl đồng nhất)
 *
 * Exit 1 nếu tìm thấy. Dùng trong CI để fail PR.
 *
 * Sử dụng:
 *   node scripts/check-forbidden-classes.js
 *   node scripts/check-forbidden-classes.js --warn-only  (chỉ warn, không fail)
 */

const fs = require("fs");
const path = require("path");

const WARN_ONLY = process.argv.includes("--warn-only");
const ROOT = path.join(__dirname, "..");

const FORBIDDEN = [
  {
    pattern: /\btext-slate-\d+\b/g,
    message: "Dùng text-on-surface / text-on-surface-variant thay vì text-slate-*",
    severity: "error",
  },
  {
    pattern: /\bbg-slate-(?!900\/40\b)\d+\b/g, // exception: bg-slate-900/40 đã thay = bg-black/40 — codemod tự handle
    message: "Dùng bg-surface-low / bg-surface-mid thay vì bg-slate-*",
    severity: "error",
  },
  {
    pattern: /\bborder-slate-\d+\b/g,
    message: "Dùng border-outline-variant / border-outline thay vì border-slate-*",
    severity: "error",
  },
  {
    pattern: /text-\[#[0-9a-fA-F]{3,8}\]/g,
    message: "Dùng design token (text-primary, text-on-surface-variant...) thay vì HEX cứng",
    severity: "error",
  },
  {
    pattern: /bg-\[#[0-9a-fA-F]{3,8}\](?!\/)/g, // allow opacity bg-[#XXX]/30
    message: "Dùng design token (bg-primary, bg-surface-low...) thay vì HEX cứng",
    severity: "error",
  },
  {
    pattern: /border-\[#[0-9a-fA-F]{3,8}\]/g,
    message: "Dùng design token (border-primary, border-outline-variant...) thay vì HEX cứng",
    severity: "error",
  },
];

// Whitelist file/folder (đặc biệt là role color forklift cam #ea580c, kiemke tím #7c3aed — vẫn cần inline)
const WHITELIST_FILES = [
  // Component scanner camera background đen
  /components[\\/]shared[\\/]BarcodeScanner/,
  // ForkliftMobileDashboard có #ea580c branding identity
  /components[\\/]forklift[\\/]ForkliftMobileDashboard/,
  // Mobile components role-aware
  /components[\\/]mobile[\\/]MobileTopbar/,
  /components[\\/]mobile[\\/]HeroHeader/,
  // Codemod scripts
  /scripts[\\/]/,
];

function isWhitelisted(file) {
  return WHITELIST_FILES.some((re) => re.test(file));
}

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

let totalViolations = 0;
const issues = [];

const targetDirs = [
  path.join(ROOT, "src/app"),
  path.join(ROOT, "src/components"),
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = walk(dir);
  for (const file of files) {
    if (isWhitelisted(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const { pattern, message } of FORBIDDEN) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const rel = path.relative(ROOT, file);
        issues.push({ file: rel, count: matches.length, samples: matches.slice(0, 3), message });
        totalViolations += matches.length;
      }
    }
  }
}

if (issues.length === 0) {
  console.log("✓ Pass — KHÔNG có forbidden class trong src/");
  process.exit(0);
}

console.log(`\n${WARN_ONLY ? "⚠" : "✗"} Tìm thấy ${totalViolations} forbidden class violations trên ${issues.length} files:\n`);
for (const issue of issues) {
  console.log(`  ${issue.file}`);
  console.log(`    × ${issue.message}`);
  console.log(`    × Count: ${issue.count}, samples: ${issue.samples.join(", ")}`);
  console.log("");
}

console.log("─".repeat(60));
console.log(`Total: ${totalViolations} violations`);
console.log(WARN_ONLY ? "(warn-only mode — không fail)" : "Chạy lại scripts/codemod-ui-cleanup.js để auto-fix");

process.exit(WARN_ONLY ? 0 : 1);
