#!/usr/bin/env node
/**
 * sheet-ops.js — Wrapper Google Sheets API cho auto-fix automation.
 *
 * Đọc/ghi sheet test cases của WMS Vĩnh Giang để tự động:
 *   1. Tìm test case FAIL kế tiếp chưa được fix
 *   2. Mark dev-completed sau khi Claude fix xong
 *   3. Ghi note manual-review khi auto fix thất bại
 *
 * Setup:
 *   1. Đặt service account key tại `.secrets/google-sheet-key.json`
 *   2. Share Google Sheet với email service account (Editor)
 *   3. Chạy `node scripts/sheet-ops.js inspect` 1 lần để xem cấu trúc sheet
 *   4. Điền CONFIG.columns bên dưới theo header thật của sheet
 *
 * Usage:
 *   node scripts/sheet-ops.js inspect              # Xem cấu trúc sheet (header + 3 row đầu)
 *   node scripts/sheet-ops.js next-fail            # JSON của row FAIL đầu tiên chưa done
 *   node scripts/sheet-ops.js mark-done <row>      # Tick checkbox dev-completed
 *   node scripts/sheet-ops.js add-note <row> <txt> # Thêm note vào cột Note
 *   node scripts/sheet-ops.js status               # Đếm FAIL/PASS/DONE
 *   node scripts/sheet-ops.js dump-csv             # Export sheet sang stdout (debug)
 */

const path = require("path");
const fs = require("fs");

let google;
try {
  ({ google } = require("googleapis"));
} catch (e) {
  console.error("❌ Chưa cài googleapis. Chạy: npm install googleapis");
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────────
// CONFIG — sửa sau khi chạy `inspect` để biết header thật
// ────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Sheet ID lấy từ URL: docs.google.com/spreadsheets/d/<THIS>/edit
  spreadsheetId: "1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog",

  // Tab name. `inspect` sẽ list tabs có sẵn.
  // Để null → đọc tab đầu tiên.
  // Có thể override qua env var: SHEET_TAB=MD02 node scripts/sheet-ops.js inspect
  sheetName: process.env.SHEET_TAB || null,

  // Header row số (1-indexed). Sheet này có row 1-11 là summary + blank,
  // header thực tế của testcase ở row 12.
  headerRow: 12,

  // Map column NAME (in header row) → semantic role.
  // Tên cột tiếng Việt — match exact header row 11 của sheet WMS Vinh Giang.
  columns: {
    test_id: "TESTCASE ID",             // TC_MD_001
    module: null,                       // không có cột Module riêng — derive từ tab name
    status: "Trạng thái",               // PASS/FAIL/Not run
    error_message: "Kết quả thực tế",   // mô tả lỗi thực tế
    steps_to_repro: "Các bước thực hiện",
    expected: "Kết quả mong muốn",
    actual: "Kết quả thực tế",
    dev_completed: "Dev",               // checkbox tick khi đã fix
    note: "Ghi chú",
    purpose: "Tên testcase(Mục đích)",  // tiêu đề ngắn của TC
    priority: "Độ ưu tiên",
  },

  // Status value coi là FAIL (case-insensitive)
  // "rejected" = Tester bác kết quả → vẫn phải fix lại như FAIL
  failStatusValues: ["fail", "failed", "rejected", "reject"],

  // Nhận diện row test case thật (loại divider/blank). Sheet dùng 2 format test_id:
  //   • "TC_ADD_017"      → bắt đầu bằng "TC_"
  //   • "UC-OUT-01_TC01"  → chứa "_TC" + số
  // Divider rows ("UC-OUT-01 Xem hàng...", "Khu chờ xuất & BC", "Up file...") không khớp.
  // FIX: pattern cũ /^TC_/i bỏ sót toàn bộ test "UC-..._TCnn" → next-fail mù, báo done sai.
  testIdPattern: /(^TC_)|(_TC\d)/i,

  // Tabs chứa test cases — quét cả MD01→MD11 (user yêu cầu không bỏ sót).
  // Tab nào không có cột TESTCASE ID/Trạng thái/Dev (vd summary) sẽ tự được skip an toàn.
  testCaseTabs: ["MD01", "MD02", "MD03", "MD04", "MD05", "MD06", "MD07 ", "MD08", "MD09", "MD10", "MD11"],

  // Range giới hạn
  range: "A:Y",
};

