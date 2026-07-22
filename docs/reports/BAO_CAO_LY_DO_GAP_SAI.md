# 🚨 BÁO CÁO LÝ DO BÁO CÁO GAP MOCKUP SAI

> **Ngày:** 2026-05-25
> **Người viết:** Claude (tự nhận lỗi)
> **Bug:** Báo cáo `BAO_CAO_GAP_MOCKUP_VS_WEB.md` ghi UC-IN-01 "⚠️ Đã redesign khá khớp mockup", thực tế web user thấy THIẾU nhiều trường (chỉ có 3/7 field).

---

## 1. TÓM TẮT NHANH

**Bug:** Tôi báo cáo UC-IN-01 đã có đầy đủ field theo mockup. User mở web `/wms/inbound/new` thấy CHỈ có 3 trường (NCC / Ngày dự kiến / Ghi chú), thiếu hẳn: Mã phiếu auto, Loại nhập, Kho nhận, Người tạo, 3 tabs (Nhập tay / Up Excel / Up NCC lớn), khu drag-drop Excel, cột ĐVT trong bảng dòng hàng.

**Root cause:** Code TRÊN VPS đã bị **edit trực tiếp tay người** sau commit chính thức `c416af2` — xóa **906 dòng** trong `src/app/inbound/new/page.tsx` (từ 1105 dòng xuống còn 380 dòng), downgrade UI thành phiên bản tối giản. Local của tôi vẫn giữ version đầy đủ 1105 dòng (= commit `c416af2`), subagent của tôi đọc local → kết luận "đã khớp mockup". Tôi không verify VPS build, tin ngay kết luận của subagent → báo cáo sai.

**Hậu quả:** User đọc báo cáo của tôi tưởng UC-IN-01 đã OK, không cần fix. Mở web thấy thiếu hẳn → mất niềm tin.

---

## 2. BẰNG CHỨNG CỤ THỂ

### 2.1. File local vs file VPS — KHÁC NHAU dù cùng commit

```
$ wc -l src/app/inbound/new/page.tsx
  Local:  1105 dòng
  VPS:    380 dòng

$ md5sum src/app/inbound/new/page.tsx
  Local:  86d72f178b99e29c6ddf12f1b1093be4
  VPS:    6c7a91547f33758a0aa22a91444f3bd8 (KHÁC)

$ git log --oneline -1 src/app/inbound/new/page.tsx
  Local:  c416af2 feat(inbound): redesign inbound new page to match mockup
  VPS:    c416af2 feat(inbound): redesign inbound new page to match mockup (CÙNG commit)
```

**Phát hiện:** Cùng commit HEAD `c416af2` nhưng file size khác → có **edit thủ công trên VPS** sau commit.

### 2.2. Git status trên VPS — VPS có 54 commits chưa push + 6 file modified

```
$ git status (trên VPS /var/www/wms-vinhgiang)
On branch vinhgiang1
Your branch is ahead of 'origin/vinhgiang1' by 54 commits.

Changes to be committed:
  deleted:    asset/logo.png
  deleted:    header_logo_orig.png
  modified:   prisma/schema.prisma
  modified:   src/app/api/inbound-temp/[id]/standardize/route.ts
  modified:   src/app/api/inbound/import-excel/confirm/route.ts
  modified:   src/app/api/inbound/route.ts
  modified:   src/app/api/item-codes/route.ts
  modified:   src/app/inbound/new/page.tsx       ← FILE BỊ EDIT
  modified:   src/app/inbound/page.tsx

$ git diff --stat HEAD src/app/inbound/new/page.tsx
  src/app/inbound/new/page.tsx | 1087 +++++++-----------------------------------
  1 file changed, 181 insertions(+), 906 deletions(-)
```

**Phát hiện:**
- VPS đang ahead 54 commits → có người đã commit nhiều thứ trên VPS không push lên git remote
- Có 8 file uncommitted + staged trên VPS, 1 trong số đó là `inbound/new/page.tsx` bị XÓA 906 dòng (tức là UI đầy đủ → tối giản 3 trường)

### 2.3. Mockup vs Code commit gốc — code commit ĐÚNG là khớp mockup

File local 1105 dòng (= commit `c416af2`) có đầy đủ:
- ✅ Tab `manual` / `excel` / `unilever` (line 39)
- ✅ State `proposedCode` cho Mã phiếu auto (line 42)
- ✅ State `creatorName` (line 46)
- ✅ Field `import_type` + `warehouse` trong form state (line 52-53)
- ✅ Select Loại nhập với 3 option (line 553-555)
- ✅ Select Kho nhận với 2 option (line 569-570)
- ✅ Input readonly Người tạo (line 581)
- ✅ Tab Excel với drag-drop + step 1/2/3
- ✅ Tab Unilever

File VPS 380 dòng đã bị xóa toàn bộ:
- ❌ Không còn 3 tabs
- ❌ Không còn Mã phiếu auto display
- ❌ Không còn Loại nhập, Kho nhận, Người tạo
- ❌ Không còn khu drag-drop Excel
- ❌ Form chỉ giữ 3 field: NCC + Ngày dự kiến + Ghi chú

