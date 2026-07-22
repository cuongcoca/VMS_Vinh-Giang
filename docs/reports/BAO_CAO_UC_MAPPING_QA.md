# 🗺️ BÁO CÁO 2 — MAP UC MOCKUP → VỊ TRÍ TRÊN WEB (CHO QA)

> **Ngày:** 2026-05-25
> **Mục đích:** Tester/QA mở web là biết click đâu để test UC nào.
> **VPS:** `https://188.166.210.73`
> **Account test:** Anh dùng `quan_ly` (Quản lý) — quyền xem tất cả 5 instance.

---

## 🔑 1. KIẾN TRÚC URL — HIỂU TRƯỚC KHI TEST

Hệ thống có **4 instance Next.js** chạy song song trên cùng codebase (PM2):

| Instance | Port | URL prefix | Dành cho | Mobile? |
|---|---|---|---|---|
| **wms-vinhgiang** | 3001 | `/wms/*` | Quản lý + Kế toán kho (PC) | ❌ |
| **wms-xenang** | 3002 | `/xenang/*` | Xe nâng | ✅ |
| **wms-thukho** | 3003 | `/thukho/*` | Thủ kho | ✅ |
| **wms-kiemke** | 3004 | `/kiemke/*` | Người kiểm kê | ✅ |

**Best practice QA:**
- Test với account **Quản lý** (`quan_ly`) trên `/wms/*` — quyền cao nhất, xem được hết.
- Test mobile bằng DevTools "Toggle Device Toolbar" (Cốc Cốc/Chrome) → chọn iPhone/Android.

---

## 🧭 2. MENU PATH TRONG SIDEBAR

Sidebar trái của `/wms/*` có cấu trúc:

```
┌─────────────────────────┐
│ HỆ THỐNG WMS Vĩnh Giang │
├─────────────────────────┤
│ 📊 Tổng quan            │ → /wms/dashboard
│ 📦 Danh mục sản phẩm    │ → /wms/item-codes
│ 🏷  Nhóm hàng            │ → /wms/product-groups
│ 📏 Đơn vị tính          │ → /wms/units
│ 🎫 Mã hàng              │ → /wms/item-codes
│ 🏗 Vị trí kho           │ → /wms/locations
│ 🚚 Nhà cung cấp         │ → /wms/suppliers
│                         │
│ VẬN HÀNH KHO            │
│ 📦 Pallet               │ → /wms/pallets
│ 🛠 Xe nâng              │ → /wms/forklift
│                         │
│ NHẬP KHO                │
│ 📥 Phiếu nhập           │ → /wms/inbound
│ 📤 Import Excel         │ → /wms/inbound/import
│ ⏳ Tồn tạm              │ → /wms/inbound-adhoc
│                         │
│ XUẤT KHO                │
│ 📤 Khu chờ xuất         │ → /wms/outbound
│ ⚖  Cân lại tồn          │ → /wms/outbound/rebalance
│ 📊 Báo cáo xuất         │ → /wms/outbound/report
│ ⚡ Tốc độ luân chuyển    │ → /wms/outbound/turnover
│ 💡 Gợi ý nhập           │ → /wms/outbound/reorder
│                         │
│ TỒN KHO                 │
│ 📊 Tồn theo Mã          │ → /wms/inventory
│ 📍 Tồn theo Vị trí      │ → /wms/inventory/by-location
│ 📦 Tồn theo Pallet      │ → /wms/inventory/by-pallet
│ 🗓 FEFO toàn kho        │ → /wms/inventory/by-lot
│ 🚨 Cảnh báo             │ → /wms/inventory/alerts
│                         │
│ KIỂM KÊ                 │
│ 📋 Phiên kiểm kê        │ → /wms/stock-count
│ 🔧 Điều chỉnh tồn       │ → /wms/inventory/adjustments
│                         │
│ HỆ THỐNG                │
│ ⚙  Cấu hình             │ → /wms/system/config
│ ✉  Email                │ → /wms/system/mail
│ 📜 Audit log            │ → /wms/system/audit-log
│ 👥 Người dùng           │ → /wms/system/users
│ 🔐 Phân quyền RBAC      │ → /wms/system/rbac
│ 👤 Profile cá nhân      │ → /wms/system/profile
└─────────────────────────┘
```

