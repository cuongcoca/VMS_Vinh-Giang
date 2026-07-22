# Setup Guide — Auto-fix automation (phần user phải làm thủ công)

Phần lớn setup đã được Claude tự làm. Phần dưới đây bạn phải tự click trên Google Cloud Console vì cần đăng nhập Google account của bạn.

**Thời gian dự kiến**: 30-45 phút (lần đầu Google Cloud). Sau đó tự động.

**Trạng thái hiện tại**:
- ✅ `npm install googleapis` — đã cài
- ✅ `scripts/sheet-ops.js` — đã viết
- ✅ `scripts/auto-fix-state.json` + `auto-fix-log.jsonl` — đã tạo
- ✅ `.claude/commands/fix-next-sheet-fail.md` — đã viết slash command
- ✅ `.gitignore` — đã thêm `.secrets/`, `scripts/auto-fix-state.json`, `scripts/auto-fix-log.jsonl`
- ✅ `~/.claude/settings.json` — đã thêm permission rules
- ❌ **Google Cloud Service Account** — bạn phải tự làm (hướng dẫn bên dưới)
- ❌ **Đặt key.json vào `.secrets/`** — bạn phải tự làm
- ❌ **Share sheet với Service Account email** — bạn phải tự làm

---

## Phần 1 — Tạo Google Cloud Project (10 phút)

### 1.1 Mở Google Cloud Console
1. Truy cập **https://console.cloud.google.com/**
2. Đăng nhập bằng Google account bạn muốn dùng (có thể là account thường, không cần Workspace)
3. Đồng ý Terms of Service nếu lần đầu (Google sẽ hỏi country + organization)

### 1.2 Tạo Project mới
1. Trên top bar (cạnh logo "Google Cloud"), click vào **dropdown project hiện tại** (có thể hiện tên project cũ hoặc "Select a project")
2. Cửa sổ mở ra, click **"NEW PROJECT"** (góc trên phải)
3. Điền:
   - **Project name**: `wms-auto-fix`
   - **Organization**: để mặc định (No organization)
   - **Location**: để mặc định
4. Click **"CREATE"**
5. Đợi ~30s, notification "Created project wms-auto-fix" hiện lên → click vào để switch sang project mới

**Verify**: Top bar phải hiện "wms-auto-fix" làm project active.

### 1.3 Enable Google Sheets API
1. Menu trái (hamburger ☰) → **APIs & Services → Library**
2. Ô tìm kiếm, gõ: `Google Sheets API`
3. Click vào card **"Google Sheets API"** (Anthropic logo blue)
4. Click nút xanh **"ENABLE"**
5. Đợi ~10s, page chuyển sang "API is enabled"

---

## Phần 2 — Tạo Service Account (10 phút)

### 2.1 Tạo Service Account
1. Menu trái → **APIs & Services → Credentials**
2. Click **"+ CREATE CREDENTIALS"** (top bar)
3. Chọn **"Service account"** (item thứ 2 dropdown)
4. Điền form **Step 1 — Service account details**:
   - **Service account name**: `wms-sheet-bot`
   - **Service account ID**: tự fill (vd `wms-sheet-bot`)
   - **Description**: `Auto-fix automation bot for WMS Vinh Giang test sheet`
5. Click **"CREATE AND CONTINUE"**
6. **Step 2 — Grant access** (optional): **SKIP**, click **"CONTINUE"** không chọn role nào
7. **Step 3 — Grant users access** (optional): **SKIP**, click **"DONE"**

### 2.2 Tạo JSON Key
1. Trên trang Credentials, scroll xuống section **"Service Accounts"**
2. Click vào email service account vừa tạo (vd `wms-sheet-bot@wms-auto-fix.iam.gserviceaccount.com`)
3. Tab **"KEYS"** (top của trang)
4. Click **"ADD KEY → Create new key"**
5. Chọn type **JSON** (đã chọn mặc định)
6. Click **"CREATE"** → file `wms-auto-fix-XXXX.json` tự download xuống `Downloads/`

### 2.3 Copy email service account
1. Tab **"DETAILS"** (top của trang service account)
2. Section **"Service account info"** — copy chuỗi **Email** (dạng `xxx@yyy.iam.gserviceaccount.com`)
3. Lưu lại — bạn sẽ paste vào Sheet ở Phần 3

---

## Phần 3 — Share Google Sheet với Service Account (2 phút)

1. Mở sheet test cases: **https://docs.google.com/spreadsheets/d/1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog/edit**
2. Click nút **"Share"** (góc trên phải, màu xanh)
3. Trong ô "Add people, groups, and calendar events":
   - Paste **email service account** vừa copy ở 2.3
   - Đảm bảo dropdown bên phải là **"Editor"** (KHÔNG phải Viewer)
   - **Bỏ tick "Notify people"** (service account không nhận mail được)
4. Click **"Share"** (hoặc "Send")

**Verify**: Email service account hiện trong danh sách "People with access" với badge "Editor".

---

