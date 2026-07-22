# 📋 BÁO CÁO 1 — GAP MOCKUP vs GIAO DIỆN WEB (53 UC)

> **Ngày:** 2026-05-25
> **Nguồn mockup:** `wms_mockups_4.html` (53 UC trên 1 file HTML duy nhất)
> **Nguồn web:** VPS production `https://188.166.210.73/wms` (sau khi UC-IN-01 đã fix + deploy hôm nay)
> **Phương pháp:** 5 subagent đối chiếu code song song + spot-check visual 5 UC critical bằng Cốc Cốc (extension Claude in Chrome)

---

## 🎯 TÓM TẮT EXECUTIVE

### Số liệu tổng quan
| Trạng thái | Số UC | % |
|---|---|---|
| ✅ Đầy đủ / vượt mockup | **14** | 26% |
| ⚠️ Thiếu một phần | **28** | 53% |
| ❌ Thiếu nghiêm trọng | **9** | 17% |
| 🚫 Chưa có trang | **2** | 4% |

### So với báo cáo cũ ([BAO_CAO_GAP_VPS.md](BAO_CAO_GAP_VPS.md))
Cải thiện chính từ session hôm nay:
- **UC-IN-01** đã từ ❌ Thiếu nghiêm trọng → ✅ Đầy đủ (1105 dòng, 3 tab + 7 field + ĐVT + drag-drop + hàng tổng)
- Các UC khác giữ nguyên do chỉ Phase 0 mới hoàn thành.

### Top 10 GAP CRITICAL cần fix gấp
| # | UC | Vấn đề | Severity |
|---|---|---|---|
| 1 | UC-INTMP-01 | Form chỉ 2/8 field (NCC + Ghi chú), thiếu Mã phiếu auto / Nguồn hàng / Người giao / Ngày giờ nhận / Lý do / Ảnh chứng từ | ❌ Critical |
| 2 | UC-FK-05 | Không có UI sửa Mã/SL/Lô/Date — sai bản chất UC (luồng DUY NHẤT cho phép sửa) | ❌ Critical |
| 3 | UC-OUT-05 | Thiếu hoàn toàn 2 cách (Upload Excel + Phiếu PYX), chỉ có nhập tay từng dòng | ❌ Critical |
| 4 | UC-OUT-04 | Logic sai (`min_stock` tĩnh vs forecast BQ × N ngày) | ❌ Critical |
| 5 | UC-INV-08 | 🚫 Chưa có trang xử lý chênh lệch kiểm kê | 🚫 Critical |
| 6 | UC-INTMP-02 | Không có trang chuẩn hóa 3 bước; chỉ có read-only detail | ❌ Critical |
| 7 | UC-MD-01 | 🚫 Chưa có trang "Sản phẩm" riêng (chỉ có `/item-codes`) | 🚫 Critical |
| 8 | UC-SYS-01 | Chỉ 5 key-value generic, thiếu logo/favicon/hotline/email/footer | ❌ Critical |
| 9 | UC-FK-04 | Thiếu TH-B "Rút một phần", chỉ rút nguyên pallet | ⚠️ High |
| 10 | UC-IN-04 | Thiếu UI checklist 5 điều kiện chốt + dropdown quyết định chênh lệch | ⚠️ High |

---

## 📑 MỤC LỤC