---

## 📋 3. BẢNG MAPPING ĐẦY ĐỦ 53 UC

### Cột giải thích
- **UC ID:** Mã UC trong mockup (line trong file `wms_mockups_4.html`).
- **Tên UC:** Tên ngắn gọn.
- **Role chính:** Vai trò sử dụng UC.
- **URL VPS:** Link đầy đủ — copy vào browser là mở được.
- **Menu path:** Click theo thứ tự trên sidebar.
- **Status:** Trạng thái khớp mockup (xem [BAO_CAO_GAP_MOCKUP_2026-05-25.md](BAO_CAO_GAP_MOCKUP_2026-05-25.md) chi tiết).
- **Test data:** Gợi ý data cần để test (đã seed sẵn trong DB).

---

### 🔐 A. AUTH (4 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-AUTH-01 | Đăng nhập | All | `https://188.166.210.73/wms/auth` | (entry point) | ✅ | `quan_ly` / `Vinh@2024` |
| UC-AUTH-03 | Đổi mật khẩu | All | `https://188.166.210.73/wms/system/change-password` | Profile → Đổi mật khẩu | ✅ | Login trước |
| UC-AUTH-04 | Quên mật khẩu | All | `https://188.166.210.73/wms/auth/forgot-password` | Login page → "Quên mật khẩu" | ⚠️ | SĐT/email user |
| UC-AUTH-05 | Phân quyền RBAC | Quản lý | `https://188.166.210.73/wms/system/rbac` | HỆ THỐNG → Phân quyền RBAC | ⚠️ | Login `quan_ly` |

---

### 📚 B. MASTER DATA (6 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-MD-01 | Khai báo sản phẩm | KT/QL | 🚫 **Chưa có trang** | — | 🚫 | — |
| UC-MD-02 | Mã hàng | KT (PC) + TK (mobile) | `https://188.166.210.73/wms/item-codes` | Danh mục → Mã hàng | ⚠️ | Code: `VG-NM-001` |
| UC-MD-03 | Nhóm hàng | KT | `https://188.166.210.73/wms/product-groups` | Danh mục → Nhóm hàng | ✅ | Code: `NH-01` |
| UC-MD-04 | Đơn vị tính | KT | `https://188.166.210.73/wms/units` | Danh mục → Đơn vị tính | ✅ | `THUNG`, `CHAI` |
| UC-MD-05 | Vị trí kho | QL/KT | `https://188.166.210.73/wms/locations` | Danh mục → Vị trí kho | ⚠️ | A-01-01, B-02-03... |
| UC-MD-06 | Nhà cung cấp | KT | `https://188.166.210.73/wms/suppliers` | Danh mục → Nhà cung cấp | ✅ | `NCC-001 An Phú` |

---

### 📦 C. PALLET (6 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-PAL-01 | Tạo Pallet | Thủ kho | **Mobile:** `https://188.166.210.73/thukho/pallet/new` <br> **PC:** `https://188.166.210.73/wms/pallets` (modal) | (Thủ kho mobile bottom tab Pallet) | ⚠️ | Pick 1 PHN có sẵn |
| UC-PAL-02 | Cập nhật chi tiết hàng | Thủ kho | `https://188.166.210.73/wms/pallets/[id]` <br> Mobile: `/thukho/pallet/[id]` | Click pallet trong list | ✅ | `PL260506.001` |
| UC-PAL-03 | Nhận diện mã (đa phương thức) | Thủ kho | Trong UC-PAL-02 — click icon scan | ↑ | ⚠️ | Cần camera điện thoại |
| UC-PAL-04 | Xác nhận Pallet (khóa) | Thủ kho | Trong UC-PAL-02 — nút "Xác nhận" | ↑ | ✅ | Pallet status `OPEN` |
| UC-PAL-05 | Sửa Pallet sau xác nhận | Quyền đặc biệt | Trong UC-PAL-02 — nút "Mở khóa" | ↑ | ⚠️ | Pallet `CONFIRMED` + role `QUAN_LY` |
| UC-PAL-06 | Xem chi tiết Pallet | All | `https://188.166.210.73/wms/pallets/[id]` | VẬN HÀNH → Pallet → click | ✅ | Bất kỳ pallet |

