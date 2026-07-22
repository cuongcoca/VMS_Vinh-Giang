# BÁO CÁO: QR Code vs Mã vạch (Barcode) trong WMS Vĩnh Giang

**Ngày:** 2026-05-26
**Nguồn:** `wms_mockups_4.html` (4138 dòng) + đối chiếu code thực tế.
**Mục đích:** Phân biệt rõ luồng nào dùng QR Code, luồng nào dùng Mã vạch (barcode 1D). Ai in mã nào.

---

## 1. Khác biệt cơ bản giữa QR Code và Mã vạch

| | **Mã vạch (Barcode 1D)** | **QR Code (2D)** |
|---|---|---|
| **Hình dáng** | Vạch sọc đen ngang ▎▎▎▎ | Ô vuông pixel đen trắng ▓▓ |
| **Format chuẩn** | EAN-13, EAN-8, Code-128, Code-39, UPC | QR Code |
| **Encode được** | Chỉ số/chữ ngắn (~13 ký tự) | Text dài tùy ý, URL, JSON |
| **Quét dễ ở khoảng cách** | 5-15cm | 15-30cm |
| **Chịu mờ/bẩn** | Rất kém — 1 vạch bẩn = quét fail | Tốt — có error correction tới 30% |
| **Tốc độ quét** | Nhanh hơn (đơn giản) | Tương đương trên điện thoại đời mới |
| **Ai in/dán?** | **NHÀ SẢN XUẤT** in sẵn trên bao bì | **KHO MÌNH** tự in để dán |

---

## 2. Mockup gợi ý gì?

Bằng chứng từ `wms_mockups_4.html`:

### Bằng chứng 1 — Camera support 4 format (dòng 3955)
> `Hỗ trợ: EAN-13, EAN-8, Code-128, QR Code`

→ Camera scanner cần đọc **cả 4 format**. Đã config trong code FE.

### Bằng chứng 2 — UC-PAL-03 đa phương thức (dòng 1213)
> `Hỗ trợ: Quét mã vạch, Quét QR, Chụp ảnh mã vỏ thùng, Tìm danh mục, Nhập tay dự phòng.`

→ UC-PAL-03 (Thủ kho thêm dòng pallet) chấp nhận CẢ barcode CẢ QR — vì vỏ thùng có thể là EAN từ NCC, hoặc QR tự dán nếu hàng cũ.

### Bằng chứng 3 — Mã vạch ví dụ EAN-13 (dòng 1276)
> `Mã vạch: 8934567890123`

→ Mã vạch sản phẩm = EAN-13 (in trên thùng nước mắm Vĩnh Giang). Đây là mã NHÀ SẢN XUẤT in.

### Bằng chứng 4 — Khai báo sản phẩm có trường barcode (dòng 605, 696)
> `Trường: SKU, Tên, ĐVT, Quy cách, Trọng lượng/thùng, Mã vạch...`
> `<input placeholder="VD: 8934567890123" />`

→ Master data có cột `barcode` lưu EAN-13. Đây là barcode duy nhất cho 1 SKU.

### Bằng chứng 5 — QR vị trí (dòng 3203)
> `Hướng camera vào QR vị trí`

→ Vị trí kho dùng **QR**, không phải barcode. Mã text `A-03-02`.

### Bằng chứng 6 — Mã pallet auto-sinh (dòng 1066)
> `Mã pallet sẽ được sinh tự động`

→ Pallet code = chuỗi như `PL260506.005`. **Mình tự in QR** từ code này.

---

## 3. Bảng mapping CHI TIẾT — luồng nào dùng mã gì

| # | UC / Tính năng | Loại mã | Ai in/dán? | Lý do dùng loại đó |
|---|---|---|---|---|
| **1** | UC-FK-02 — Quét vị trí (Xe nâng put-away) | **QR Code** | Kho tự in dán lên kệ | Mã `A-03-02` không có sẵn ở đâu |
| **2** | UC-FK-03 — Chuyển vị trí (Xe nâng relocate) | **QR Code** | Kho tự in dán lên kệ | Như #1 |
| **3** | UC-FK-04 — Rút FEFO (Xe nâng quét mã hàng) | **Barcode (EAN-13)** | NCC in sẵn trên vỏ thùng | Mã hàng = EAN trên thùng sản phẩm |
| **4** | UC-INV-06 — Kiểm kê vị trí | **QR Code** | Kho tự in dán lên kệ | Như #1 |
| **5** | UC-PAL-03 — Thủ kho thêm dòng vào pallet | **Cả 2** (ưu tiên Barcode) | NCC in EAN, kho có thể dán QR phụ | Vỏ thùng có sẵn EAN, đôi khi tự dán QR cho hàng cũ |
| **6** | Quét nhanh pallet (top bar xe nâng) | **QR Code** | Kho tự in dán lên pallet | Mã `PL260506.005` mình tự sinh |
| **7** | UC-INV-09 — Kiểm kê hàng tạm | **QR Code** (vị trí) + **Barcode** (mã hàng) | Cả 2 | Phối hợp |
| **8** | Login QR (auth) | **QR Code** | Hệ thống sinh session token | URL phiên đăng nhập |