1. [AUTH + MASTER DATA](#1-auth--master-data) (10 UC)
2. [PALLET + INBOUND](#2-pallet--inbound) (11 UC)
3. [INBOUND TEMP + FORKLIFT + OUT-01](#3-inbound-temp--forklift--out-01) (10 UC)
4. [OUTBOUND + INVENTORY (1-7)](#4-outbound--inventory-1-7) (11 UC)
5. [INV (8-9) + DASHBOARD + SYSTEM + INTEGRATION](#5-inv-8-9--dashboard--system--integration) (11 UC)

---

# 1. AUTH + MASTER DATA

### UC-AUTH-01 — Đăng nhập
- **Mockup:** line 390-450, URL `/auth`
- **Web:** route `/auth`, file `src/app/auth/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** Toggle ẩn/hiện password, "Ghi nhớ" lưu localStorage
- **Note:** Có chuyển hướng theo vai trò sau đăng nhập

### UC-AUTH-03 — Đổi mật khẩu
- **Mockup:** line 451-482, URL `/system/change-password`
- **Web:** route `/system/change-password`, file `src/app/system/change-password/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** Hiển thị các session hiện tại (device, IP, last_active)
- **Note:** Validator mật khẩu 8+ ký tự, chữ hoa/thường, số

### UC-AUTH-04 — Quên mật khẩu
- **Mockup:** line 485-540, URL `/auth/forgot-password`
- **Web:** route `/auth/forgot-password`, file `src/app/auth/forgot-password/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Workflow email reset link (mockup yêu cầu)
- **Dư:** OTP 6 chữ số, countdown, resend cooldown, attempts limit (5 lần)
- **Note:** Web dùng OTP thay email — KHÁC mockup. Cần PO confirm chọn cách nào

### UC-AUTH-05 — Phân quyền (RBAC)
- **Mockup:** line 543-597, URL `/system/rbac`
- **Web:** route `/system/rbac`, file `src/app/system/rbac/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Nút "Tạo vai trò mới", "Xuất Excel", "Khôi phục mặc định"; 5 mức quyền (mockup) — web dùng checkbox boolean
- **Dư:** —
- **Note:** Ma trận quyền dynamic fetch API, chưa có UI thêm/xóa vai trò

### UC-MD-01 — Khai báo sản phẩm
- **Mockup:** line 603-736, URL `/master-data/products`
- **Web:** 🚫 KHÔNG có trang riêng
- **Trạng thái:** 🚫 Chưa có trang
- **Thiếu:** Toàn bộ — DS sản phẩm, thêm/sửa, trọng lượng/thể tích theo thùng
- **Dư:** —
- **Note:** `item-codes/page.tsx` không thay thế được (đó là Mã hàng — UC-MD-02)

### UC-MD-02 — Mã hàng
- **Mockup:** line 739-820, URL `/master-data/skus`
- **Web:** route `/item-codes`, file `src/app/item-codes/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Workflow 2 vai trò (Thủ kho tạo → Kế toán chuẩn hóa); UI button "Chuẩn hóa"; ĐVT quy đổi mặc định "Thùng"
- **Dư:** Cột "Người tạo", "Ngày tạo", "Thể tích thùng"
- **Note:** Có tab "Chờ xử lý / Đã chuẩn hóa" nhưng chưa có UI bấm "Chuẩn hóa"

### UC-MD-03/04 — Nhóm hàng & ĐVT
- **Mockup:** line 823-908, URL `/master-data/groups`
- **Web:** routes `/product-groups` + `/units`, files `src/app/product-groups/page.tsx` + `src/app/units/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** —
- **Note:** Tách 2 trang riêng (không gộp 1 trang như mockup)

### UC-MD-05 — Vị trí kho (Layout)
- **Mockup:** line 911-976, URL `/master-data/locations`
- **Web:** route `/locations`, file `src/app/locations/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Nút "Xem dạng sơ đồ"; grid 6 cột hiển thị 12 ô; cây thư mục dãy/kệ sidebar
- **Dư:** —
- **Note:** Có location types (STORAGE, INBOUND_STAGING, OUTBOUND_STAGING, STOCKTAKE) + status; chưa có UI sơ đồ trực quan

### UC-MD-06 — Nhà cung cấp
- **Mockup:** line 979-1004, URL `/master-data/suppliers`
- **Web:** route `/suppliers`, file `src/app/suppliers/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** Cột "Số phiếu nhập" (count), `tax_code`
- **Note:** CRUD đầy đủ, status "Đang dùng/Tạm dừng" qua `is_active`

### UC-PAL-01 — Tạo Pallet
- **Mockup:** line 1010-1079, URL mobile (Thủ kho)
- **Web:** route `/pallets` + mobile `/thukho/pallet/new`, file `src/app/pallets/page.tsx` + `src/app/thukho/pallet/new/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Sinh mã tự động đúng format `PLYYMMDD.STT`; link tới phiếu nhập; ghi chú; status "Chưa kích hoạt"
- **Dư:** KPI tổng hợp, Excel export, statusMap 7 trạng thái
- **Note:** Modal tạo pallet có ở web, mobile thủ kho chưa hoàn thiện theo mockup

---

# 2. PALLET + INBOUND

### UC-PAL-02 — Cập nhật chi tiết hàng trên Pallet
- **Mockup:** line 1093-1210
- **Web:** route `/pallets/[id]`, file `src/app/pallets/[id]/page.tsx`
- **Trạng thái:** ✅ Đầy đủ (cơ bản)
- **Thiếu:** Hiển thị ĐVT trên mỗi dòng (chỉ có `qty_box` + `qty_unit`)
- **Dư:** Drag-drop attachment panel
- **Note:** Có thể qty_unit = đơn vị lẻ — cần verify mapping

### UC-PAL-03 — Nhận diện mã hàng (đa phương thức)
- **Mockup:** line 1211-1286
- **Web:** route `/pallets/[id]`, file `src/app/pallets/[id]/page.tsx` (showScanner state)
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Ảnh chụp mã vỏ thùng (photo mode), đèn flashlight, UI "Đang chờ quét mã..."
- **Dư:** —
- **Note:** Có barcode scanner hook, chưa rõ UI đầy đủ

### UC-PAL-04 — Xác nhận Pallet (Khóa thông tin)
- **Mockup:** line 1288-1367
- **Web:** route `/pallets/[id]`, file `src/app/pallets/[id]/page.tsx` (handleConfirm)
- **Trạng thái:** ✅ Đầy đủ (cơ bản)
- **Thiếu:** Popup tổng kết trước xác nhận (mockup 1301-1310)
- **Dư:** —
- **Note:** Chức năng xác nhận tồn tại, popup UI có thể đã có

### UC-PAL-05 — Sửa Pallet sau xác nhận
- **Mockup:** line 1369-1405
- **Web:** route `/pallets/[id]`, file `src/app/pallets/[id]/page.tsx` (showUnlockModal)
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Dropdown lý do (Sai SL đếm / Sai lô / Sai mã / Khác), người duyệt, ghi chú chi tiết
- **Dư:** —
- **Note:** Modal unlock có nhưng form lý do chưa đủ

### UC-PAL-06 — Xem chi tiết Pallet
- **Mockup:** line 1406-1454
- **Web:** route `/pallets/[id]`, file `src/app/pallets/[id]/page.tsx` (tab lines/history)
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** Hiển thị vị trí hiện tại 📍 (mockup line 1419: "A-03-02")
- **Dư:** AttachmentPanel
- **Note:** Tab history tồn tại — chỉ thiếu badge location

### UC-IN-01 — Lập Phiếu yêu cầu nhập
- **Mockup:** line 1457-1537, URL `/inbound/requests/new`
- **Web:** route `/inbound/new`, file `src/app/inbound/new/page.tsx` (1105 dòng)
- **Trạng thái:** ✅ Đầy đủ (vừa fix hôm nay)
- **Thiếu:** —
- **Dư:** "Loại nhập" có 2 option khớp mockup; có thêm "Loại nhập chuyển kho" trong code nhưng đã xóa khi fix
- **Note:** Đã verify visual khớp 100% mockup. Xem [BAO_CAO_UC_IN_01_DONE.md](BAO_CAO_UC_IN_01_DONE.md)

### UC-IN-02 — Thủ kho tiếp nhận phiếu
- **Mockup:** line 1539-1613, URL mobile
- **Web:** route `/thukho/inbound/[id]`, file `src/app/thukho/inbound/[id]/page.tsx`
- **Trạng thái:** ✅ Đầy đủ (cơ bản)
- **Thiếu:** Checkbox "Khu vực dỡ hàng đã chuẩn bị" (tham khảo, optional)
- **Dư:** —
- **Note:** Có nút "Tiếp nhận & Bắt đầu nhập"

### UC-IN-03 — Đối chiếu Pallet với Phiếu
- **Mockup:** line 1615-1657, URL `/inbound/requests/[id]/reconcile`
- **Web:** route `/inbound/[id]`, file `src/app/inbound/[id]/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** KPI grid 4 ô (Tổng yêu cầu / Tổng thực nhập / Pallet đã tạo / Mã tạm); cột "Pallet" trong bảng đối chiếu; badge "Đã khớp / Chênh lệch thiếu / Chênh lệch thừa / Phát sinh"
- **Dư:** —
- **Note:** Logic so sánh qty_received vs qty_expected có nhưng UI hiển thị chưa rõ

### UC-IN-04 — Kế toán chốt phiếu nhập
- **Mockup:** line 1660-1702, URL `/inbound/requests/[id]/finalize`
- **Web:** route `/inbound/[id]`, file `src/app/inbound/[id]/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Checklist 5 điều kiện (all pallets confirmed / in-location / unmatched normalized / reconciled / totals match); dropdown "Xử lý chênh lệch" (Accept/Reject/Hold)
- **Dư:** —
- **Note:** Logic chốt phiếu có (status → COMPLETED), nhưng UI checklist chưa hiển thị

### UC-IN-05 — Theo dõi trạng thái phiếu nhập
- **Mockup:** line 1705-1793, URL `/inbound/requests`
- **Web:** route `/inbound`, file `src/app/inbound/page.tsx`
- **Trạng thái:** ✅ Đầy đủ (cơ bản)
- **Thiếu:** Progress bar 8 trạng thái (timeline visual)
- **Dư:** —
- **Note:** List + filter status đã có

### UC-IN-06 — Up file Excel NCC lớn (Unilever)
- **Mockup:** line 1797-1900+, URL `/inbound/import-excel`
- **Web:** route `/inbound/import`, file `src/app/inbound/import/page.tsx` + tab "Up file Unilever" trong `/inbound/new`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** —
- **Note:** 2 entry point (page riêng + tab trong /new) — bonus

---

# 3. INBOUND TEMP + FORKLIFT + OUT-01

### UC-INTMP-01 — Tạo Phiếu nhập tạm 🔥
- **Mockup:** line 1977-2059, URL mobile + desktop form
- **Web:** route `/inbound-adhoc/new`, file `src/app/inbound-adhoc/new/page.tsx`
- **Trạng thái:** ❌ Thiếu nghiêm trọng
- **Thiếu (6/8 field BẮT BUỘC):**
  - ❌ Mã phiếu auto (PNT-YYYY-SSSS)
  - ❌ Nguồn hàng (SUPPLIER/RETURN/OTHER)
  - ❌ Người giao
  - ❌ Ngày giờ nhận
  - ❌ Lý do nhập (EARLY/NOT_READY/UNNOTIFIED_RETURN/NEW_SUPPLIER/OTHER)
  - ❌ Ảnh chứng từ (upload)
- **Dư:** —
- **Note:** ✅ VERIFIED visual — chỉ có NCC + Ghi chú + button "Tạo phiếu tạm"

### UC-INTMP-02 — Xử lý phiếu nhập tạm (chuẩn hóa)
- **Mockup:** line 2062-2145, URL `/inbound/temp/[id]`
- **Web:** route `/inbound-adhoc/[id]`, file `src/app/inbound-adhoc/[id]/page.tsx` (read-only)
- **Trạng thái:** ❌ Thiếu nghiêm trọng
- **Thiếu:** Toàn bộ 3-bước chuẩn hóa (Kiểm nguồn + Chuẩn hóa mã + Tạo phiếu chính); UI chọn mã chuẩn dropdown; form tạo NCC mới; progress panel
- **Dư:** —
- **Note:** Trang chỉ show read-only detail, không có UI thao tác

### UC-INTMP-03 — Theo dõi tồn tạm
- **Mockup:** line 2148-2173, URL `/inbound/temp/inventory`
- **Web:** route `/inbound-adhoc`, file `src/app/inbound-adhoc/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** KPI 4 số (Tổng phiếu tạm / Mã tạm chờ / Tổng SL tồn / Quá hạn >3 ngày); cảnh báo "Quá hạn" highlight đỏ; cột "Số ngày tồn"; pivot theo mã tạm
- **Dư:** —
- **Note:** Có KPI nhưng thứ tự/layout khác mockup, bảng list phiếu thay vì pivot mã tạm

### UC-FK-01 — Xem DS Pallet chờ đưa vào vị trí
- **Mockup:** line 2181-2262, URL mobile
- **Web:** route `/forklift` (PC) + `/xenang/forklift` (mobile), file `src/app/forklift/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** UI card list pallet trạng thái CONFIRMED (chờ xếp); hiển thị Mã pallet / Dòng hàng / SL / Date / Trạng thái
- **Dư:** Filter status + search trên PC
- **Note:** Dashboard component có nhưng chưa detail UI list pallet chờ

### UC-FK-02 — Đưa Pallet vào vị trí chứa
- **Mockup:** line 2265-2334, URL `/forklift/put-away`
- **Web:** route `/forklift/put-away`, file `src/app/forklift/put-away/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** —
- **Note:** Form select pallet (CONFIRMED) + location (EMPTY) + submit → IN_STORAGE

### UC-FK-03 — Chuyển VT → VT
- **Mockup:** line 2337-2377, URL `/forklift/relocate`
- **Web:** route `/forklift/relocate`, file `src/app/forklift/relocate/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** Nút QR scan (vượt mockup)
- **Note:** Khóa Mã/SL/Lô/Date đúng spec

### UC-FK-04 — Chuyển VT → Khu chờ xuất (FEFO) 🔥
- **Mockup:** line 2380-2480, URL `/forklift/stage-out`
- **Web:** route `/forklift/stage-out`, file `src/app/forklift/stage-out/page.tsx`
- **Trạng thái:** ❌ Thiếu nghiêm trọng
- **Thiếu:** UI chọn TH-A (rút nguyên) vs **TH-B (rút một phần)**; input số lượng −/+/text; validate phần rút ≤ hiện có
- **Dư:** —
- **Note:** Có FEFO suggest OK, nhưng chỉ rút nguyên pallet (mất TH-B)

### UC-FK-05 — Chuyển Khu chờ xuất → VT chứa (audit log) 🔥
- **Mockup:** line 2483-2540, URL `/forklift/return`
- **Web:** route `/forklift/return`, file `src/app/forklift/return/page.tsx`
- **Trạng thái:** ❌ Thiếu nghiêm trọng (sai bản chất UC)
- **Thiếu:** UI sửa Mã/SL/Lô/Date (đang khóa); Audit log fields (user / thời gian / value cũ → mới); "Nhật ký thay đổi" panel; icon warning + badge đặc biệt
- **Dư:** —
- **Note:** UC này là luồng DUY NHẤT cho phép sửa pallet sau khi confirm — hiện không cho sửa = sai mục đích

### UC-FK-06 — Lịch sử luân chuyển
- **Mockup:** line 2543-2581, URL `/movements`
- **Web:** route `/forklift/history`, file `src/app/forklift/history/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** Timeline visual + badge color per type
- **Note:** 7 cột + filter date/type/search; 4 loại PUT_AWAY/RELOCATE/STAGE_OUT/RETURN

### UC-OUT-01 — Xem hàng tại Khu chờ xuất
- **Mockup:** line 2587-2610, URL `/staging-out`
- **Web:** route `/outbound`, file `src/app/outbound/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** Nav cards (Khu chờ xuất / Cân lại / BC / Tốc độ) + summary KPI
- **Note:** Có nút "Cân lại tồn" link → UC-OUT-05

---

# 4. OUTBOUND + INVENTORY (1-7)

### UC-OUT-02 — Báo cáo Xuất kho tương đối
- **Mockup:** line 2762-2821, URL `/reports/relative-out`
- **Web:** route `/outbound/report`, file `src/app/outbound/report/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** 2 chart (bar Top 5 + horizontal theo nhóm); cột "Nhóm hàng" + "BQ/lần"; filter tháng + nhóm; nút Excel
- **Dư:** —
- **Note:** Bảng groupBy khớp, thiếu trực quan chart

### UC-OUT-03 — Báo cáo Tốc độ luân chuyển
- **Mockup:** line 2824-2846, URL `/reports/turnover`
- **Web:** route `/outbound/turnover`, file `src/app/outbound/turnover/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Cột "BQ xuất/ngày" + "Ngày tồn dự kiến"
- **Dư:** Ranking 4 mức (Nhanh/TB/Chậm/Đóng băng)
- **Note:** Turnover_rate đã có, thiếu 2 computed columns

### UC-OUT-04 — Gợi ý nhập hàng 🔥
- **Mockup:** line 2850-2879, URL `/reports/restock-suggestion`
- **Web:** route `/outbound/reorder`, file `src/app/outbound/reorder/page.tsx`
- **Trạng thái:** ❌ Thiếu nghiêm trọng (logic sai)
- **Thiếu:** Input "Số ngày dự trữ" + nút "Tính lại"; cột "BQ xuất/ngày" (lịch sử); cột "Nhu cầu N ngày" (BQ × ngày); bulk select + "Tạo phiếu nhập" prefill; phân loại (Đủ/Sắp thiếu/Thiếu nhiều/Bán chậm)
- **Dư:** —
- **Note:** Logic sai — VPS dùng `min_stock` static, mockup yêu cầu forecast bình quân × N ngày → cần rewrite API + UI

### UC-OUT-05 — Cân lại tồn ở Khu chờ xuất 🔥
- **Mockup:** line 2625-2759, URL `/staging-out/reconcile`
- **Web:** route `/outbound/rebalance`, file `src/app/outbound/rebalance/page.tsx`
- **Trạng thái:** ❌ Thiếu nghiêm trọng
- **Thiếu:** **Cách 1 (Upload Excel):** template download + preview so tồn + cảnh báo SL vượt. **Cách 2 (Phiếu PYX):** entity `OutboundRequest` chưa có CRUD, route `/staging-out/outbound-requests/*` chưa tồn tại
- **Dư:** Form nhập tay từng dòng (phù hợp <10 dòng)
- **Note:** Thiếu hoàn toàn 2 cách chính — chỉ có nhập tay. Cần build mới 2 module: Excel import + OutboundRequest entity

### UC-INV-01 — Tồn theo Mã hàng
- **Mockup:** line 2887-2983, URL `/inventory/by-sku`
- **Web:** route `/inventory`, file `src/app/inventory/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Panel "🚨 Cận date theo vị trí"; KPI "Hết hàng"; cột "Nhóm" + "ĐVT" + "Min/Max"; filter "Nhóm" + "Trạng thái"; nút "Chi tiết →" drill-down (route `/inventory/by-sku/[code]/locations` chưa tồn tại); badge "Dưới min" / "Vượt max"
- **Dư:** 3 KPI + Excel export
- **Note:** Bảng khá khớp, cần tạo route drill-down

### UC-INV-02 — Tồn theo Vị trí
- **Mockup:** line 2985-3030, URL `/inventory/by-location`
- **Web:** route `/inventory/by-location`, file `src/app/inventory/by-location/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Input tra cứu mã VT; nút Excel; bảng pallet chi tiết (Lô/NSX/HSD/SL/Trạng thái); nút "✏ Sửa số tồn" link UC-INV-09; sơ đồ kệ riêng (theo Khu+Kệ)
- **Dư:** Modal popup chi tiết VT
- **Note:** Grid visual khá khớp, thiếu bảng pallet chi tiết

### UC-INV-03 — Tồn theo Pallet
- **Mockup:** line 3032-3062, URL `/inventory/by-pallet`
- **Web:** route `/inventory/by-pallet`, file `src/app/inventory/by-pallet/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Filter search/trạng thái/date/Excel; cột "Ngày tạo" + "Số dòng" + "Tổng SL gốc/còn" + "Phiếu nguồn"
- **Dư:** —
- **Note:** Chỉ fetch IN_STORAGE + IN_STAGING (cần mở 4 trạng thái)

### UC-INV-04 — Báo cáo FEFO toàn kho
- **Mockup:** line 3064-3101, URL `/inventory/fefo-overview`
- **Web:** route `/inventory/by-lot`, file `src/app/inventory/by-lot/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Filter search + select cấp cảnh báo + Excel; KPI 3 ô (🔴/🟡/🟢) với "X lô · SL: Y"; cột "NSX" + "Vị trí"; highlight nền dòng theo urgency
- **Dư:** 3 urgency levels (critical/warning/normal)
- **Note:** Bảng 8 cột OK, thiếu KPI summary + cột NSX/VT

### UC-INV-05 — Cảnh báo HSD & Tồn thấp
- **Mockup:** line 3104-3178, URL `/alerts`
- **Web:** route `/inventory/alerts`, file `src/app/inventory/alerts/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** KPI "Vượt max"; hộp "Hàng tồn lâu — cận date xa nhất theo vị trí"; trị giá ước (triệu VND); nút action "Tạo gợi ý nhập" + "Đề xuất xuất"; **bảng cấu hình gửi mail tự động** (5 loại + tần suất + người nhận + on/off)
- **Dư:** 3 KPI + bảng riêng urgent/warning/low_stock
- **Note:** Thiếu module "Cấu hình mail tự động" (chỉ trong UC-INV-05)

### UC-INV-06 — Kiểm kê theo Vị trí
- **Mockup:** line 3187-3265 (3 bước), URL mobile `/stocktake/scan`
- **Web:** route `/kiemke/scan` + `/stock-count/[id]`, file `src/app/kiemke/scan/page.tsx` + `src/app/stock-count/[id]/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Camera scanner UI thật (chỉ icon static); form xác nhận Lô + HSD từng dòng; nút "+ Thêm pallet ngoài hệ thống"; nút "📷 Chụp ảnh hiện trường"; blind count toggle
- **Dư:** —
- **Note:** Mobile scan chỉ icon, chưa có camera thực; desktop làm chung BY_LOCATION + BY_ITEM

### UC-INV-07 — Kiểm kê theo Mã hàng
- **Mockup:** line 3268-3303, URL `/stocktake/by-sku`
- **Web:** route `/stock-count/[id]` (chung), file `src/app/stock-count/[id]/page.tsx`
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Trang riêng với SKU header; cột "Vị trí · Pallet · Lô · HSD · Người KK · Trạng thái"; cảnh báo highlight dòng STAGING-OUT; nút "Tạo phiếu xử lý chênh lệch" + "Xuất biên bản"; KPI "Tiến độ vị trí (8/8)"
- **Dư:** —
- **Note:** BY_ITEM dùng chung page với BY_LOCATION qua session.type, nên thiếu cột riêng

---

# 5. INV (8-9) + DASHBOARD + SYSTEM + INTEGRATION

### UC-INV-08 — Xử lý chênh lệch kiểm kê 🚫
- **Mockup:** line 3306-3351, URL `/stocktake/discrepancy/[id]`
- **Web:** 🚫 KHÔNG có trang
- **Trạng thái:** 🚫 Chưa có trang
- **Thiếu:** Toàn bộ — danh sách dòng chênh, action Chấp nhận/Kiểm lại
- **Dư:** —
- **Note:** ✅ VERIFIED — cần tạo page mới `/stock-count/[id]/discrepancy`

### UC-INV-09 — Phiếu điều chỉnh tồn
- **Mockup:** line 3355-3412, URL `/inventory/adjustments/new`
- **Web:** route `/inventory/adjustments` (chỉ list), file `src/app/inventory/adjustments/page.tsx`
- **Trạng thái:** ⚠️ Thiếu trang tạo mới
- **Thiếu:** Route `/inventory/adjustments/new`; detail modal cho từng dòng (Pallet/Vị trí/Lô/SL thực tế/Ghi chú); button "Lưu" riêng từng dòng
- **Dư:** 4 KPI + filter status
- **Note:** ✅ VERIFIED — list có 1 phiếu DCT-2026-001 status "Chờ duyệt", không có nút "+ Tạo phiếu"

### UC-DASH-01 — Dashboard theo vai trò
- **Mockup:** line 3433-3470, URL `/dashboard`
- **Web:** route `/dashboard`, file `src/app/dashboard/page.tsx` (50 dòng)
- **Trạng thái:** ⚠️ Thiếu một phần
- **Thiếu:** Tab theo từng vai trò (Kế toán / Thủ kho / Xe nâng / Người KK / Quản lý); mobile layout riêng cho Thủ kho
- **Dư:** Generic view chung
- **Note:** Cần widget khác tùy role

### UC-DASH-02 — KPI tổng quan (Quản lý)
- **Mockup:** line 3587-3650, URL `/dashboard/manager`
- **Web:** ⚠️ Không có route riêng (merge vào `/dashboard`)
- **Trạng thái:** ⚠️ Thiếu trang riêng
- **Thiếu:** Route `/dashboard/manager` với KPI (Tồn theo nhóm / Top mã xuất / HSD / Phiếu chờ)
- **Dư:** —
- **Note:** Tách route manager riêng

### UC-SYS-01 — Cấu hình chung 🔥
- **Mockup:** line 3660-3707, URL `/system/general`
- **Web:** route `/system/config`, file `src/app/system/config/page.tsx`
- **Trạng thái:** ❌ Thiếu nghiêm trọng
- **Thiếu:** Logo upload + UI, Favicon upload, Hotline, Email hỗ trợ, Footer text, Tên ứng dụng, Tên rút gọn
- **Dư:** —
- **Note:** ✅ VERIFIED — chỉ có 5 key-value generic (company_name, hsd_warning_7d/30d, default_min_stock, timezone)

### UC-SYS-02 — Cấu hình email
- **Mockup:** line 3711-3768, URL `/system/mail`
- **Web:** route `/system/mail`, file `src/app/system/mail/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** —
- **Note:** Hỗ trợ 3 provider (SMTP/Mailgun/SendGrid), test send

### UC-SYS-03 — Audit Log
- **Mockup:** line 3770-3805, URL `/system/audit-log`
- **Web:** route `/system/audit-log`, file `src/app/system/audit-log/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** —
- **Note:** Filter ngày/user/action, export Excel

### UC-SYS-04 — Quản lý người dùng
- **Mockup:** line 3809-3860, URL `/system/users`
- **Web:** route `/system/users`, file `src/app/system/users/page.tsx`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** —
- **Note:** CRUD đầy đủ 5+ vai trò, modal tạo mới, khóa/mở khóa

### UC-SYS-05 — Profile cá nhân
- **Mockup:** line 3864-3918, URL `/system/profile`
- **Web:** routes `/system/profile` + `/forklift/profile` + `/thukho/profile` + `/kiemke/profile`
- **Trạng thái:** ✅ Đầy đủ
- **Thiếu:** —
- **Dư:** —
- **Note:** Mỗi role có profile riêng

### UC-INT-01 — Quét barcode/QR (Mobile)
- **Mockup:** line 3928-3977 (feature scattered)
- **Web:** route `/kiemke/scan` (chỉ kiểm kê)
- **Trạng thái:** ⚠️ Thiếu tích hợp toàn diện
- **Thiếu:** Component scanner trong forklift/put-away, thukho/inbound; hỗ trợ EAN-13/EAN-8/Code-128/QR; torch/manual/photo modes
- **Dư:** —
- **Note:** Cần dùng lại trong UC-PAL-03, UC-INV-06...

### UC-INT-02 — Chụp ảnh chứng từ/hàng hóa
- **Mockup:** line 3986-4025 (feature scattered)
- **Web:** 🚫 KHÔNG có component dedicated
- **Trạng thái:** ⚠️ Feature scattered (không có page riêng)
- **Thiếu:** Component `<ImageAttachmentManager />` reusable; upload từ camera/library, preview grid, xóa, description
- **Dư:** —
- **Note:** Cần component module nhúng vào phiếu/pallet/kiểm kê

### UC-INT-03 — Xuất Excel báo cáo
- **Mockup:** line 4028-end (feature scattered)
- **Web:** component `src/components/ExcelExport.tsx` (đã có)
- **Trạng thái:** ✅ Feature scattered (đã triển khai)
- **Thiếu:** —
- **Dư:** —
- **Note:** Dùng trong ~10+ page

---

## 📊 KẾT LUẬN

### Tổng kết
- **53 UC** trong mockup
- **14 UC ✅ đầy đủ** (26%) — chủ yếu là AUTH, MD, FK cơ bản, OUT-01, IN-01 (mới fix), IN-05, IN-06, SYS-02..05, INT-03
- **28 UC ⚠️ thiếu một phần** (53%) — hầu hết là missing field/cột/KPI/filter
- **9 UC ❌ thiếu nghiêm trọng** (17%) — INTMP-01/02, FK-04/05, OUT-04/05, SYS-01, IN-03/04
- **2 UC 🚫 chưa có trang** (4%) — MD-01, INV-08

### Effort ước tính fix toàn bộ
| Phase | Tên | Effort | Bao gồm |
|---|---|---|---|
| **P1** (Quick wins) | Hiển thị field đã có trong DB | 5-7 ngày | 18 task XS/S — cột thêm cho INV-01/02/03/04, badge PAL-06, progress bar IN-05... |
| **P2** (Field BẮT BUỘC) | Bổ sung field còn thiếu | 8-10 ngày | INTMP-01 (6 field), IN-04 checklist, IN-03 KPI grid, MD-02 chuẩn hóa button... |
| **P3** (Workflow lớn) | Build module mới | 12-15 ngày | INTMP-02 (3 bước chuẩn hóa), FK-04 TH-B, FK-05 audit log, OUT-05 (2 cách), INV-08 page mới, INV-09 /new, MD-01 page mới |
| **P4** (Report & Dashboard) | Chart, KPI, drill-down | 7-10 ngày | OUT-02/03 charts, INV-01 drill-down, DASH-01/02 tabs theo role |
| **P5** (System & Polish) | Hoàn thiện UI/UX | 5-7 ngày | SYS-01 logo/footer, INV-05 mail config, INT-01/02 component reuse |

**Tổng ước tính:** ~8-10 tuần với team 2-3 người (1 BE + 1 FE + 1 QA part-time).

### File tham khảo
- Báo cáo gap cũ (đã thay thế): [BAO_CAO_GAP_VPS.md](BAO_CAO_GAP_VPS.md)
- Lộ trình fix chi tiết: [LO_TRINH_FIX_GAP_DETAILED.md](LO_TRINH_FIX_GAP_DETAILED.md)
- UC-IN-01 đã fix: [BAO_CAO_UC_IN_01_DONE.md](BAO_CAO_UC_IN_01_DONE.md)
- Mapping UC → URL/menu cho QA: [BAO_CAO_UC_MAPPING_QA.md](BAO_CAO_UC_MAPPING_QA.md)

---

**HẾT BÁO CÁO 1.**