**Kết luận:** Code commit (1105 dòng) HOÀN TOÀN khớp mockup. Code VPS hiện chạy (380 dòng) là phiên bản đã bị downgrade thủ công.

---

## 3. TẠI SAO TÔI BÁO CÁO SAI — CHUỖI 5 SAI LẦM

### Sai lầm #1: Delegate cho subagent mà không verify

Khi user yêu cầu đối chiếu mockup vs web, tôi spawn 5 subagent song song mỗi agent xử lý 1 nhóm UC. Subagent dùng tool `Read` đọc file local `src/app/inbound/new/page.tsx` → thấy 1105 dòng đầy đủ → kết luận "khớp khá tốt với mockup".

**Sai chỗ nào:**
- Subagent KHÔNG biết VPS đang chạy build từ file khác
- Subagent KHÔNG mở web để verify visual
- Tôi nhận output của subagent và copy nguyên vào báo cáo, KHÔNG verify lại

### Sai lầm #2: Tin commit message mà không đọc diff

Commit `c416af2 feat(inbound): redesign inbound new page to match mockup and support warehouse and import_type` — message có vẻ đầy đủ, tôi đã tin và ghi vào báo cáo:

> "Đã redesign khá khớp mockup (commit c416af2)"

**Sai chỗ nào:**
- Commit message chỉ là *ý định* của tác giả khi commit, không phải *state thực tế* trên VPS sau khi có người sửa lại
- VPS có thể bị edit thủ công sau commit, message không phản ánh điều đó

### Sai lầm #3: Không kiểm tra `git status` trên VPS

Nếu tôi chạy `node vps-deploy.js exec "cd /var/www/wms-vinhgiang && git status"` ngay lúc đối chiếu mockup, sẽ thấy:
- VPS ahead 54 commits chưa push
- 8 file đang modified/staged

→ Tôi sẽ biết VPS != git remote → cần đối chiếu code VPS chứ không phải code local.

**Sai chỗ nào:**
- Đối chiếu UI thì phải đối chiếu thứ user THẤY (= build từ VPS), không phải code trên local

### Sai lầm #4: Không yêu cầu user mở web để verify

Sau khi viết báo cáo gap, tôi không bảo user "mở web này check thử xem báo cáo có đúng không". Nếu user mở từ đầu, sẽ phát hiện ngay UC-IN-01 không khớp.

### Sai lầm #5: Tin file local = production build

Tôi mặc định local code = production code. Trong dự án này:
- Local clone từ `origin/vinhgiang1` (state cũ)
- VPS có 54 commits + 6 file edit thủ công chưa push back lên git remote

→ Local KHÔNG phải là source of truth. **VPS mới là source of truth thực tế.**

---

## 4. AI ĐÃ EDIT FILE VPS? (KHÔNG XÁC ĐỊNH ĐƯỢC)

Không có log nào ghi lại ai đã `vi /var/www/wms-vinhgiang/src/app/inbound/new/page.tsx` để xóa 906 dòng. Có thể:

| Giả thuyết | Khả năng |
|---|---|
| User tự sửa để demo phiên bản tối giản | Có thể (vì user là chủ project) |
| Collaborator khác sửa trực tiếp | Có thể (nhiều người có SSH access?) |
| Script tự động (CI/CD) downgrade | Khả năng thấp (không thấy script nào trong repo làm vậy) |
| Lỗi merge / git checkout sai branch | Có thể (nhưng VPS đang clean ở branch vinhgiang1) |

**Cách phòng:** Cấm edit code trực tiếp trên VPS. Mọi thay đổi phải qua git commit local → push remote → pull VPS → build.

---

## 5. HẬU QUẢ VỚI BÁO CÁO GAP TRƯỚC ĐÓ

Báo cáo `BAO_CAO_GAP_MOCKUP_VS_WEB.md` của tôi **có thể đã sai ở NHIỀU UC khác**, không chỉ UC-IN-01. Cụ thể, các file VPS đang modified mà tôi đối chiếu sai trên local:

| File local (kết luận của tôi) | File VPS (thực tế user thấy) | UC bị ảnh hưởng |
|---|---|---|
| `src/app/inbound/new/page.tsx` (1105 dòng — đầy đủ) | 380 dòng — tối giản | **UC-IN-01** |
| `src/app/inbound/page.tsx` | Modified (chưa check diff) | UC-IN-05 |
| `src/app/api/inbound/route.ts` | Modified | API gọi từ UC-IN-01 |
| `src/app/api/inbound/import-excel/confirm/route.ts` | Modified | UC-IN-06 |
| `src/app/api/inbound-temp/[id]/standardize/route.ts` | Modified | UC-INTMP-02 |
| `src/app/api/item-codes/route.ts` | Modified | UC-MD-02 |
| `prisma/schema.prisma` | Modified (khác với migration P0 của tôi) | Toàn bộ DB |