---

## 4. Mã vạch (Barcode) — TỪ ĐÂU MÀ CÓ

### 4.1 Nguồn gốc
- **Vĩnh Giang tự sản xuất**: nước mắm, tương ớt, gia vị... → mỗi SKU có 1 mã EAN-13 đăng ký với GS1 Việt Nam.
- Mã EAN-13 in sẵn trên **bao bì thùng** (24 chai/thùng) khi xuất xưởng.
- VD: thùng nước mắm 500ml có thể có EAN-13 = `8934567890123` in ngoài vỏ thùng.

### 4.2 Lưu ở đâu trong WMS
- Bảng `products`, cột `barcode` (VARCHAR, unique)
- Mỗi SKU = 1 barcode duy nhất
- Form khai báo sản phẩm `/wms/master-data` có ô "Mã vạch (Barcode)"

### 4.3 Khi nào kho QUÉT mã vạch?
| Tình huống | Ai quét | Mục đích |
|---|---|---|
| Thủ kho nhận hàng từ NCC | Thủ kho | Tự động điền mã SKU vào pallet (UC-PAL-03) |
| Xe nâng cần rút theo SKU | Xe nâng | Tìm pallet FEFO nhanh (UC-FK-04) |
| Tra cứu nhanh sản phẩm | Bất kỳ | Hiện info SKU (master-data) |
| Quét khi soạn đơn xuất | Soạn đơn | Đối chiếu đơn vs hàng |

### 4.4 KHÔNG cần in mã vạch
**Mã vạch ĐÃ in sẵn trên thùng — kho KHÔNG cần in lại.** Trừ trường hợp:
- Hàng cũ chưa có barcode → Kho có thể in barcode tạm (Code-128 từ SKU) dán lên thùng
- Hàng tự sản xuất nội bộ chưa đăng ký GS1 → tự in

→ Nhưng tình huống này HIẾM. 95% trường hợp dùng EAN có sẵn.

---

## 5. QR Code — MÌNH TỰ IN

### 5.1 Có 2 loại QR mình phải tự in dán

#### 🟦 QR Vị trí kho (Location QR)
- **Nội dung QR:** mã text `A-03-02`, `B-01-05`...
- **In ở đâu:** lên decal A4 hoặc sticker dán lên **mép kệ** ở mỗi ô lưu trữ
- **Kích thước in:** tối thiểu **5cm × 5cm** để quét từ 15-25cm
- **Tần suất in:** 1 lần lúc setup kho mới + bổ sung khi thêm vị trí
- **Số lượng dự kiến:** = số ô lưu trữ trong kho (vd 200 ô = in 200 QR)
- **Trang in:** [/wms/locations/qr-print](src/app/locations/qr-print/page.tsx)

#### 🟨 QR Pallet (Pallet QR)
- **Nội dung QR:** mã text `PL260506.005`, `PL260506.011-P1`...
- **In ở đâu:** lên decal nhỏ dán lên **góc pallet** (cạnh trên cùng, dễ thấy)
- **Kích thước in:** tối thiểu **3cm × 3cm** (nhỏ hơn vị trí vì pallet di động, scan gần được)
- **Tần suất in:** **mỗi lần tạo pallet mới** (thủ kho in liền sau khi confirm pallet)
- **Số lượng dự kiến:** = số pallet đang active trong kho (vd 500 pallet)
- **Trang in:** [/wms/pallets/qr-print](src/app/pallets/qr-print/page.tsx)

### 5.2 Có cần in QR cho sản phẩm không?
**KHÔNG.** Sản phẩm dùng barcode EAN có sẵn trên vỏ thùng. Không in QR cho SKU.

### 5.3 Quy trình in QR vị trí (Kế toán/Quản lý làm)
```
1. Mở /wms/locations trên desktop
2. Khai báo các vị trí (Khu/Kệ/Tầng): A-01-01 → A-15-08, B-01-01 → ...
3. Bấm nút "In QR" (góc phải trên)
4. Trang /wms/locations/qr-print load grid QR
5. Ctrl+P → in A4 (4 QR / trang)
6. Cắt dán lên kệ thực tế
```

### 5.4 Quy trình in QR pallet (Thủ kho làm)
```
1. Mở /wms/pallets sau khi confirm pallet
2. Tìm pallet vừa tạo
3. Bấm "In QR" → trang in
4. In ra decal nhỏ
5. Dán lên góc pallet trước khi xe nâng đẩy đi
```

