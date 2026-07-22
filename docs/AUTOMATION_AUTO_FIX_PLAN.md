# KẾ HOẠCH AUTOMATION AUTO-FIX TỪ GOOGLE SHEET

**Ngày**: 2026-05-28
**Mục tiêu**: Tự động đọc Google Sheet test cases (sheet ID `1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog`), tìm FAIL, fix code, test, tick `dev-completed`, lặp lại đến hết sheet.

**Quyết định của user** (đã chốt):
- Sheet write: **Option B — Setup Google Sheets API** (Service Account)
- Test methodology: **Adaptive** (L1/L2/L3 theo loại lỗi)
- Git: **Auto commit mỗi fix, push mỗi 5 fix**
- Bắt đầu: **Setup full automation trước**, rồi chạy từ đầu sheet

---

## 1. KIẾN TRÚC

```
┌──────────────────────────────────────────────────────────────┐
│                    SLASH COMMAND ENTRY                       │
│  /fix-next-sheet-fail   hoặc   /loop /fix-next-sheet-fail   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│             MAIN SESSION (orchestrator, low ctx)            │
│                                                              │
│  1. node scripts/sheet-ops.js next-fail                     │
│     ↓ returns: { row, test_id, module, error, steps,        │
│                  expected, actual, dev_completed }           │
│                                                              │
│  2. Decide test level (L1/L2/L3) theo module                │
│                                                              │
│  3. Spawn fresh general-purpose subagent với brief đầy đủ   │
│     ↓ subagent works isolated (200K fresh ctx)              │
│     ↑ returns: { status, files_changed, summary, test_log } │
│                                                              │
│  4. Nếu status=PASS:                                         │
│     - git add <files> && git commit -m "fix: TC_xxx ..."    │
│     - node scripts/sheet-ops.js mark-done <row>              │
│     - Nếu commit_count % 5 == 0: git push                   │
│                                                              │
│  5. Nếu status=FAIL:                                         │
│     - Log to scripts/auto-fix-log.jsonl                     │
│     - node scripts/sheet-ops.js add-note <row> "Claude X"   │
│     - Continue (don't block)                                │
│                                                              │
│  6. Check main ctx usage. Nếu > 70% → /handoff + báo user  │
│                                                              │
│  7. Loop tiếp                                                │
└──────────────────────────────────────────────────────────────┘
```

### Vì sao kiến trúc này (lý do thiết kế)

| Quyết định | Lý do |
|---|---|
| **Subagent per fix** | Mỗi fix isolated 200K ctx fresh → tận dụng full khả năng đọc nhiều file. Main session chỉ tốn ~3-5K token/fix (đọc summary). |
| **Slash command + /loop** | User trigger 1 lần, hệ thống tự chạy. /loop self-pace = tôi quyết khi nào fire lại. |
| **Script Node.js wrap Google API** | Sheet read/write phải qua Sheets API. Wrap script để main session gọi gọn `node scripts/sheet-ops.js <cmd>`. |
| **Auto commit per fix, push per 5** | Git history rõ ràng theo TC_id, dễ revert. Push gom đỡ rate-limit. |
| **Adaptive test** | API bug → L2 curl test. UI bug → L3 Playwright. Pure type bug → L1 tsc. Tiết kiệm thời gian. |
| **handoff khi 70% ctx** | Trước khi main session đứt, dump state vào HANDOFF.md để session mới tiếp được. |

---

## 2. SETUP TRƯỚC KHI CHẠY (3 PHẦN, ~2-3 GIỜ)

### 2.1 · Google Sheets API Service Account (30-60 phút)

**Bước 1: Tạo Google Cloud Project**
1. Truy cập https://console.cloud.google.com
2. Tạo project mới: `wms-auto-fix` (hoặc tên khác)
3. Vào **APIs & Services → Library** → Enable **Google Sheets API**

**Bước 2: Tạo Service Account**
1. **APIs & Services → Credentials → Create Credentials → Service Account**
2. Đặt tên: `wms-sheet-bot`
3. Skip step phân quyền (không cần role)
4. Tạo xong → click vào account → **Keys → Add Key → JSON** → tải file `key.json`
5. Copy email service account (vd `wms-sheet-bot@wms-auto-fix.iam.gserviceaccount.com`)

**Bước 3: Share Google Sheet với Service Account**
1. Mở sheet → click **Share**
2. Paste email service account vào ô
3. Cấp quyền **Editor**
4. Send (không gửi email)

