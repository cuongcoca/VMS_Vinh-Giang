# Khôi phục 30 fix từ nhánh `vinhgiang1` vào `main`

## Nguyên nhân (tóm tắt)
Ngày 15/06/2026, commit `5523d5e` đổi nhánh deploy từ `vinhgiang1` sang `main`. Nhưng **30 commit fix** chỉ nằm trên `vinhgiang1`, chưa bao giờ merge vào `main`. Vì vậy web deploy từ `main` bị thiếu các fix đó. Code **không mất**, vẫn nguyên trên `origin/vinhgiang1`.

Việc cần làm: merge `vinhgiang1` → `main` qua Pull Request (push thẳng main bị chặn bởi branch protection).

---

## BƯỚC 0 — Xoá file khoá còn sót (BẮT BUỘC làm trước)
Mở **Git Bash** hoặc **PowerShell** tại thư mục `D:\wms-vinhgiang_repo`, chạy:

```bash
# Git Bash
rm -f .git/index.lock
```
```powershell
# Hoặc PowerShell
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
```

---

## BƯỚC 1 — Lấy code mới nhất & tạo nhánh merge
```bash
cd /d/wms-vinhgiang_repo          # PowerShell: cd D:\wms-vinhgiang_repo
git fetch origin
git checkout -B merge/vinhgiang1-into-main origin/main
git merge origin/vinhgiang1
```
Lệnh `merge` sẽ báo **CONFLICT ở đúng 3 file** rồi dừng lại. Sang Bước 2.

---

## BƯỚC 2 — Giải quyết 3 xung đột

### 2a. `prisma/schema.prisma` (chỉ khác dòng ghi chú — đơn giản)
Lấy nguyên bản của `main` (đã đầy đủ field + relation + index):
```bash
git checkout --ours prisma/schema.prisma
git add prisma/schema.prisma
```

### 2b. `src/app/kiemke/tasks/[id]/page.tsx` (2 chỗ nhỏ — sửa tay)
Mở file, tìm `<<<<<<<` (có 2 chỗ):
- **Chỗ 1** (dòng `location?: {...}`): giữ bản **có** `type?: string`:
  ```ts
  location?: { id: string; code: string; zone: string; rack: string; level: string; type?: string } | null;
  ```
- **Chỗ 2** (chỉ khác 1 dòng trống): xoá 3 dòng marker `<<<<<<<`, `=======`, `>>>>>>>`, giữ phần còn lại.

Sau đó:
```bash
git add "src/app/kiemke/tasks/[id]/page.tsx"
```

### 2c. `src/app/forklift/relocate/page.tsx` (cần chọn hướng)
Cả 2 nhánh đều viết lại logic "lấy vị trí khả dụng":
- `main`: hiển thị "còn X chỗ" (`remaining_pallets`).
- `vinhgiang1`: lọc vị trí theo **cân nặng pallet** (`/api/locations/available?pallet_weight_kg=...`) — đây là fix mới hơn (`be4101f`).

**Khuyến nghị** — lấy bản `vinhgiang1` (giữ tính năng mới), chấp nhận tạm bỏ nhãn "còn X chỗ":
```bash
git checkout --theirs src/app/forklift/relocate/page.tsx
git add src/app/forklift/relocate/page.tsx
```
> Nếu muốn GIỮ CẢ HAI (vừa lọc theo cân nặng vừa hiện "còn X chỗ"), nhắn tôi — tôi sẽ gửi bản file đã gộp hoàn chỉnh để bạn dán đè.

---

## BƯỚC 3 — Hoàn tất merge
```bash
git commit --no-edit         # đóng merge commit
```

## BƯỚC 4 — Kiểm tra trước khi push
```bash
npx tsc --noEmit             # type-check, không được có lỗi
# (tuỳ chọn) npm run build
```
Nếu type-check lỗi ở relocate/kiemke, sửa theo thông báo rồi `git add` + `git commit --amend --no-edit`.

## BƯỚC 5 — Push & mở PR
```bash
git push -u origin merge/vinhgiang1-into-main
```
Vào GitHub → tạo Pull Request từ `merge/vinhgiang1-into-main` vào `main` → merge. CI sẽ tự deploy `main` lên VPS, các fix sẽ trở lại trên web.

---

## Ghi chú
- Hiện working tree của bạn đang có rất nhiều file "modified" — đó **chỉ là khác CRLF/xuống dòng**, không phải mất code. Nếu vướng khi checkout, chạy `git stash -u` trước Bước 1 để cất tạm, sau xong `git stash drop`.
- 30 fix gồm: kiểm kê (stocktake/kiemke), điều chỉnh (adjustments), khoá dòng đã duyệt, locations, inbound, relocate, RBAC kế toán, cảnh báo tồn kho... — tất cả an toàn trên `origin/vinhgiang1`.