---

### 📥 D. INBOUND (6 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-IN-01 | Lập Phiếu yêu cầu nhập | Kế toán | `https://188.166.210.73/wms/inbound/new` | NHẬP KHO → Phiếu nhập → "+ Tạo mới" | ✅ (vừa fix) | NCC: An Phú, 3 dòng hàng |
| UC-IN-02 | Thủ kho tiếp nhận | Thủ kho | **Mobile:** `https://188.166.210.73/thukho/inbound/[id]` | Thủ kho mobile → Phiếu nhập | ✅ | Phiếu status `PENDING` |
| UC-IN-03 | Đối chiếu Pallet với Phiếu | Hệ thống/TK/KT | `https://188.166.210.73/wms/inbound/[id]` (tab "Đối chiếu") | NHẬP KHO → Phiếu nhập → click phiếu | ⚠️ | Phiếu status `RECONCILING` |
| UC-IN-04 | Kế toán chốt phiếu | Kế toán | `https://188.166.210.73/wms/inbound/[id]` (tab "Chốt") | ↑ | ⚠️ | Phiếu `RECONCILING` |
| UC-IN-05 | Theo dõi trạng thái | KT/TK/QL | `https://188.166.210.73/wms/inbound` | NHẬP KHO → Phiếu nhập | ✅ | Có 1+ phiếu |
| UC-IN-06 | Up file Excel NCC lớn | Kế toán | `https://188.166.210.73/wms/inbound/import` + tab "Up file Unilever" trong `/wms/inbound/new` | NHẬP KHO → Import Excel | ✅ | File .xlsx mẫu (có template) |

---

### ⏳ E. INBOUND TEMP (3 UC) — Hàng nhập đột xuất

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-INTMP-01 | Tạo Phiếu nhập tạm | Thủ kho | **PC:** `https://188.166.210.73/wms/inbound-adhoc/new` <br> **Mobile:** `https://188.166.210.73/thukho/adhoc/new` | NHẬP KHO → Tồn tạm → "+ Tạo mới" | ❌ | NCC: tùy chọn |
| UC-INTMP-02 | Xử lý phiếu tạm (chuẩn hóa) | Kế toán | `https://188.166.210.73/wms/inbound-adhoc/[id]` | NHẬP KHO → Tồn tạm → click phiếu | ❌ | Phiếu `PNT-...` chờ chuẩn hóa |
| UC-INTMP-03 | Theo dõi tồn tạm | KT/QL | `https://188.166.210.73/wms/inbound-adhoc` | NHẬP KHO → Tồn tạm | ⚠️ | Có 1+ phiếu tạm |

---

