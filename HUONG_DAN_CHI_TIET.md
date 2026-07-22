# Hướng dẫn chi tiết — khôi phục 30 fix (cách DỄ NHẤT)

Tôi đã tự merge `vinhgiang1` → `main` và giải quyết sẵn cả 3 xung đột, đóng gói vào file
`merge-vinhgiang1.bundle` (nằm ngay trong thư mục `D:\wms-vinhgiang_repo`).
Bạn **không cần sửa code hay xử lý xung đột**. Chỉ cần nạp gói này vào rồi push.

Cách này **không đụng** tới các file đang dở trong máy bạn (mớ "modified" CRLF) — an toàn.

---

## CÁCH LÀM (5 bước)

### Bước 1 — Mở cửa sổ lệnh tại đúng thư mục
- Mở **File Explorer** → vào ổ `D:\wms-vinhgiang_repo`
- Bấm vào ô địa chỉ, gõ `cmd` rồi Enter (mở Command Prompt ngay tại thư mục này).
  *(Hoặc chuột phải khoảng trống → "Open Git Bash here" nếu có Git Bash.)*

### Bước 2 — Xoá file khoá còn sót
Gõ (Command Prompt / PowerShell):
```
del /f .git\index.lock
```
> Nếu báo "Could not find" thì **kệ nó**, nghĩa là không có khoá, đi tiếp.
> (Git Bash thì gõ: `rm -f .git/index.lock`)

### Bước 3 — Cập nhật code mới nhất từ GitHub
```
git fetch origin
```
> Bước này để chắc chắn máy bạn có sẵn 2 mốc commit mà gói cần.

### Bước 4 — Nạp gói merge đã giải quyết sẵn
Command Prompt / PowerShell:
```
git fetch ".\merge-vinhgiang1.bundle" merge/vinhgiang1-into-main:merge/vinhgiang1-into-main
```
> Git Bash thì dùng dấu `/`: `git fetch "./merge-vinhgiang1.bundle" merge/vinhgiang1-into-main:merge/vinhgiang1-into-main`

Thấy dòng `* [new branch] merge/vinhgiang1-into-main -> merge/vinhgiang1-into-main` là **thành công**.

Kiểm tra nhanh (không bắt buộc):
```
git log --oneline -1 merge/vinhgiang1-into-main
```
Phải ra: `ffae6eb Merge branch ... into merge/vinhgiang1-into-main`

### Bước 5 — Đẩy nhánh lên GitHub
```
git push origin merge/vinhgiang1-into-main
```
> Nếu bị hỏi đăng nhập GitHub thì đăng nhập như bình thường.

---

## SAU KHI PUSH — mở Pull Request
1. Vào repo trên GitHub: https://github.com/nathanha2808-hub/vinh_giang_wms
2. Sẽ có nút vàng **"Compare & pull request"** cho nhánh `merge/vinhgiang1-into-main` → bấm vào.
   - Base = `main`, compare = `merge/vinhgiang1-into-main`.
3. Bấm **Create pull request** → đợi CI chạy xanh → bấm **Merge pull request**.
4. CI tự deploy `main` lên VPS. **30 fix sẽ trở lại trên web.**

---

## Tôi đã giải quyết 3 xung đột thế nào (để bạn yên tâm)
- `prisma/schema.prisma`: giữ bản `main` (đã đủ field + quan hệ + index `inbound_temp_id`).
- `src/app/forklift/relocate/page.tsx`: lấy bản `vinhgiang1` (lọc vị trí theo cân nặng pallet — fix mới nhất `be4101f`).
- `src/app/kiemke/tasks/[id]/page.tsx`: **giữ tính năng khoá dòng đã được kế toán chấp nhận** của `vinhgiang1`, đồng thời giữ các thay đổi khác của `main`. Đã kiểm tra các biến `isReadonly / isLineAdjusted / isLineReadonly` đều khai báo đầy đủ.

> Lưu ý nhỏ: bản relocate này tạm bỏ nhãn "còn X chỗ". Nếu muốn giữ cả nhãn đó, nhắn tôi gửi bản gộp khác.

---

## Nếu Bước 4 báo lỗi "does not have prerequisite commits"
Nghĩa là máy bạn chưa có 2 mốc commit cần thiết. Chạy lại:
```
git fetch origin main vinhgiang1
```
rồi làm lại Bước 4.

## Dọn dẹp sau cùng (tuỳ chọn)
Xong xuôi có thể xoá 2 file hướng dẫn + gói:
```
del HUONG_DAN_CHI_TIET.md KHOI_PHUC_FIX_VINHGIANG1.md merge-vinhgiang1.bundle
```
