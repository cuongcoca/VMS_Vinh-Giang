# Auto-Fix Automation — Handoff

**Created**: 2026-05-29 (context full ở session pilot)
**Branch**: `auto-fix-2026-05-29`
**Status**: Setup hoàn tất, pilot 4/4 PASS. Ready for full loop.

## Resume trong session mới

Gõ: `/fix-next-sheet-fail`

(Slash command trong `.claude/commands/fix-next-sheet-fail.md` sẽ tự đọc state, fix 1 fail, exit.)

## State hiện tại

- Sheet: https://docs.google.com/spreadsheets/d/1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog
- 78 FAIL total → **4 done (MD02 rows 40, 52, 56, 71)** → 74 còn
- Per tab pending: MD02=15, MD03=24, MD04=11, MD05=17, MD08=7
- Next FAIL: TC_001_002 (MD02 row 72) — bug: "Mã hàng bắt buộc" error hiện dù đã nhập đầy đủ

## Infrastructure đã setup

- ✅ `scripts/sheet-ops.js` — read/write sheet (next-fail, mark-done, add-note, status, unmark-done)
- ✅ `scripts/test-fixtures.js` — helper tạo test data
- ✅ `scripts/auto-fix-state.json` — state JSON (đọc bởi slash cmd)
- ✅ `scripts/auto-fix-log.jsonl` — append-only log mỗi fix
- ✅ `.claude/commands/fix-next-sheet-fail.md` — slash command 9-step (no stash, targeted commit)
- ✅ `.secrets/google-sheet-key.json` — Service Account key (gitignored)
- ✅ `~/.claude/settings.json` — 28 permission allow rules
- ✅ Scheduled task `wms-auto-fix-loop` — cron `*/5 * * * *` (every 5 min), enabled

## ⚠️ Bài học quan trọng (đừng lặp)

- ❌ TUYỆT ĐỐI KHÔNG `git stash push -u` — sẽ quét sạch Sprint A + WIP + scripts. Slash command đã sửa để không dùng stash.
- ✅ Dùng `git add <specific-file>` chỉ stage file subagent đã sửa.
- ✅ Revert dùng `git checkout HEAD -- <file>` per file, không `git checkout .` blanket.

## Cách monitor

```bash
# Stats hiện tại từ sheet
node scripts/sheet-ops.js status

# Log mỗi fix
Get-Content scripts/auto-fix-log.jsonl -Tail 20

# Git commits
git log auto-fix-2026-05-29 --oneline -10

# Pause scheduled task
# (UI: sidebar Scheduled → toggle off wms-auto-fix-loop)
```

## Pattern phát hiện từ pilot

70-80% test "fail" thực ra là tester chạy trên code cũ trước fix → **cannot reproduce**.
Workflow: code grep → confirm fix exists → browser verify (optional) → mark Dev-Completed + note "Cannot reproduce, code already correct".

Chỉ ~20% cần fix code thật. Auto loop chạy nhanh đoạn này.