### 🛠 F. FORKLIFT (6 UC) — Xe nâng

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-FK-01 | DS Pallet chờ vào vị trí | Xe nâng | **Mobile:** `https://188.166.210.73/xenang/forklift` <br> **PC:** `https://188.166.210.73/wms/forklift` | Xe nâng mobile tab Home | ⚠️ | Pallet `CONFIRMED` |
| UC-FK-02 | Đưa Pallet vào VT chứa | Xe nâng | `https://188.166.210.73/wms/forklift/put-away` | VẬN HÀNH → Xe nâng → Đưa vào vị trí | ✅ | Pallet `CONFIRMED` + VT `EMPTY` |
| UC-FK-03 | Chuyển VT → VT | Xe nâng | `https://188.166.210.73/wms/forklift/relocate` | VẬN HÀNH → Xe nâng → Chuyển VT | ✅ | Pallet `IN_STORAGE` |
| UC-FK-04 | Chuyển VT → Khu chờ xuất (FEFO) | Xe nâng | `https://188.166.210.73/wms/forklift/stage-out` | VẬN HÀNH → Xe nâng → Ra khu chờ xuất | ❌ | Mã hàng có >1 pallet |
| UC-FK-05 | Chuyển Khu chờ xuất → VT chứa (audit) | Quyền đặc biệt | `https://188.166.210.73/wms/forklift/return` | VẬN HÀNH → Xe nâng → Trả về vị trí | ❌ | Pallet `IN_STAGING` |
| UC-FK-06 | Lịch sử luân chuyển | All (theo quyền) | `https://188.166.210.73/wms/forklift/history` | VẬN HÀNH → Xe nâng → Lịch sử | ✅ | Có movement |

---

### 📤 G. OUTBOUND (5 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-OUT-01 | Xem hàng Khu chờ xuất | All (theo quyền) | `https://188.166.210.73/wms/outbound` | XUẤT KHO → Khu chờ xuất | ✅ | Có pallet `IN_STAGING` |
| UC-OUT-02 | BC Xuất kho tương đối | KT/QL | `https://188.166.210.73/wms/outbound/report` | XUẤT KHO → Báo cáo xuất | ⚠️ | Có movement STAGE_OUT |
| UC-OUT-03 | BC Tốc độ luân chuyển | QL | `https://188.166.210.73/wms/outbound/turnover` | XUẤT KHO → Tốc độ luân chuyển | ⚠️ | DB có ≥30 ngày data |
| UC-OUT-04 | Gợi ý nhập hàng | QL/KT | `https://188.166.210.73/wms/outbound/reorder` | XUẤT KHO → Gợi ý nhập | ❌ | Item codes có min_stock |
| UC-OUT-05 | Cân lại tồn Khu chờ xuất (2 cách) | KT | `https://188.166.210.73/wms/outbound/rebalance` | XUẤT KHO → Cân lại tồn | ❌ | Pallet `IN_STAGING` |

---

### 📊 H. INVENTORY (9 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-INV-01 | Tồn theo Mã hàng | All | `https://188.166.210.73/wms/inventory` | TỒN KHO → Tồn theo Mã | ⚠️ | Item code có tồn |
| UC-INV-02 | Tồn theo Vị trí | All | `https://188.166.210.73/wms/inventory/by-location` | TỒN KHO → Tồn theo Vị trí | ⚠️ | VT có pallet |
| UC-INV-03 | Tồn theo Pallet | All | `https://188.166.210.73/wms/inventory/by-pallet` | TỒN KHO → Tồn theo Pallet | ⚠️ | Có pallet active |
| UC-INV-04 | Báo cáo FEFO toàn kho | QL/KT | `https://188.166.210.73/wms/inventory/by-lot` | TỒN KHO → FEFO toàn kho | ⚠️ | Pallet có HSD |
| UC-INV-05 | Cảnh báo HSD & Tồn thấp | QL/KT | `https://188.166.210.73/wms/inventory/alerts` | TỒN KHO → Cảnh báo | ⚠️ | Có pallet HSD ≤30 ngày |
| UC-INV-06 | Kiểm kê theo Vị trí | Người KK | **Mobile:** `https://188.166.210.73/kiemke/scan` <br> **PC:** `https://188.166.210.73/wms/stock-count/[id]` | Kiểm kê mobile → Quét | ⚠️ | Phiên KK status `OPEN` |
| UC-INV-07 | Kiểm kê theo Mã hàng | KK/QL | `https://188.166.210.73/wms/stock-count/[id]` (session type = BY_ITEM) | KIỂM KÊ → Phiên kiểm kê → click | ⚠️ | Phiên `BY_ITEM` |
| UC-INV-08 | Xử lý chênh lệch | QL/KT | 🚫 **Chưa có trang** | — | 🚫 | — |
| UC-INV-09 | Phiếu điều chỉnh tồn | KT → QL duyệt | `https://188.166.210.73/wms/inventory/adjustments` (list, không có /new) | KIỂM KÊ → Điều chỉnh tồn | ⚠️ | Có phiếu DCT-... |