**Bước 4: Đặt `key.json` vào repo**
```bash
# Đặt vào thư mục an toàn (KHÔNG commit)
mkdir -p D:\wms-vinhgiang_repo\.secrets
mv ~/Downloads/<key>.json D:\wms-vinhgiang_repo\.secrets\google-sheet-key.json

# Thêm vào .gitignore
echo ".secrets/" >> D:\wms-vinhgiang_repo\.gitignore
```

### 2.2 · Permission Rules (~10 phút)

Thêm vào `~/.claude/settings.json` để giảm chặn của auto-mode:

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(node scripts/sheet-ops.js *)",
      "Bash(node vps-deploy.js *)",
      "Bash(npx tsc *)",
      "Bash(npx prisma *)",
      "Bash(npm run *)",
      "Bash(curl http://localhost:*)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git push origin *)",
      "Bash(git status *)",
      "Bash(git diff *)"
    ]
  }
}
```

⚠️ **Cảnh báo**: `git push` được allow → mọi commit auto sẽ push (khi đến lượt 5/10/15...). Nếu sợ, bỏ `git push *` khỏi allow, mỗi push sẽ hỏi user.

### 2.3 · Scripts hỗ trợ (~1 giờ — tôi viết)

Tôi sẽ tạo các file sau khi user OK kế hoạch:

```
scripts/
├── sheet-ops.js          # Wrap Google Sheets API
├── auto-fix-log.jsonl    # Log mỗi fix (append-only)
└── auto-fix-state.json   # State giữa các session (last_row, push_counter)

.claude/commands/
└── fix-next-sheet-fail.md  # Slash command definition
```

**`scripts/sheet-ops.js`** — sub-commands:
- `next-fail` — trả về JSON của row FAIL đầu tiên chưa dev-completed
- `mark-done <row>` — tick checkbox dev-completed
- `add-note <row> "<text>"` — ghi note vào cột Note (vd "Claude failed, manual review")
- `status` — đếm tổng FAIL / PASS / DONE
- `dump-csv` — export sheet để debug

**`.claude/commands/fix-next-sheet-fail.md`** — slash command body (đây là instruction tôi sẽ tự execute mỗi lần `/fix-next-sheet-fail`).

---

## 3. WORKFLOW PER FIX (chi tiết 1 vòng)

### Bước 1: Đọc row FAIL kế tiếp

```bash
node scripts/sheet-ops.js next-fail
```

Output mẫu:
```json
{
  "row_number": 47,
  "test_id": "TC_T01_015",
  "module": "Auth/Login",
  "status": "FAIL",
  "error_message": "Lỗi: Mật khẩu không chính xác hiển thị khi nhập đúng pass",
  "steps_to_repro": "1. Vào /auth, 2. Nhập admin@cty.vn / Admin@123, 3. Click Đăng nhập",
  "expected": "Redirect /dashboard",
  "actual": "Toast đỏ: Mật khẩu không chính xác",
  "dev_completed": false,
  "note": ""
}
```

Nếu không còn FAIL → orchestrator báo DONE và kết thúc.

### Bước 2: Quyết định test level (Adaptive)

| Module | Test Level | Lệnh |
|---|---|---|
| Auth, RBAC | L2 + L3 | `curl /api/auth/login` + Playwright login flow |
| Inbound, Pallet, Forklift (logic) | L2 | curl các API endpoint |
| Dashboard, KPI (UI binding) | L1 + L3 | tsc + Playwright check render |
| Master data (CRUD form) | L2 | curl POST/PUT/GET |
| Schema/migration | L1 + manual review | tsc; user verify migration trước apply |
| **Type-only bug** | L1 | tsc thôi |

### Bước 3: Spawn subagent

```javascript
Agent({
  subagent_type: "general-purpose",
  description: `Fix TC_${test_id}`,
  prompt: `
Project WMS Vĩnh Giang (Next.js 16 + Prisma 7 + Postgres). Repo: D:/wms-vinhgiang_repo.

## Test case fail
- ID: ${test_id}
- Module: ${module}
- Error: ${error_message}
- Steps: ${steps_to_repro}
- Expected: ${expected}
- Actual: ${actual}

## Nhiệm vụ
1. Grep tìm code liên quan (gợi ý: từ khoá trong error message + module name)
2. Đọc các file liên quan ĐẦY ĐỦ (không assume), trace flow
3. Xác định root cause
4. Fix code (Edit) — minimal change, không refactor
5. Test fix bằng lệnh: ${test_command}
6. Nếu test pass, return JSON:
   {
     "status": "pass",
     "files_changed": ["src/...", "src/..."],
     "root_cause": "1-2 câu giải thích",
     "fix_summary": "1-2 câu mô tả thay đổi",
     "test_output": "<last 20 lines>"
   }
7. Nếu test vẫn fail sau fix, return:
   {
     "status": "fail",
     "reason": "Why",
     "next_steps_suggestion": "Manual review needed because..."
   }

## Constraints
- KHÔNG tạo file md docs trừ khi explicitly cần
- KHÔNG đụng schema.prisma nếu fix có cách khác
- KHÔNG đổi prefix code (đã standardize: PHN/PNT/STK/ADJ)
- Tôn trọng [docs/CRITICAL_PATHS.md](docs/CRITICAL_PATHS.md) — file PROTECTED cần extra care
- TypeScript phải pass — chạy npx tsc --noEmit sau khi edit

## Output format
Trả về JSON cuối response (sẽ parse bằng regex).
  `
})
```

### Bước 4: Xử lý kết quả

**Nếu status=pass:**
```bash
# Commit
git add ${files_changed.join(' ')}
git commit -m "fix(auto): ${test_id} — ${fix_summary}