**→ Báo cáo gap CẦN ĐỌC LẠI** từng UC trong các nhóm Inbound, Inbound Temp, Item Codes → đối chiếu với code VPS, không phải local.

---

## 6. KIẾN NGHỊ KHẮC PHỤC

### 6.1. Khắc phục ngay UC-IN-01 (2 lựa chọn)

**Option A — Revert file VPS về commit `c416af2` gốc (lấy lại 1105 dòng đầy đủ field):**
```bash
node vps-deploy.js exec "cd /var/www/wms-vinhgiang && git checkout HEAD -- src/app/inbound/new/page.tsx"
node vps-deploy.js build wms
node vps-deploy.js restart wms
```
- **Ưu:** Khôi phục đầy đủ field theo mockup ngay lập tức
- **Nhược:** Mất thay đổi mà ai đó cố tình làm (có thể có lý do nghiệp vụ)

**Option B — Đè file local 1105 dòng lên VPS (cùng kết quả như A):**
```bash
node vps-deploy.js sync-files src/app/inbound/new/page.tsx
node vps-deploy.js build wms
node vps-deploy.js restart wms
```

### 6.2. Đồng bộ lại workflow git

VPS đang ahead 54 commits + 6 file modified — đây là **rủi ro nghiêm trọng** cho team:
- Mọi thay đổi sẽ mất nếu VPS bị reset
- Không ai khác có thể tiếp tục công việc đó
- Khó audit ai đã sửa gì

**Đề xuất:**
1. SSH vào VPS, `git diff HEAD` xem 6 file modified — quyết định giữ hay bỏ
2. Nếu giữ: `git commit -m "..."` rồi `git push origin vinhgiang1` để đẩy 54+1 commit lên git remote
3. Local pull về: `git pull origin vinhgiang1` để đồng bộ
4. Cấm edit code trực tiếp trên VPS sau khi đồng bộ

### 6.3. Quy trình audit báo cáo lần sau

**Cho Claude (tôi):** Trước khi báo cáo "UC X đã khớp mockup", PHẢI:
1. Đọc file LOCAL của UC đó
2. So sánh MD5 với file VPS: `node vps-deploy.js exec "md5sum <path>"`
3. Nếu khác → đọc file VPS để biết user thật thấy gì
4. Yêu cầu user mở web URL của UC đó → so sánh visual với mockup
5. Chỉ kết luận sau khi 3 nguồn (mockup / code VPS / browser visual) đều khớp

**Cho user:** Sau mỗi báo cáo gap quan trọng, mở 2-3 UC bất kỳ trên web để kiểm chéo. Đừng tin 100% nếu Claude chưa verify visual.

---

## 7. CHECKLIST RÀ SOÁT LẠI BÁO CÁO GAP

Báo cáo `BAO_CAO_GAP_MOCKUP_VS_WEB.md` cần được rà lại các UC sau (vì file liên quan đã bị edit thủ công trên VPS):

- [ ] **UC-IN-01** (Lập PHN) — đã xác nhận SAI, file VPS tối giản
- [ ] **UC-IN-05** (Theo dõi phiếu) — file `inbound/page.tsx` modified
- [ ] **UC-IN-06** (Import Excel NCC) — file `import-excel/confirm/route.ts` modified
- [ ] **UC-INTMP-02** (Chuẩn hóa phiếu tạm) — file `inbound-temp/[id]/standardize/route.ts` modified
- [ ] **UC-MD-02** (Mã hàng) — file `api/item-codes/route.ts` modified
- [ ] Schema DB — file `prisma/schema.prisma` modified (có thể conflict với migration P0)

**Cách rà lại:** Cho mỗi UC, chạy:
```bash
node vps-deploy.js exec "cat /var/www/wms-vinhgiang/<path> | head -100"
```
So sánh với local + mockup, viết lại section trong báo cáo gap.

---

## 8. LỜI XIN LỖI VÀ CAM KẾT

Tôi nhận trách nhiệm hoàn toàn việc báo cáo SAI dẫn đến user mất thời gian và niềm tin. Cụ thể:

1. Tôi đã ghi "UC-IN-01 đã redesign khá khớp mockup" trong khi web thực tế chỉ có 3/7 field
2. Tôi đã không verify build trên VPS trước khi kết luận
3. Tôi tin tưởng kết quả của subagent mà không double-check
4. Tôi đã viết lộ trình `LO_TRINH_FIX_GAP_DETAILED.md` skip UC-IN-01 (vì tưởng đã OK), trong khi UC-IN-01 thật sự cần fix gấp

**Cam kết:**
- Từ giờ trước khi báo cáo UC nào "đã khớp" → check MD5 file local vs VPS + đọc cả 2 nếu khác
- Sau mỗi sửa code → tự build VPS + verify HTTP 200 + báo cáo visual rõ ràng (không chỉ "deploy xong")
- Đề nghị user mở web check 1-2 UC ngẫu nhiên sau mỗi báo cáo gap

---

**HẾT BÁO CÁO.** Đề nghị user chọn Option A hoặc B trong §6.1 để khôi phục UC-IN-01 ngay.