---

### 📊 I. DASHBOARD (2 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-DASH-01 | Dashboard theo vai trò | All | `https://188.166.210.73/wms/dashboard` <br> `/xenang/`, `/thukho/`, `/kiemke/` (cho mobile) | Tổng quan | ⚠️ | Login mỗi role |
| UC-DASH-02 | KPI tổng quan (QL) | Quản lý | `https://188.166.210.73/wms/dashboard` (không có route /manager riêng) | ↑ | ⚠️ | Login `quan_ly` |

---

### ⚙ J. SYSTEM (5 UC)

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-SYS-01 | Cấu hình chung | QL | `https://188.166.210.73/wms/system/config` | HỆ THỐNG → Cấu hình | ❌ | Login `quan_ly` |
| UC-SYS-02 | Cấu hình email | QL | `https://188.166.210.73/wms/system/mail` | HỆ THỐNG → Email | ✅ | SMTP credentials |
| UC-SYS-03 | Audit Log | QL | `https://188.166.210.73/wms/system/audit-log` | HỆ THỐNG → Audit log | ✅ | Có activity log |
| UC-SYS-04 | Quản lý người dùng | QL | `https://188.166.210.73/wms/system/users` | HỆ THỐNG → Người dùng | ✅ | Login `quan_ly` |
| UC-SYS-05 | Profile cá nhân | All | `https://188.166.210.73/wms/system/profile` <br> `/forklift/profile`, `/thukho/profile`, `/kiemke/profile` | Click avatar → Profile | ✅ | Login bất kỳ |

---

### 🔌 K. INTEGRATION (3 UC) — Tính năng nhúng

| UC ID | Tên UC | Role | URL VPS | Menu | Status | Test data |
|---|---|---|---|---|---|---|
| UC-INT-01 | Quét barcode/QR (Mobile) | Mobile users | `https://188.166.210.73/kiemke/scan` (hiện chỉ kiểm kê) | Kiểm kê mobile → Quét | ⚠️ | Cần camera điện thoại + barcode |
| UC-INT-02 | Chụp ảnh chứng từ | Thủ kho/KK | 🚫 Không có page riêng (component scattered) | — | ⚠️ | Cần camera |
| UC-INT-03 | Xuất Excel báo cáo | QL/KT | Nhúng trong nhiều page (audit-log, users, adjustments, inventory...) | Click nút "Xuất Excel" | ✅ | Bất kỳ page có nút |

---

## 🧪 4. KỊCH BẢN TEST TIÊU BIỂU

### Test E2E luồng nhập kho cơ bản (UC-IN-01 → UC-IN-05)

1. **Login** `quan_ly` tại `https://188.166.210.73/wms/auth`
2. **Tạo phiếu yêu cầu nhập** (UC-IN-01):
   - Click sidebar **NHẬP KHO → Phiếu nhập → "+ Tạo mới"**
   - URL: `/wms/inbound/new`
   - Điền: NCC = "An Phú", Ngày dự kiến = today, Loại nhập = "Nhập từ NCC", Kho nhận = "Kho chính - HN"
   - Thêm 2-3 dòng hàng từ Item code search
   - Click "Lưu & Gửi cho Thủ kho"
3. **Theo dõi trạng thái phiếu** (UC-IN-05):
   - URL: `/wms/inbound` → search mã PNK vừa tạo
   - Verify status hiển thị đúng
4. **Thủ kho tiếp nhận** (UC-IN-02):
   - Login lại với `thu_kho` tại `/wms/auth` (sẽ tự redirect sang mobile `/thukho`)
   - Click "Phiếu nhập" → tìm phiếu vừa tạo → "Tiếp nhận"