const KEY_PATH = path.join(__dirname, "..", ".secrets", "google-sheet-key.json");

// ────────────────────────────────────────────────────────────────────
// Auth + client
// ────────────────────────────────────────────────────────────────────
async function getSheetsClient() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`❌ Key file không tồn tại: ${KEY_PATH}`);
    console.error("   Xem docs/AUTOMATION_SETUP_GUIDE_USER.md mục 2.1 để lấy key.");
    process.exit(1);
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

async function getSheetName(sheets) {
  if (CONFIG.sheetName) return CONFIG.sheetName;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: CONFIG.spreadsheetId });
  const first = meta.data.sheets?.[0]?.properties?.title;
  if (!first) throw new Error("Không tìm thấy tab nào trong sheet");
  return first;
}

async function fetchRows(sheets) {
  const sheetName = await getSheetName(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${sheetName}!${CONFIG.range}`,
  });
  const rows = res.data.values || [];
  return { sheetName, rows };
}

function colIndex(header, name) {
  if (!name) return -1;
  // Tìm exact match trước, sau đó case-insensitive equals, sau đó contains.
  let idx = header.indexOf(name);
  if (idx !== -1) return idx;
  const lower = name.toLowerCase();
  idx = header.findIndex((h) => (h || "").toLowerCase() === lower);
  if (idx !== -1) return idx;
  return header.findIndex((h) => (h || "").toLowerCase().includes(lower));
}

function colLetter(index) {
  // 0 → A, 25 → Z, 26 → AA
  let s = "";
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// Quy tắc user: cột Trạng thái CÓ CHỮ "Fail"/"FAIL" (hoặc "Reject") → coi là fail.
// Dùng contains (không exact) để không bỏ sót "Failed", "Fail - lý do…", v.v.
function isFailValue(v) {
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s.includes("fail") || s.includes("reject");
}

function isTruthy(v) {
  if (v == null || v === "") return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "x" || s === "✓" || s === "yes" || s === "done";
}

// Dev column ở sheet WMS có 3 stage: Fixed | Dev completed | Finished.
// Coi như đã xử lý nếu cell có BẤT KỲ value không-rỗng (loại "no", "n/a").
function isDevDone(v) {
  if (v == null || v === "") return false;
  const s = String(v).trim().toLowerCase();
  if (s === "no" || s === "n/a" || s === "-") return false;
  // "Rejected" = Tester bác fix → coi như CHƯA done, phải fix lại + re-deploy như thường
  if (s.includes("reject")) return false;
  return true;
}

// Dev col chứa "Rejected" → cần fix lại bất kể status (Tester bác bài fix trước)
function isDevRejected(v) {
  if (v == null) return false;
  return String(v).trim().toLowerCase().includes("reject");
}

// Quy tắc user: CHỈ "Dev-Completed" (mọi biến thể hoa/thường/space/gạch) mới là ĐÃ XONG.
// Mọi giá trị Dev khác (rỗng, Fixed, Finished, Rejected…) → coi như CHƯA xong → phải fix.
function isDevCompleted(v) {
  if (v == null) return false;
  return String(v).trim().toLowerCase().replace(/[\s_]+/g, "-") === "dev-completed";
}

// Đọc skipped_test_ids từ state.json — cho phép next-fail/list-fails BỎ QUA các test
// cần human review (vd: feature chưa hiện thực, quyết định sản phẩm) mà KHÔNG phải đánh
// dấu Dev-Completed → giữ trạng thái FAIL trung thực trên sheet.
function loadSkipSet() {
  try {
    const p = path.join(__dirname, "auto-fix-state.json");
    const st = JSON.parse(fs.readFileSync(p, "utf8"));
    return new Set((st.skipped_test_ids || []).map((s) => String(s).trim().toLowerCase()));
  } catch {
    return new Set();
  }
}

// ────────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────────

async function cmdInspect() {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: CONFIG.spreadsheetId });
  console.log("📋 Tabs trong spreadsheet:");
  for (const s of meta.data.sheets || []) {
    console.log(`   • ${s.properties.title}  (${s.properties.gridProperties.rowCount} rows × ${s.properties.gridProperties.columnCount} cols)`);
  }

  const { sheetName, rows } = await fetchRows(sheets);
  console.log(`\n📄 Đọc tab: ${sheetName}`);
  console.log(`   Tổng rows: ${rows.length}`);

  if (rows.length === 0) {
    console.log("   (Sheet rỗng)");
    return;
  }
  console.log("\n📑 Header row (row 1):");
  rows[0].forEach((h, i) => console.log(`   ${colLetter(i).padEnd(3)} [${i}] ${h}`));

  console.log("\n📊 3 row đầu (sample):");
  for (let i = 1; i <= Math.min(3, rows.length - 1); i++) {
    console.log(`\n   Row ${i + 1}:`);
    rows[i].forEach((v, j) => {
      const head = rows[0][j] || `(col ${j})`;
      const val = String(v || "").slice(0, 80);
      console.log(`     ${head}: ${val}`);
    });
  }

  console.log("\n💡 Sau khi xem, sửa `CONFIG.columns` trong scripts/sheet-ops.js cho khớp header thực tế.");
  console.log("   Sau đó chạy `node scripts/sheet-ops.js next-fail` để test.");
}

/**
 * Tìm FAIL kế tiếp.
 * Nếu CONFIG.sheetName set → tìm trong 1 tab.
 * Nếu null → quét tuần tự CONFIG.testCaseTabs.
 */
async function cmdNextFail() {
  const sheets = await getSheetsClient();
  const tabsToScan = CONFIG.sheetName ? [CONFIG.sheetName] : CONFIG.testCaseTabs;
  const skipSet = loadSkipSet();

  for (const tabName of tabsToScan) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!${CONFIG.range}`,
    });
    const rows = res.data.values || [];
    if (rows.length < CONFIG.headerRow) continue;

    const header = rows[CONFIG.headerRow - 1]; // 1-indexed → array index
    const cols = {};
    for (const [key, name] of Object.entries(CONFIG.columns)) {
      cols[key] = name ? colIndex(header, name) : -1;
    }

    if (cols.status === -1 || cols.dev_completed === -1 || cols.test_id === -1) {
      // Header không khớp tab này — có thể tab có structure khác. Skip.
      continue;
    }

    // Scan từ row sau header
    for (let i = CONFIG.headerRow; i < rows.length; i++) {
      const r = rows[i];
      const testId = (r[cols.test_id] || "").toString().trim();
      // Skip rows không phải test case (UC- divider, blank...)
      if (!CONFIG.testIdPattern.test(testId)) continue;
      // Bỏ qua test đã đưa vào skipped_test_ids (human review / feature chưa làm)
      if (skipSet.has(testId.toLowerCase())) continue;

      const status = r[cols.status];
      const devDone = r[cols.dev_completed];
      // Pick nếu: (status FAIL/Rejected) HOẶC (Dev col = Rejected), VÀ chưa done
      if ((isFailValue(status) || isDevRejected(devDone)) && !isDevCompleted(devDone)) {
        const result = {
          tab: tabName,
          row_number: i + 1,
          test_id: testId,
          module: tabName, // derive từ tab name
          purpose: r[cols.purpose] || "",
          priority: r[cols.priority] || "",
          status: status,
          error_message: r[cols.error_message] || "",
          steps_to_repro: r[cols.steps_to_repro] || "",
          expected: r[cols.expected] || "",
          actual: r[cols.actual] || "",
          note: r[cols.note] || "",
        };
        console.log(JSON.stringify(result, null, 2));
        return;
      }
    }
  }
  console.log(JSON.stringify({ done: true, reason: "no more FAIL rows across all tabs" }));
}

