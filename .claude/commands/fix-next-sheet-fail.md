---
description: Auto-fix 1 fail từ Google Sheet — fix code → deploy VPS → browser test → mark Dev-Completed → exit. Idempotent. Tự handle lock + targeted commit/push (NO stash).
---

Bạn đang chạy 1 vòng auto-fix lỗi WMS Vĩnh Giang. Đọc xong instruction này thì THỰC HIỆN NGAY, không hỏi user.

## Quy tắc tuyệt đối

- **Mỗi invocation = 1 fix** (rồi exit). KHÔNG loop trong session.
- **KHÔNG hỏi user** — nếu blocked thì add note "Auto-fix paused: <reason>" + exit.
- **Branch**: `auto-fix-2026-05-29`. Tạo nếu chưa có.
- Mọi state ở `scripts/auto-fix-state.json` + log `scripts/auto-fix-log.jsonl`.

## Bước 0 — Pre-flight (luôn chạy)

```bash
# Load state
cat scripts/auto-fix-state.json
```

**Lock check**: nếu `state.lock.started_at` exists VÀ <10 phút trước → EXIT immediately ("another session is running"). Đừng làm gì.

Nếu stale (>10 phút) hoặc rỗng → claim lock:
```json
{"lock": {"started_at": "ISO_NOW", "session_id": "<random>", "tab": "...", "test_id": "..."}}
```

## Bước 1 — Tạo / chuyển branch

```bash
git fetch origin
git rev-parse --verify auto-fix-2026-05-29 2>/dev/null || git checkout -b auto-fix-2026-05-29
git checkout auto-fix-2026-05-29 2>/dev/null || true
```

## Bước 2 — Snapshot files đã modify (KHÔNG stash)

❌ **TUYỆT ĐỐI KHÔNG** `git stash push -u` — sẽ quét luôn cả scripts/, .claude/, Sprint A fixes → crash automation + mất code.

✅ Lưu list file đã modify trước khi fix. Bước 8 commit sẽ chỉ stage file MỚI subagent đụng (so với list này).

```bash
git diff --name-only HEAD > /tmp/auto-fix-pre-files.txt 2>/dev/null || true
```

## Bước 3 — Lấy FAIL kế tiếp

```bash
node scripts/sheet-ops.js next-fail
```

Nếu output `{done: true}`:
- Release lock (clear `state.lock`)
- Update state: `state.completed_at = NOW`
- Append log: `{event: "all_done", ...}`
- EXIT — báo "🎉 HẾT FAIL toàn sheet"

Parse JSON → `tab`, `row_number`, `test_id`, `purpose`, `expected`, `actual`, `steps_to_repro`.

## Bước 4 — Black-list check

SKIP (add note + tiếp fail kế bằng cách re-call next-fail loop trong PowerShell, NHƯNG max 5 lần / session để tránh infinite loop) nếu:
- `test_id` thuộc critical path: regex `/^TC_(FK_04|CP_04|CP_05|CP_08|FEFO|RETURN_FROM_STAGING|ADJUSTMENT_APPROVE)/i`
- `purpose` / `steps_to_repro` chứa: "race condition", "concurrent", "schema migration", "deadlock"
- `state.skipped_test_ids` đã có
- File log JSONL grep `test_id` → tìm `status: "fail"` đã ≥2 lần

Skip: `node scripts/sheet-ops.js add-note <tab>:<row> "🤖 Skip — blacklist: <reason>"` + add vào state + tiếp fail kế.

## Bước 5 — Fix code

1. Grep từ khoá trong `error_message` + `purpose` + module name (suy ra từ tab: MD02=Master Data, MD03=Inbound, MD04=Pallet, MD05=Forklift, MD06=Outbound, MD07=Inventory, MD08=Stocktake, MD09=System, MD10=Auth, MD11=Integration).
2. Đọc THẬT các file (KHÔNG assume), trace flow.
3. Identify root cause (1-2 câu).
4. Fix bằng Edit tool — minimal change.
5. `npx tsc --noEmit` — phải pass.

Nếu fix attempt 1 fail TypeScript → đọc error → fix lại lần 2. Sau 2 lần fail → mark "AUTO_FIX_FAILED" + skip.

Nếu fix cần schema migration → mark `status="needs_migration"` + skip + báo trong note "Cần human review: schema migration".

## Bước 6 — Deploy VPS

```bash
# CHỈ sync file subagent declare đã sửa (KHÔNG sync hết diff vì sẽ upload Sprint A + WIP user)
node vps-deploy.js sync-files <SUBAGENT_FILES_CHANGED>

# Build wms only (faster than build all)
node vps-deploy.js build wms

# Restart wms
node vps-deploy.js restart wms

# Verify HTTP 200
node vps-deploy.js verify
```