---

## 6. CAMERA — quét được cả 2

Code FE đã config camera support **cả 4 format trong 1 modal**:

```typescript
// src/components/BarcodeScanner.tsx
formatsToSupport: [
  Html5QrcodeSupportedFormats.EAN_13,    // ← barcode sản phẩm
  Html5QrcodeSupportedFormats.EAN_8,     // ← barcode rút gọn
  Html5QrcodeSupportedFormats.CODE_128,  // ← barcode in tay
  Html5QrcodeSupportedFormats.CODE_39,   // ← barcode in tay
  Html5QrcodeSupportedFormats.QR_CODE,   // ← QR vị trí/pallet
]
```

→ User KHÔNG cần chọn loại mã trước khi quét. Camera tự nhận diện cả 2.

→ **Backend resolve qua `/api/scan/resolve`** rồi tự routing theo type:
- Nếu là EAN-13 → match `products.barcode` → trả về SKU
- Nếu là `A-XX-XX` text → match `locations.code` → trả về Location
- Nếu là `PLYYMMDD.NNN` text → match `pallets.code` → trả về Pallet

---

## 7. Tóm tắt 1 trang cho team vận hành

### 🏭 Vĩnh Giang đã có MÃ VẠCH sẵn (EAN-13)
- Thùng nước mắm, tương ớt, gia vị... đều **đã in barcode** trên vỏ thùng từ nhà máy
- Kho **KHÔNG cần in** barcode cho sản phẩm
- Khi nhập hàng / xuất hàng → camera **đọc thẳng** mã vạch in sẵn

### 🏭 Vĩnh Giang phải tự IN QR cho 2 loại
- **QR Vị trí kệ** (`A-03-02`) — in 1 lần lúc setup kho → dán lên kệ
- **QR Pallet** (`PL260506.005`) — in mỗi khi tạo pallet mới → dán lên pallet

### 📱 Camera đọc CẢ HAI — không cần phân biệt
Xe nâng / thủ kho / kiểm kê mở app → bấm "Quét" → camera nhận **cả barcode** trên vỏ thùng, **cả QR** trên kệ/pallet. Backend tự hiểu mã đó là gì.

---

## 8. Checklist setup ban đầu

| Việc | Ai làm | Khi nào | Tần suất |
|---|---|---|---|
| Khai báo SKU + nhập barcode EAN-13 vào `products` | Kế toán/Quản lý | Trước khi vận hành | 1 lần / SKU |
| Khai báo vị trí (Location) | Kế toán/Quản lý | Setup kho | 1 lần / vị trí |
| In QR vị trí 5×5cm → dán lên kệ | Kế toán/Quản lý | Sau khi khai báo Location | 1 lần / vị trí |
| Tạo Pallet mới | Thủ kho | Khi nhận lô hàng | Mỗi lô |
| In QR pallet 3×3cm → dán lên pallet | Thủ kho | Ngay sau khi confirm pallet | Mỗi pallet |
| Quét barcode hàng (nhập/xuất) | Thủ kho / Xe nâng | Vận hành hàng ngày | Mỗi thùng |
| Quét QR vị trí (put-away/relocate/kiểm kê) | Xe nâng / Kiểm kê | Vận hành hàng ngày | Mỗi lần |

---

## 9. Trạng thái triển khai trong code

| Hạng mục | Trạng thái | File |
|---|---|---|
| Schema `products.barcode` (EAN-13) | ✅ Có sẵn | [prisma/schema.prisma](prisma/schema.prisma) |
| Form khai báo barcode sản phẩm | ✅ Có | [src/app/master-data/page.tsx](src/app/master-data/page.tsx) |
| API `/api/item-codes/by-barcode` resolve EAN | ✅ Có | [route.ts](src/app/api/item-codes/by-barcode/route.ts) |
| Endpoint sinh QR PNG Location | ✅ Có | [qr-png/route.ts](src/app/api/locations/[id]/qr-png/route.ts) |
| Endpoint sinh QR PNG Pallet | ✅ Có | [qr-png/route.ts](src/app/api/pallets/[id]/qr-png/route.ts) |
| Trang in QR Location bulk | ✅ Có | [qr-print/page.tsx](src/app/locations/qr-print/page.tsx) |
| Trang in QR Pallet bulk | ✅ Có | [qr-print/page.tsx](src/app/pallets/qr-print/page.tsx) |
| Camera scan đa format | ✅ Có | [BarcodeScanner.tsx](src/components/BarcodeScanner.tsx) |
| API smart resolve gateway | ✅ Có | [scan/resolve/route.ts](src/app/api/scan/resolve/route.ts) |

→ **Đã sẵn sàng cho cả 2 loại mã.** Không cần làm thêm gì để hỗ trợ barcode hoặc QR.