/**
 * Dump TẤT CẢ pending fail (FAIL/Rejected & chưa done) dạng JSON array.
 * Dùng cho batch mode — brief nhiều agent 1 lượt.
 * Usage: node sheet-ops.js list-fails [tab]
 */
async function cmdListFails(onlyTab) {
  const sheets = await getSheetsClient();
  const tabsToScan = onlyTab ? [onlyTab] : (CONFIG.sheetName ? [CONFIG.sheetName] : CONFIG.testCaseTabs);
  const skipSet = loadSkipSet();
  const out = [];
  for (const tabName of tabsToScan) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!${CONFIG.range}`,
    });
    const rows = res.data.values || [];
    if (rows.length < CONFIG.headerRow) continue;
    const header = rows[CONFIG.headerRow - 1];
    const cols = {};
    for (const [key, name] of Object.entries(CONFIG.columns)) {
      cols[key] = name ? colIndex(header, name) : -1;
    }
    if (cols.status === -1 || cols.dev_completed === -1 || cols.test_id === -1) continue;
    for (let i = CONFIG.headerRow; i < rows.length; i++) {
      const r = rows[i];
      const testId = (r[cols.test_id] || "").toString().trim();
      if (!CONFIG.testIdPattern.test(testId)) continue;
      if (skipSet.has(testId.toLowerCase())) continue;
      const status = r[cols.status];
      const devDone = r[cols.dev_completed];
      if ((isFailValue(status) || isDevRejected(devDone)) && !isDevCompleted(devDone)) {
        out.push({
          tab: tabName,
          row_number: i + 1,
          test_id: testId,
          purpose: r[cols.purpose] || "",
          priority: r[cols.priority] || "",
          status: status || "",
          dev: devDone || "",
          error_message: r[cols.error_message] || "",
          steps_to_repro: r[cols.steps_to_repro] || "",
          expected: r[cols.expected] || "",
          note: r[cols.note] || "",
        });
      }
    }
  }
  console.log(JSON.stringify({ count: out.length, fails: out }, null, 2));
}

/**
 * Mark Dev column = "Dev completed" (khớp summary status trong sheet WMS).
 * Cần cả tab name vì sheet có nhiều tab — caller truyền `tab:row` hoặc dùng default tab.
 *
 * Usage:
 *   mark-done 40            (dùng default tab CONFIG.sheetName, hoặc tab đầu trong testCaseTabs)
 *   mark-done MD02:40       (chỉ định tab cụ thể)
 */
async function cmdMarkDone(rowSpec, customValue) {
  if (!rowSpec) { console.error("Usage: mark-done <[tab:]row> [value]"); process.exit(1); }
  const [tabPart, rowPart] = rowSpec.includes(":") ? rowSpec.split(":") : [null, rowSpec];
  const rowNumber = parseInt(rowPart);
  if (isNaN(rowNumber)) { console.error(`Invalid row: ${rowPart}`); process.exit(1); }

  const sheets = await getSheetsClient();
  const sheetName = tabPart || CONFIG.sheetName || CONFIG.testCaseTabs[0];
  const value = customValue ?? "Dev-Completed";

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${sheetName}!${CONFIG.headerRow}:${CONFIG.headerRow}`,
  });
  const header = headerRes.data.values?.[0] || [];
  const idx = colIndex(header, CONFIG.columns.dev_completed);
  if (idx === -1) {
    console.error(`Cannot find column "${CONFIG.columns.dev_completed}" in tab ${sheetName}`);
    process.exit(1);
  }
  const range = `${sheetName}!${colLetter(idx)}${rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
  console.log(JSON.stringify({ success: true, tab: sheetName, row: rowNumber, range, value }));
}

/**
 * Clear Dev column (revert mark-done). Useful cho testing write capability.
 */
async function cmdUnmarkDone(rowSpec) {
  return cmdMarkDone(rowSpec, "");
}

async function cmdAddNote(rowSpec, ...textParts) {
  if (!rowSpec) { console.error('Usage: add-note <[tab:]row> "<note text>"'); process.exit(1); }
  const [tabPart, rowPart] = rowSpec.includes(":") ? rowSpec.split(":") : [null, rowSpec];
  const rowNumber = parseInt(rowPart);
  if (isNaN(rowNumber)) { console.error(`Invalid row: ${rowPart}`); process.exit(1); }
  const text = textParts.join(" ").trim();
  if (!text) { console.error("Note text empty"); process.exit(1); }
  const sheets = await getSheetsClient();
  const sheetName = tabPart || CONFIG.sheetName || CONFIG.testCaseTabs[0];
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${sheetName}!${CONFIG.headerRow}:${CONFIG.headerRow}`,
  });
  const header = headerRes.data.values?.[0] || [];
  const idx = colIndex(header, CONFIG.columns.note);
  if (idx === -1) {
    console.error(`❌ Không tìm thấy cột "${CONFIG.columns.note}"`);
    process.exit(1);
  }
  // Đọc note hiện tại để append (không ghi đè)
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${sheetName}!${colLetter(idx)}${rowNumber}`,
  });
  const existing = existingRes.data.values?.[0]?.[0] || "";
  const stamped = `[${new Date().toISOString().slice(0, 16)}] ${text}`;
  const combined = existing ? `${existing}\n${stamped}` : stamped;

  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${sheetName}!${colLetter(idx)}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[combined]] },
  });
  console.log(JSON.stringify({ success: true, row: rowNumber, note_appended: stamped }));
}

async function cmdStatus() {
  const sheets = await getSheetsClient();
  const tabsToScan = CONFIG.sheetName ? [CONFIG.sheetName] : CONFIG.testCaseTabs;
  const perTab = {};
  const total = { tabs: tabsToScan.length, total: 0, FAIL: 0, PASS: 0, NOT_RUN: 0, OTHER: 0, dev_completed: 0, fail_pending: 0 };

  for (const tabName of tabsToScan) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!${CONFIG.range}`,
    });
    const rows = res.data.values || [];
    if (rows.length < CONFIG.headerRow) { perTab[tabName] = { error: "no header" }; continue; }
    const header = rows[CONFIG.headerRow - 1];
    const cs = colIndex(header, CONFIG.columns.status);
    const cd = colIndex(header, CONFIG.columns.dev_completed);
    const ct = colIndex(header, CONFIG.columns.test_id);
    if (cs === -1 || ct === -1) { perTab[tabName] = { error: "missing status/test_id col" }; continue; }
    const tc = { total: 0, FAIL: 0, PASS: 0, NOT_RUN: 0, OTHER: 0, dev_completed: 0, fail_pending: 0 };
    for (let i = CONFIG.headerRow; i < rows.length; i++) {
      const r = rows[i];
      const testId = (r[ct] || "").toString().trim();
      if (!CONFIG.testIdPattern.test(testId)) continue;
      tc.total++;
      const st = (r[cs] || "").toString().trim().toLowerCase();
      if (CONFIG.failStatusValues.includes(st)) tc.FAIL++;
      else if (st === "pass" || st === "passed") tc.PASS++;
      else if (st === "not run" || st === "notrun" || st === "skip" || st === "skipped") tc.NOT_RUN++;
      else tc.OTHER++;
      const devCell = cd !== -1 ? r[cd] : null;
      if (cd !== -1 && isDevDone(devCell)) tc.dev_completed++;
      if ((CONFIG.failStatusValues.includes(st) || isDevRejected(devCell)) && (cd === -1 || !isDevDone(devCell))) tc.fail_pending++;
    }
    perTab[tabName] = tc;
    for (const k of Object.keys(tc)) total[k] = (total[k] || 0) + tc[k];
  }

  console.log(JSON.stringify({ total, per_tab: perTab }, null, 2));
}