Root cause: ${root_cause}
Files: ${files_changed.length} file(s)

Co-Authored-By: Claude Code Auto-Fix <noreply@anthropic.com>"

# Mark sheet
node scripts/sheet-ops.js mark-done ${row_number}

# Push nếu đến lượt
if (commit_count % 5 == 0) git push origin <branch>

# Log
echo '{"ts":"...", "tc":"...", "status":"pass", ...}' >> scripts/auto-fix-log.jsonl
```

**Nếu status=fail:**
```bash
node scripts/sheet-ops.js add-note ${row_number} "Claude auto-fix failed: ${reason}. ${suggestion}"
# KHÔNG commit (để branch sạch)
```

### Bước 5: Check ctx + loop

```javascript
// Pseudo
if (mainCtxUsed > 70%) {
  /* Dump state */
  fs.writeFileSync("HANDOFF.md", `# Auto-fix handoff
Last row processed: ${row_number}
Commits made: ${commit_count}
Push pending: ${5 - commit_count % 5}
Errors so far: ${fail_count}
Resume: chạy lại /fix-next-sheet-fail trong session mới
`);
  print("⚠️ Context gần đầy. Đã dump HANDOFF.md. Khởi tạo session mới và chạy lại /fix-next-sheet-fail.");
  exit;
}
// Else: continue
ScheduleWakeup({ delaySeconds: 60, prompt: "/fix-next-sheet-fail", reason: "Loop fix tiếp" });
```

---

## 4. ERROR HANDLING

### Lỗi có thể xảy ra & cách xử lý

| Tình huống | Xử lý |
|---|---|
| Sheet API trả 429 (rate limit) | Backoff exponential (1s → 5s → 25s), max 3 retry |
| Sheet API trả 403 (permission) | Báo user fix Service Account share lại, exit |
| Subagent trả status=fail | Add note vào sheet, skip, không block |
| TypeScript fail sau fix | Subagent self-recover (re-fix), max 2 vòng |
| Test command timeout | Kill + treat as fail |
| Git commit fail (pre-commit hook) | Subagent đọc hook output, fix nguyên nhân, re-stage |
| `git push` reject (non-fast-forward) | Pull rebase + retry 1 lần; nếu vẫn fail → report user |
| Auto-mode classifier chặn | Tôi pause, ask user confirm 1 lần, sau đó suggest add permission rule |
| Migration cần (schema change) | **Auto pause** + báo user, không tự apply |

### Black-list automatic fix

Một số test sẽ KHÔNG tự fix, mà ngay lập tức add note "manual review":

- Test ID nằm trong critical path PROTECTED (CP-04 FEFO, CP-05 Return, CP-08 Adjustment) → cần human review
- Test fail liên quan đến schema migration (cần con người approve)
- Test có keyword "race condition", "concurrent", "deadlock" → complex, cần thiết kế
- Test fail >2 lần trước đó (auto-fix-log check)
- Test có note manual từ user trước đó

---

## 5. CONTEXT MANAGEMENT (chống đầy session)

### Chiến lược 3-tầng

**Tầng 1: Subagent isolation** (mỗi fix)
- Main session NÊN chỉ giữ summary 1-2 câu mỗi fix
- Subagent transcript KHÔNG vào main → main tốn ít

**Tầng 2: Compaction** (tự động)
- Hệ thống tự compress conversation cũ khi gần limit
- 6-8 giờ chạy thường vẫn ổn

**Tầng 3: Handoff** (khi tầng 2 không đủ)
- Khi ctx > 70% → dump HANDOFF.md (state + log + pending)
- User mở session mới, gõ `/fix-next-sheet-fail` → tôi đọc HANDOFF.md → resume
- State file `scripts/auto-fix-state.json` lưu:
  ```json
  {
    "branch": "feat/auto-fix-2026-05-28",
    "started_at": "2026-05-28T16:30:00Z",
    "last_row_processed": 47,
    "commits_made": 12,
    "commits_pending_push": 2,
    "fails_to_skip": ["TC_T05_001", "TC_T05_002"],
    "test_levels_used": { "L1": 5, "L2": 6, "L3": 1 }
  }
  ```

### Triệu chứng cần handoff
- Main response trả về > 2 giây (đang load nhiều history)
- Tool result bị cắt (truncation)
- Claude bắt đầu lặp lại / quên context recent
- Manual cmd: `/handoff` thủ công

---

## 6. CHI PHÍ DỰ KIẾN

### Token usage per fix

| Phase | Token in | Token out | Cost (Sonnet 4.6) | Cost (Opus 4.7) |
|---|---:|---:|---:|---:|
| Orchestrator read sheet | 2K | 0.5K | $0.01 | $0.04 |
| Subagent fix simple (L1) | 30K | 5K | $0.18 | $0.75 |
| Subagent fix medium (L2) | 80K | 12K | $0.46 | $1.95 |
| Subagent fix complex (L3 + Playwright) | 150K | 25K | $0.88 | $3.75 |
| Orchestrator process result + commit | 3K | 1K | $0.02 | $0.07 |

**Ước tính trung bình per fix**: $0.5 (Sonnet) hoặc $2 (Opus)

### Tổng dự kiến

| Sheet size | Pass rate ước tính | Cost (Sonnet) | Cost (Opus) |
|---|---|---|---|
| 30 FAIL | 70% (~21 fix) | ~$10 | ~$40 |
| 50 FAIL | 70% (~35 fix) | ~$17 | ~$70 |
| 100 FAIL | 70% (~70 fix) | ~$35 | ~$140 |

**Khuyến nghị**: Pilot 5 fail đầu, đo chi phí thực, rồi scale up.

---

## 7. RỦI RO & MITIGATION

| Rủi ro | Xác suất | Tác động | Mitigation |
|---|---|---|---|
| Auto fix làm **regression** ở feature khác | Cao | High | Auto-test toàn project sau mỗi commit; nếu fail → revert |
| Subagent **fix sai** (test pass nhưng logic sai) | Trung | High | Human spot-check ngẫu nhiên 10% commit; CI nightly |
| Sheet API **race** (2 session cùng fix 1 row) | Thấp | Med | Lock row trước fix qua note "🤖 Claude working..." |
| **Auto push chiếm** branch user đang work | Trung | Med | Auto tạo branch riêng `auto-fix-2026-05-28`, không push vào main |
| **Cost vượt budget** | Trung | Med | Hard cap: dừng sau 30 fix nếu pass rate <50% |
| **API key leak** qua git | Thấp | Critical | `.secrets/` trong `.gitignore` + pre-commit hook scan |
| **Sheet structure đổi** giữa session | Thấp | Med | Snapshot sheet structure đầu session, validate mỗi lần |
| **VPS deploy gãy** vì fix code | Trung | High | Auto fix CHỈ làm local; deploy thủ công sau khi user review |

---

## 8. ACCEPTANCE CRITERIA (khi nào coi là chạy được)

Pilot thành công khi:
- [ ] 5 FAIL đầu sheet được fix tự động
- [ ] ≥ 3/5 commit pass TypeScript + test
- [ ] Sheet được tick dev-completed đúng row
- [ ] Git history clean, commit message theo format
- [ ] Total cost < $5 cho 5 fail
- [ ] Zero auto-mode classifier block (sau khi setup permission)

Production-ready khi:
- [ ] Pilot pass + chạy được 20 fail liên tục
- [ ] Pass rate ≥ 60%
- [ ] Handoff mechanism test thành công (resume 2 lần)
- [ ] Black-list rules hoạt động (không tự đụng critical path)
- [ ] Auto-fix-log đầy đủ để audit

---

## 9. LỊCH TRIỂN KHAI (đề xuất)

### Phase 0 — Setup (1 buổi, ~3 giờ)
1. User: tạo Google Cloud project + Service Account + share sheet (~60 phút)
2. User: review + apply permission rules vào ~/.claude/settings.json (~10 phút)
3. Claude: viết `scripts/sheet-ops.js` + test read sheet (~30 phút)
4. Claude: viết slash command `.claude/commands/fix-next-sheet-fail.md` (~30 phút)
5. Cùng: validate đọc sheet đúng, snapshot structure (~30 phút)

### Phase 1 — Pilot (1 buổi, 2-4 giờ)
6. Chạy `/fix-next-sheet-fail` 1 lần thủ công → quan sát 1 fix end-to-end
7. Tinh chỉnh subagent prompt nếu cần
8. Chạy `/loop /fix-next-sheet-fail` cho 5 fail đầu
9. Review commits + đánh giá quality
10. Quyết định: continue hay stop

### Phase 2 — Scale (chạy đến khi hết sheet)
11. Chạy autonomous, user check mỗi 2-3 giờ
12. Khi gặp black-list / handoff → user can thiệp
13. Khi hết FAIL → orchestrator tự kết thúc, dump final report

---

## 10. BẢN MẪU `scripts/sheet-ops.js` (preview)

```javascript
#!/usr/bin/env node
const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog';
const SHEET_NAME = 'Sheet1'; // hoặc tab cụ thể
const KEY_PATH = path.join(__dirname, '..', '.secrets', 'google-sheet-key.json');