Nếu BUILD fail (TypeScript error trên VPS, dù local OK):
- Revert CHỈ file subagent đã sửa: `for f in $SUBAGENT_FILES_CHANGED; do git checkout HEAD -- "$f"; done`
- ❌ KHÔNG `git checkout .` (sẽ wipe WIP user + Sprint A)
- Add note "Auto-fix: build fail trên VPS — manual review"
- Skip, tiếp fail kế

## Bước 7 — Browser test

⚠️ **RAM rule**: KHÔNG `tabs_create_mcp` mỗi fix. PHẢI re-use 1 tab xuyên session, và close tab khi xong (Bước 9). Track tab ID đã mở để close sau.

```
1. mcp__Claude_in_Chrome__list_connected_browsers → check connected
2. mcp__Claude_in_Chrome__tabs_context_mcp → ƯU TIÊN re-use tab existing có URL khớp module, chỉ create nếu không có
3. Navigate to URL theo module:
   - Master Data (MD02): https://188.166.210.73/wms/master-data
   - Inbound (MD03): /wms/inbound
   - Pallet (MD04): /wms/pallets
   - Forklift (MD05): /xenang/forklift
   - Outbound (MD06): /wms/outbound
   - Inventory (MD07): /wms/inventory
   - Stocktake (MD08): /wms/stock-count
   - System (MD09): /wms/system
   - Auth (MD10): /wms/auth
   - Integration (MD11): /wms/scan-debug
4. Re-create test scenario theo `steps_to_repro`
5. Screenshot kết quả
6. So sánh với `expected` field
```

Pass/fail decision:
- **PASS**: behavior khớp expected (vd: message Vietnamese hiện đúng, status persist...)
- **FAIL**: behavior khớp `actual` (lỗi vẫn còn)

Nếu cần test data (vd product inactive) → dùng `scripts/test-fixtures.js` (xem helper functions) hoặc tạo qua API trực tiếp.

## Bước 8 — Process result

**Nếu PASS:**
```bash
# CHỈ stage file subagent declare đã sửa (KHÔNG add . hoặc add hết diff — sẽ commit WIP user)
git add <SUBAGENT_FILES_CHANGED>
git commit -m "fix(auto): <test_id> — <fix_summary>"

# Mark sheet
node scripts/sheet-ops.js mark-done <tab>:<row>
node scripts/sheet-ops.js add-note <tab>:<row> "Auto-fix: <fix_summary>. Verified live VPS."

# Update state
state.pass_count++
state.commits_made++
state.last_row = <row>

# Push mỗi 5 commit
if (state.commits_made % 5 === 0) {
  git push origin auto-fix-2026-05-29
}

# Append log
{"ts": NOW, "test_id": X, "tab": Y, "status": "pass", "files": [...]}
```

**Nếu FAIL (browser test không pass sau 2 fix attempt):**
```bash
# CHỈ revert file subagent đụng (KHÔNG blanket checkout)
for f in <SUBAGENT_FILES_CHANGED>; do
  git checkout HEAD -- "$f"
done
node scripts/sheet-ops.js add-note <tab>:<row> "🤖 Auto-fix tried but cannot verify. Manual review needed."
state.fail_count++
state.skipped_test_ids.push(test_id)
# Append log status: "fail"
```

## Bước 9 — Cleanup + exit

```bash
# Không pop stash vì không stash (WIP user vẫn nguyên trong working tree).

# ⚠️ ĐÓNG TẤT CẢ TAB CHROME MCP đã mở trong session này (tránh leak RAM máy user)
# mcp__Claude_in_Chrome__tabs_close_mcp <tab_id> cho từng tab session này tạo ra
# Nếu re-use tab có sẵn từ trước → vẫn close nếu user không cần xem nữa

# Release lock
state.lock = null

# Cost cap check
if (state.pass_count + state.fail_count >= 10) {
  pass_rate = state.pass_count / (state.pass_count + state.fail_count)
  if (pass_rate < 0.5) {
    # Disable scheduled task
    mcp__scheduled-tasks__update_scheduled_task auto-fix-wms enabled=false
    # Báo (qua log only, không user notify)
    Append log: {event: "auto_paused", reason: "pass_rate_low"}
  }
}

# Báo cáo 1 dòng
print: "✅ <test_id> done. Pass=X Fail=Y. Next fire 5 min."
```

EXIT.

## Notes quan trọng

- **Tự exit sau 1 fix** — không loop trong session.
- **Scheduled task fires lại mỗi 5 phút** → auto-continue.
- **Auto stop** khi: hết FAIL, hoặc pass rate <50% sau 10 fix.
- **User can pause anytime**: disable scheduled task qua `/schedule list` UI.

Bắt đầu thực thi NGAY từ Bước 0.