/**
 * Liệt kê các testcase CHƯA có trạng thái (ô "Trạng thái" trống) — dùng cho QA execution.
 * Usage: node sheet-ops.js list-untested [tab]
 */
async function cmdListUntested(onlyTab) {
  const sheets = await getSheetsClient();
  const tabsToScan = onlyTab ? [onlyTab] : (CONFIG.sheetName ? [CONFIG.sheetName] : CONFIG.testCaseTabs);
  const out = [];
  for (const tabName of tabsToScan) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!${CONFIG.range}`,
    });
    const rows = res.data.values || [];
    if (rows.length < CONFIG.headerRow) continue;
    const header = rows[CONFIG.headerRow - 1];
    const cols = {};
    for (const [key, name] of Object.entries(CONFIG.columns)) {
      cols[key] = name ? colIndex(header, name) : -1;
    }
    if (cols.status === -1 || cols.test_id === -1) continue;
    for (let i = CONFIG.headerRow; i < rows.length; i++) {
      const r = rows[i];
      const testId = (r[cols.test_id] || "").toString().trim();
      const status = (r[cols.status] || "").toString().trim();
      if (status !== "") continue; // chỉ lấy ô TRỐNG (chưa test)
      // Real case = ID khớp pattern HOẶC có Các bước / Kết quả mong muốn.
      // (regex test_id vẫn sót vài format ID lạ → dựa thêm nội dung để không bỏ sót case nào.)
      const steps = (r[cols.steps_to_repro] || "").toString().trim();
      const expected = (r[cols.expected] || "").toString().trim();
      if (!CONFIG.testIdPattern.test(testId) && !steps && !expected) continue;
      out.push({
        tab: tabName,
        row_number: i + 1, // = sheet row (index trong values.get, KHÔNG bị lệch như CSV dump)
        test_id: testId,
        purpose: r[cols.purpose] || "",
        priority: r[cols.priority] || "",
        steps_to_repro: r[cols.steps_to_repro] || "",
        expected: r[cols.expected] || "",
        note: r[cols.note] || "",
      });
    }
  }
  console.log(JSON.stringify({ count: out.length, untested: out }, null, 2));
}

/**
 * Ghi PASS/FAIL vào cột "Trạng thái" (QA execution). Tùy chọn ghi "Kết quả thực tế".
 * Verify: đọc lại cell + test_id của row đó để chống ghi nhầm dòng.
 * Usage:
 *   mark-status MD02:40 PASS
 *   mark-status MD02:40 FAIL "Nút lưu không phản hồi, console báo 500"
 */
async function cmdMarkStatus(rowSpec, value, ...actualParts) {
  if (!rowSpec || !value) { console.error('Usage: mark-status <[tab:]row|test_id> <PASS|FAIL|CLEAR> ["actual result"]'); process.exit(1); }
  const writeValue = /^CLEAR$/i.test(value) ? "" : value;
  const [tabPart, rowPart] = rowSpec.includes(":") ? rowSpec.split(":") : [null, rowSpec];
  const sheets = await getSheetsClient();
  const sheetName = tabPart || CONFIG.sheetName || CONFIG.testCaseTabs[0];

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${sheetName}!${CONFIG.headerRow}:${CONFIG.headerRow}`,
  });
  const header = headerRes.data.values?.[0] || [];
  const si = colIndex(header, CONFIG.columns.status);
  if (si === -1) { console.error(`Cannot find status column "${CONFIG.columns.status}" in ${sheetName}`); process.exit(1); }
  const ti = colIndex(header, CONFIG.columns.test_id);

  // Resolve row: numeric → dùng trực tiếp; non-numeric → tra test_id ở cột TESTCASE ID.
  // Tra theo test_id để chống ghi nhầm dòng (xem feedback-sheet-ops-csv-row-offset).
  let rowNumber = parseInt(rowPart);
  if (isNaN(rowNumber)) {
    if (ti === -1) { console.error(`Cannot resolve test_id "${rowPart}": no test_id column in ${sheetName}`); process.exit(1); }
    const colRes = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${sheetName}!${colLetter(ti)}:${colLetter(ti)}`,
    });
    const colVals = colRes.data.values || [];
    const matches = [];
    colVals.forEach((r, i) => { if ((r[0] || "").trim() === rowPart.trim()) matches.push(i + 1); });
    if (matches.length === 0) { console.error(`test_id "${rowPart}" not found in ${sheetName}`); process.exit(1); }
    if (matches.length > 1) { console.error(`test_id "${rowPart}" ambiguous in ${sheetName}: rows ${matches.join(", ")}`); process.exit(1); }
    rowNumber = matches[0];
  }

  const statusRange = `${sheetName}!${colLetter(si)}${rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.spreadsheetId,
    range: statusRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[writeValue]] },
  });

  let actualRange = null;
  const actual = actualParts.join(" ").trim();
  if (actual) {
    const ai = colIndex(header, CONFIG.columns.actual);
    if (ai !== -1) {
      actualRange = `${sheetName}!${colLetter(ai)}${rowNumber}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.spreadsheetId,
        range: actualRange,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[actual]] },
      });
    }
  }

  // Verify: đọc lại cả row để xác nhận status đã ghi + test_id khớp (chống ghi nhầm dòng)
  const rowRes = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${sheetName}!A${rowNumber}:Y${rowNumber}`,
  });
  const rowVals = rowRes.data.values?.[0] || [];
  console.log(JSON.stringify({
    success: true,
    tab: sheetName,
    row: rowNumber,
    row_test_id: ti !== -1 ? (rowVals[ti] || "") : "(?)",
    wrote: writeValue,
    read_back: rowVals[si] || "",
    actual_range: actualRange,
  }));
}