async function getClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function nextFail() {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });
  const rows = res.data.values || [];
  const header = rows[0];
  // Tìm cột Status, Error, dev-completed... (set theo cấu trúc sheet thực)
  const colStatus = header.indexOf('Status');
  const colDevDone = header.indexOf('dev-completed');
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[colStatus]?.toLowerCase() === 'fail' && !r[colDevDone]) {
      return {
        row_number: i + 1,  // 1-indexed
        test_id: r[header.indexOf('Test ID')],
        module: r[header.indexOf('Module')],
        error_message: r[header.indexOf('Error')],
        // ... rest
      };
    }
  }
  return null; // hết FAIL
}

async function markDone(rowNumber) {
  const sheets = await getClient();
  const header = (await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!1:1`
  })).data.values[0];
  const col = header.indexOf('dev-completed');
  const colLetter = String.fromCharCode(65 + col); // A=0 → 'A'
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${colLetter}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['TRUE']] },
  });
}

// Cmd dispatch
const cmd = process.argv[2];
(async () => {
  if (cmd === 'next-fail') console.log(JSON.stringify(await nextFail(), null, 2));
  else if (cmd === 'mark-done') await markDone(parseInt(process.argv[3]));
  else if (cmd === 'add-note') { /* ... */ }
  else if (cmd === 'status') { /* ... */ }
  else throw new Error(`Unknown cmd: ${cmd}`);
})().catch(e => { console.error(e); process.exit(1); });
```

---

## 11. QUYẾT ĐỊNH USER CẦN

Tôi đã viết plan. Bạn xác nhận để tôi bắt đầu Phase 0:

1. **Bạn tự setup Google Cloud Service Account theo Bước 2.1?** Hay cần tôi viết hướng dẫn từng bước chi tiết hơn (screenshot positions, v.v.)?
2. **Branch dành cho auto-fix**: tạo branch mới `auto-fix-2026-05-28` (an toàn, dễ revert) hay làm thẳng trên branch hiện tại `feat/phase0-deploy-tools-and-reports`?
3. **Khi tôi gặp commit cần schema migration → pause hỏi user**, đúng chứ?
4. **Cap chi phí**: dừng nếu pass rate < 50% sau 10 fix đầu?

---

**Kết luận**: KẾ HOẠCH KHẢ THI. Cần ~3 giờ setup, ~$10-15 cho pilot 5 fail, sau đó tự chạy với check-in mỗi 2-3 giờ. Pass rate kỳ vọng 60-80%, 20-40% còn lại cần human review.