## Phần 4 — Đặt key vào repo (1 phút)

PowerShell (Run as your user, không Admin):

```powershell
# Tạo thư mục (đã có sẵn từ Claude setup, command này idempotent)
New-Item -ItemType Directory -Force -Path D:\wms-vinhgiang_repo\.secrets | Out-Null

# Di chuyển key từ Downloads sang .secrets/, đổi tên cố định
$keyFile = Get-ChildItem $env:USERPROFILE\Downloads\wms-auto-fix-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Move-Item $keyFile.FullName D:\wms-vinhgiang_repo\.secrets\google-sheet-key.json -Force

# Verify
Get-ChildItem D:\wms-vinhgiang_repo\.secrets\google-sheet-key.json
```

**Kết quả mong đợi**: file `google-sheet-key.json` size ~2.3KB ở `D:\wms-vinhgiang_repo\.secrets\`.

**An toàn**: `.secrets/` đã được Claude add vào `.gitignore` → không commit lên Git.

---

## Phần 5 — Test connection (2 phút)

PowerShell:
```powershell
cd D:\wms-vinhgiang_repo
node scripts/sheet-ops.js inspect
```

**Expected output**:
```
📋 Tabs trong spreadsheet:
   • <tên tab>  (1000 rows × 26 cols)

📄 Đọc tab: <tên tab>
   Tổng rows: <số>

📑 Header row (row 1):
   A   [0] <tên cột 1>
   B   [1] <tên cột 2>
   ...

📊 3 row đầu (sample):
   Row 2:
     <cột 1>: <giá trị>
     ...

💡 Sau khi xem, sửa `CONFIG.columns` trong scripts/sheet-ops.js cho khớp header thực tế.
```

### Nếu lỗi xảy ra

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `Key file không tồn tại` | Chưa đặt key vào `.secrets/` | Quay lại Phần 4 |
| `The caller does not have permission` | Chưa share sheet với service account | Quay lại Phần 3, paste lại email |
| `Google Sheets API has not been used in project ... before or it is disabled` | Chưa enable API | Quay lại Phần 1.3 |
| `Requested entity was not found` | Sheet ID sai | Verify URL sheet — `1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog` |
| `Cannot find module 'googleapis'` | npm install chưa chạy | `npm install googleapis` |

---

## Phần 6 — Báo Claude để cấu hình columns + chạy thử (5 phút)

Sau khi `inspect` ra header thật, copy output trả Claude. Claude sẽ:
1. Sửa `CONFIG.columns` trong `scripts/sheet-ops.js` cho khớp header thật của bạn
2. Chạy `node scripts/sheet-ops.js next-fail` test lấy 1 FAIL
3. Chạy `node scripts/sheet-ops.js status` để thống kê tổng FAIL/PASS/DONE
4. Tạo branch mới `auto-fix-2026-05-28`
5. Pilot 2-3 fail đầu sheet để validate workflow
6. Nếu OK → bạn nói "chạy hết sheet" → tôi `/loop /fix-next-sheet-fail`

---

## Tóm tắt checklist

Đánh dấu khi bạn xong từng phần:

- [ ] Phần 1: Tạo Google Cloud Project `wms-auto-fix` + enable Sheets API
- [ ] Phần 2: Tạo Service Account `wms-sheet-bot` + download JSON key
- [ ] Phần 3: Share sheet với email service account (Editor)
- [ ] Phần 4: Di chuyển key vào `D:\wms-vinhgiang_repo\.secrets\google-sheet-key.json`
- [ ] Phần 5: `node scripts/sheet-ops.js inspect` chạy thành công, in được header sheet
- [ ] Phần 6: Báo Claude output để cấu hình CONFIG.columns

---

## FAQ

**Q: Service Account này có tính phí không?**
A: Sheets API free quota: 300 read/100 write requests / minute. Automation tôi viết dùng ~10 request/fix → free quá xa.

**Q: Tôi đã có Google Cloud project khác, dùng project đó được không?**
A: Được. Chỉ cần Enable Sheets API trong project đó + tạo Service Account mới (hoặc dùng SA có sẵn nếu nó có quyền Sheets).

**Q: Service account email có dùng được làm tài khoản đăng nhập Google không?**
A: KHÔNG. Đây là identity bot, không có UI login.

**Q: Lỡ commit key.json lên Git rồi, làm sao?**
A: NGHIÊM TRỌNG — anyone với git history sẽ có quyền sửa sheet bạn.
1. Vào Google Cloud Console → Service Account → Tab Keys → xoá key đã leak
2. Tạo key mới (Phần 2.2 lại)
3. Cảnh báo: nếu sheet chứa data nhạy cảm, rotate cả secret + audit log
4. `git filter-branch` xoá file khỏi history (phức tạp, hỏi tôi)

**Q: Tôi muốn dùng tài khoản công ty (Workspace) thay vì Gmail cá nhân?**
A: Được. Cùng quy trình. Lưu ý admin Workspace có thể restrict service account creation — nếu fail Phần 2, liên hệ IT.
