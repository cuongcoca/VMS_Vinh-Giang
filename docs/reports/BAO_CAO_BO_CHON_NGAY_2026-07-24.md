# Báo cáo — Bộ chọn ngày (DateField) trên giao diện mobile

**Ngày:** 2026-07-24 · **Màn hình gặp:** Thủ kho → chi tiết pallet → thêm hàng → ô **HSD** (và mọi ô ngày mobile khác)

> ## ✅ ĐÃ THỰC HIỆN XONG — 2026-07-24
>
> Chốt của chủ dự án: 1) tiêu đề hai nút · 2) giữ lịch mặc định cho desktop · 3) không giới hạn năm.
>
> Sửa **một file** `src/components/mobile/DateField.tsx` → cả 6 màn mobile cùng nâng.
>
> | Thay đổi | Kiểm chứng trên app thật |
> |---|---|
> | Tiêu đề = 2 nút pill `[Tháng 7 ▾] [2025 ▾]` có mũi tên xổ | Nhìn rõ là nút, hết cảnh "chữ trông giống nhau" |
> | Bấm nút tháng → lưới 12 tháng (Th1…Th12) | Chọn tháng nhảy thẳng, không phải bấm mũi tên nhiều lần |
> | Bấm nút năm → lưới 12 năm | Có sẵn, nay dễ thấy |
> | Chọn tháng/năm → về lịch ngày (nhất quán, giống lịch chuẩn) | Đổi năm giữ nguyên tháng; mở lại nhảy đúng ngày đã chọn |
> | Mũi tên `‹ ›` lùi/tới từng tháng | Giữ nguyên |
> | Nút Xóa / Hôm nay | Vẫn chạy đúng |
>
> Bố cục không tràn kể cả "Tháng 12 / 2027". `npx tsc --noEmit` sạch, không lỗi console.
> **Không** đổi cách các màn gọi (`value`/`onChange` giữ nguyên), **không** migration.
> Desktop (`type=date`) giữ nguyên lịch mặc định theo yêu cầu.
>
> Phần dưới là báo cáo phân tích ban đầu.

---

## 1. Hiện trạng — đã kiểm chứng bằng thao tác thật

Ô ngày trong ảnh bạn gửi là component tự vẽ `src/components/mobile/DateField.tsx` (không dùng lịch mặc định của điện thoại, để giống nhau trên iOS/Android). Chạy thử trên app, tôi xác nhận:

| Chức năng | Hiện có? | Cách dùng thực tế |
|---|---|---|
| Chọn **ngày** | ✅ | Bấm thẳng vào ô ngày trong lưới |
| Nhảy **tháng** | ⚠️ Chỉ bằng mũi tên `‹ ›` | Từ Th7 tới Th12 phải bấm **5 lần** mũi tên |
| Nhảy **năm** | ✅ Có, nhưng **ẩn** | Bấm vào số năm ở tiêu đề → hiện lưới 12 năm |

**Hai vấn đề cốt lõi:**

1. **Không nhảy tháng nhanh được.** Đây là điểm đau nhất. HSD thường cách 1–3 năm, nên đổi tháng bằng mũi tên từng bước rất mệt. Không có cách bấm thẳng vào một tháng.

2. **Nút chọn năm vô hình.** Số năm `2026` trên tiêu đề **thực ra bấm được** (mở lưới chọn năm), nhưng trông y hệt chữ `Tháng 7` bên cạnh — vốn KHÔNG bấm được. Không có mũi tên xổ, không gạch chân, không viền. Người dùng không thể đoán ra là bấm được → nên mới có cảm giác "không chọn năm được".

Nói cách khác: tính năng gần đủ, nhưng **giấu mất một nửa** và **thiếu hẳn bước chọn tháng**.

---

## 2. Phạm vi — hai loại ô ngày trong dự án

| Loại | Ở đâu | Trạng thái |
|---|---|---|
| **`DateField` tự vẽ** | 6 màn **mobile**: chi tiết pallet, tạo pallet, xe nâng hoàn trả, lịch sử xe nâng, kiểm kê | ⚠️ Là cái bạn đang gặp — cần nâng cấp |
| **`<input type="date">` mặc định** | ~14 màn **desktop**: phiếu nhập, tồn kho, báo cáo, audit log… | ✅ Trình duyệt tự cho lịch có xổ ngày/tháng/năm — đã "chuyên nghiệp" sẵn, không cần sửa |

→ Yêu cầu của bạn nhắm đúng vào `DateField` mobile. Sửa **một file** này là toàn bộ 6 màn mobile cùng đẹp lên.

---

## 3. Đề xuất — 3 bước, giữ nguyên thao tác cũ

Nâng `DateField` lên chuẩn "lịch 3 tầng" như các app chuyên nghiệp (Google Calendar, Material Design):

**Tiêu đề mới:** thay `Tháng 7 / 2026` (chữ thường) bằng **hai nút bấm rõ ràng** có mũi tên xổ:

```
   ‹     [ Tháng 7 ▾ ]  [ 2026 ▾ ]     ›
```

- Bấm **`Tháng 7 ▾`** → hiện lưới **12 tháng** (Th1…Th12), chọn cái nào nhảy thẳng cái đó
- Bấm **`2026 ▾`** → hiện lưới **12 năm** (đã có sẵn, chỉ làm cho dễ thấy)
- Vẫn giữ mũi tên `‹ ›` để lùi/tới từng tháng khi cần chỉnh nhẹ
- Nút **Xóa** / **Hôm nay** giữ nguyên

**Kết quả:** chọn bất kỳ ngày/tháng/năm nào cũng chỉ **1–2 chạm**, thay vì bấm mũi tên nhiều lần. Người mới nhìn là biết ngay tháng và năm đều bấm được.

**Về kỹ thuật:** component đã có sẵn `mode: "day" | "year"`. Chỉ cần thêm `"month"` song song với `"year"` (cùng khuôn lưới 12 ô). Sửa gọn trong 1 file, **không** đụng dữ liệu, **không** đổi cách các màn khác gọi (`value` / `onChange` giữ nguyên). Không migration.

---

## 4. Việc cần bạn quyết

1. **Chốt kiểu tiêu đề** — hai nút pill `[Tháng 7 ▾] [2026 ▾]` (đề xuất), hay bạn muốn gộp thành một nút `[Tháng 7, 2026 ▾]` mở bảng chọn chung?
2. **Ô ngày desktop** (`type=date`) đang dùng lịch mặc định trình duyệt — giữ nguyên (đề xuất, vì đã tốt), hay muốn đồng bộ luôn cho giống mobile?
3. **Giới hạn năm** — có cần chặn không cho chọn năm quá xa (vd chỉ 2020–2035) để tránh gõ nhầm HSD, hay để tự do?