async function cmdDumpCsv() {
  const sheets = await getSheetsClient();
  const { rows } = await fetchRows(sheets);
  for (const r of rows) {
    console.log(r.map((c) => {
      const s = String(c == null ? "" : c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  }
}

// ────────────────────────────────────────────────────────────────────
// Dispatch
// ────────────────────────────────────────────────────────────────────
(async () => {
  const [, , cmd, ...args] = process.argv;
  try {
    switch (cmd) {
      case "inspect": await cmdInspect(); break;
      case "next-fail": await cmdNextFail(); break;
      case "list-fails": await cmdListFails(args[0]); break;
      case "list-untested": await cmdListUntested(args[0]); break;
      case "mark-status": await cmdMarkStatus(args[0], args[1], ...args.slice(2)); break;
      case "mark-done": await cmdMarkDone(args[0], args[1]); break;
      case "unmark-done": await cmdUnmarkDone(args[0]); break;
      case "add-note": await cmdAddNote(args[0], ...args.slice(1)); break;
      case "status": await cmdStatus(); break;
      case "dump-csv": await cmdDumpCsv(); break;
      default:
        console.error(`Unknown command: ${cmd || "(none)"}`);
        console.error("Available: inspect, next-fail, list-fails, list-untested, mark-status, mark-done, unmark-done, add-note, status, dump-csv");
        process.exit(1);
    }
  } catch (err) {
    console.error("ERROR:", err.message);
    if (err.response?.data?.error) {
      console.error("API:", JSON.stringify(err.response.data.error, null, 2));
    }
    process.exit(1);
  }
})();