### Test luồng FEFO xuất kho (UC-FK-04)

1. Login `xe_nang` (sẽ redirect `/xenang/forklift`)
2. URL: `/wms/forklift/stage-out`
3. Search mã hàng (vd VG-NM-001) → hệ thống gợi ý pallet FEFO (HSD gần nhất)
4. Click pallet → xác nhận xuất → pallet chuyển status `IN_STAGING`

### Test phiếu nhập tạm (UC-INTMP-01) 🐞

⚠️ **Lưu ý:** Form hiện THIẾU 6 field BẮT BUỘC (xem gap report).
1. Login `thu_kho`
2. URL: `/wms/inbound-adhoc/new` (PC) hoặc `/thukho/adhoc/new` (mobile)
3. Hiện tại chỉ có 2 field (NCC + Ghi chú) — không đủ test E2E đầy đủ flow

---

## 🚨 5. UC KHÔNG THỂ TEST HIỆN TẠI

| UC | Lý do | Action |
|---|---|---|
| UC-MD-01 | 🚫 Chưa có trang | Cần build mới `/master-data/products` |
| UC-INV-08 | 🚫 Chưa có trang | Cần build mới `/stock-count/[id]/discrepancy` |
| UC-INV-09 (tạo phiếu) | ⚠️ Chưa có `/new` | Cần build route `/inventory/adjustments/new` |
| UC-DASH-02 (riêng cho QL) | Merge vào `/dashboard` | Có thể test chung trên `/dashboard` |
| UC-OUT-05 (Excel + PYX) | ❌ Chỉ có nhập tay | Cần build module Excel import + OutboundRequest entity |
| UC-FK-05 (sửa pallet) | ❌ UI khóa, không sửa được | Phải sửa form để cho phép edit Mã/SL/Lô/Date |

---

## 📞 6. TÀI KHOẢN TEST (đã seed)

| Username | Password | Role | Redirect sau login |
|---|---|---|---|
| `quan_ly` | `Vinh@2024` | QUAN_LY | `/wms/dashboard` |
| `ke_toan` | `Vinh@2024` | KE_TOAN | `/wms/dashboard` |
| `thu_kho` | `Vinh@2024` | THU_KHO | `/thukho/` |
| `xe_nang` | `Vinh@2024` | XE_NANG | `/xenang/forklift` |
| `kiem_ke` | `Vinh@2024` | KIEM_KE | `/kiemke/` |
| `admin` | `admin@2024` | ADMIN | `/wms/dashboard` |

---

## 🔧 7. TIPS TEST NHANH

### Reset state phiếu nhập (cho test lặp)
```sql
-- SSH vào VPS rồi chạy:
psql -U wms -d wms_vinhgiang -c "UPDATE inbound_requests SET status='DRAFT' WHERE code='PNK-2026-0005';"
```

### Xem log realtime khi test
```bash
# SSH VPS:
pm2 logs wms-vinhgiang --lines 50
```

### Kiểm tra status code response API
```bash
# Browser DevTools → Network tab → Filter "Fetch/XHR"
# Hoặc curl từ máy local:
curl -i https://188.166.210.73/wms/api/inbound -H "Cookie: session=..."
```

---

## 📚 8. FILE THAM KHẢO

- Báo cáo gap chi tiết: [BAO_CAO_GAP_MOCKUP_2026-05-25.md](BAO_CAO_GAP_MOCKUP_2026-05-25.md)
- UC-IN-01 vừa fix: [BAO_CAO_UC_IN_01_DONE.md](BAO_CAO_UC_IN_01_DONE.md)
- Mockup gốc: [wms_mockups_4.html](wms_mockups_4.html)
- Lộ trình fix: [LO_TRINH_FIX_GAP_DETAILED.md](LO_TRINH_FIX_GAP_DETAILED.md)

---

**HẾT BÁO CÁO 2.**
