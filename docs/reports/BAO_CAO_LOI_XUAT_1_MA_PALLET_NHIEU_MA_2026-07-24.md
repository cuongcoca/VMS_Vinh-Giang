# Báo cáo lỗi — Xuất một mã trên pallet nhiều mã: "không hiện chỗ xuất"

**Ngày:** 2026-07-24 · **Màn hình:** Xe nâng → Chuyển khu chờ xuất (FEFO) → modal "Rút một phần" (TH-B)
**Triệu chứng:** *"Xuất một cột hàng trên một pallet có nhiều cột hàng nhưng không xuất được (không hiện chỗ xuất)."*

> ## ✅ ĐÃ SỬA XONG — 2026-07-24
>
> Chốt của chủ dự án: cho cả hộp thoại **cuộn** · sửa luôn.
>
> **Sửa 1 file** `src/app/forklift/stage-out/page.tsx`: overlay `items-start` + `overflow-y-auto`,
> hộp thoại `max-h-[92vh]` + `overflow-y-auto` + `my-auto`; tiêu đề cho mã pallet `break-all` để không xuống 4 dòng.
>
> | Kiểm chứng trên app thật | Kết quả |
> |---|---|
> | Màn hình thấp 400×600 (trước: nút khuất) | Hộp thoại **cuộn được**; cuộn xuống → nút "Rút 7 thùng → STG-OUT-01" hiện đủ (top 512, bottom 552 < 600) |
> | Bấm xuất thật | POST 200; pallet con **PLMULTI.001-P1** ra STG-OUT-01 (7 thùng), pallet cha giữ VG-NM-500 (10 thùng) |
> | Màn hình cao 375×812 (hồi quy) | Modal vẫn canh giữa đẹp (top 72, bottom 720 < 812), không dính đỉnh |
>
> `npx tsc --noEmit` sạch. Lint giống hệt baseline (không phát sinh lỗi mới). **Không** đụng backend.
>
> Phần dưới là báo cáo phân tích ban đầu.

---

## 1. Kết luận — đã tái hiện 100% và tìm ra gốc

**Không phải lỗi nghiệp vụ, cũng không phải thiếu khu chờ xuất — mà là lỗi GIAO DIỆN: hộp thoại xuất bị tràn màn hình và không cuộn được, khiến nút "Rút … thùng" bị đẩy khuất bên dưới, không bấm tới được.**

Người dùng đọc thành "không hiện chỗ xuất" vì phần cuối hộp thoại (nút xác nhận) nằm ngoài vùng nhìn thấy.

### Bằng chứng đo trực tiếp
Dựng đúng bối cảnh (pallet `PLMULTI.001` có 2 mã, chọn xuất 1 mã VG-DA-1000, mode TH-B) rồi đo trên màn hình cao 600px:

```
Nút "Rút 7 thùng → STG-OUT-01":  top = 603px  (viewport chỉ cao 600px)  → nằm DƯỚI màn hình
Hộp thoại: scrollHeight = clientHeight = 737px → KHÔNG cuộn được
→ Nút có trong trang nhưng bị khuất, không có cách nào chạm tới.
```

Ảnh chụp tái hiện khớp **y hệt** ảnh của bạn: đầu hộp thoại (tiêu đề "Chuyển … sang khu chờ xuất") bị cắt phía trên, phần dưới chỉ thấy tới "VỊ TRÍ KHU CHỜ XUẤT" rồi hết — **không thấy nút xuất**.

---

## 2. Vì sao xảy ra

`src/app/forklift/stage-out/page.tsx:260-261` — hộp thoại:

```tsx
<div className="fixed inset-0 ... flex items-center justify-center p-4">   // canh GIỮA
  <div className="bg-white rounded-2xl ... w-full max-w-lg">              // KHÔNG có max-h, KHÔNG overflow-y-auto
```

Hai điểm cộng lại gây lỗi:
1. **Overlay canh giữa** (`items-center`) — khi nội dung cao hơn màn hình, hộp thoại tràn **cả trên lẫn dưới** đều nhau.
2. **Hộp thoại không giới hạn chiều cao và không cuộn** (`w-full max-w-lg` — thiếu `max-h-[90vh] overflow-y-auto`) → phần vượt ra ngoài **không cuộn tới được**.

Kết quả: tiêu đề bị cắt trên, **nút xác nhận bị cắt dưới**.

### Vì sao đúng lúc "pallet nhiều mã, rút một phần" mới lộ
- Chế độ **TH-B (rút một phần)** thêm hẳn một khối "SỐ THÙNG CẦN RÚT" (ô +/−) và một đoạn ghi chú dài về pallet con → hộp thoại **cao thêm ~150px** so với TH-A.
- Pallet **nhiều mã** mới hiện thêm khối cảnh báo đỏ "Pallet này có N mã hàng…" → cao thêm nữa.
- Tiêu đề "Chuyển `PLMULTI.001` sang khu chờ xuất" **xuống dòng xấu** (mã pallet dài đẩy chữ "sang khu chờ xuất" thành 4 dòng) → tốn thêm chiều cao.

→ Chỉ khi gộp đủ (nhiều mã + rút một phần) trên **màn hình không đủ cao**, hộp thoại mới vượt ngưỡng và nút bị khuất. Máy tính/điện thoại màn hình cao thì vẫn thấy nút, nên lỗi "lúc được lúc không" tùy thiết bị — đúng kiểu khó bắt.

---

## 3. Hướng sửa (đề xuất)

Sửa **một chỗ** — cho hộp thoại giới hạn chiều cao và **cuộn được**:

```tsx
// Overlay: cho cuộn khi tràn, canh từ trên xuống thay vì giữa
<div className="fixed inset-0 ... flex items-start justify-center p-4 overflow-y-auto">
  {/* Hộp thoại: giới hạn chiều cao + tự cuộn nội dung */}
  <div className="bg-white rounded-2xl ... w-full max-w-lg max-h-[90vh] overflow-y-auto my-auto">
```

Hoặc tách phần thân cuộn riêng, giữ nút xác nhận **dính đáy** (`sticky bottom-0`) để luôn thấy nút.

Kèm hai chỉnh nhỏ cho gọn (không bắt buộc):
- Tiêu đề: cho mã pallet `break-all` / bỏ `flex` để không xuống 4 dòng.
- Cân nhắc thu gọn đoạn ghi chú pallet con.

**Không** đụng backend — luồng rút một phần đã kiểm tra chạy đúng (tạo pallet con cho phần rút, pallet cha giữ các mã còn lại). Đây thuần lỗi bố cục hộp thoại.

---

## 4. Việc cần bạn xác nhận

1. **Kiểu sửa** — cho cả hộp thoại **cuộn** (đơn giản, đề xuất), hay giữ nút xác nhận **dính đáy** luôn nhìn thấy (đẹp hơn, nhỉnh phức tạp hơn)?
2. Có muốn mình **sửa luôn** (đây là lỗi bố cục 1 chỗ, rủi ro thấp) rồi test trên nhiều cỡ màn hình cho bạn xem không?

> Ghi chú môi trường: DB local mình vừa tạo pallet test `PLMULTI.001` (2 mã) + đổi `STG-OUT-01` thành khu chờ xuất để tái hiện. Xóa khi cần:
> `DELETE FROM pallet_lines WHERE pallet_id IN (SELECT id FROM pallets WHERE code='PLMULTI.001'); DELETE FROM pallets WHERE code='PLMULTI.001';`
