# Báo cáo Test Case FAIL — Role Quản lý (Vĩnh Giang)

> **Nguồn:** Google Sheets `Role_QLY_VĨNH GIANG` (12 sheet, mỗi sheet = 1 module).
> **Ngày trích:** 2026-05-27
> **Người trích:** Claude (qua trình duyệt Browser 1)
> **File gốc:** https://docs.google.com/spreadsheets/d/1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog/edit

---

## 1. Tổng quan toàn bộ

| Modul | Tên modul (suy ra từ UC) | PASS | **FAIL** | Not Run | Trạng thái |
|---|---|---:|---:|---:|---|
| MD01 | Đăng nhập (vai trò Quản lý) | 69 | **1** | 8 | Đã test |
| MD02 | Danh mục cơ bản (SP, Mã hàng, Nhóm, ĐVT, Vị trí kho, NCC) | 152 | **27** | 7 | Đã test |
| MD03 | Pallet (tạo / cập nhật / xác nhận / sửa / lịch sử) | 82 | **34** | 0 | Đã test |
| MD04 | Nhập kho (Yêu cầu nhập → Tiếp nhận → Đối chiếu → Chốt) | 81 | **12** | 3 | Đã test |
| MD05 | Phiếu tồn tạm / Nhập đột xuất | 48 | **21** | 0 | Đã test |
| MD06 | Xe nâng (Forklift) | 55 | **6** | 10 | Đã test |
| MD07 | Khu chờ xuất / Outbound | 0 | **2** | 0 | Đã test 1 phần |
| MD08 | Tồn kho & Kiểm kê (UC-INV) | 0 | 0 | 0 | **Chưa test** |
| MD09 | Dashboard (UC-DASH) | 0 | 0 | 0 | **Chưa test** |
| MD10 | Hệ thống / Cấu hình chung (UC-SYS) | 0 | 0 | 0 | **Chưa test** |
| MD11 | Tích hợp / Quét barcode-QR (UC-INT) | 0 | 0 | 0 | **Chưa test** |
| **TỔNG** | | **487** | **103** | **28** | |

> **Cảnh báo nhanh:** Pass-rate trên 7 modul đã test = 487 / (487 + 103 + 28) ≈ **79 %**. Module có rủi ro cao nhất là **MD03 Pallet (34 FAIL)** và **MD05 Phiếu tạm (21 FAIL)**.

### Phân bố mức độ ưu tiên (FAIL)

- **High:** ~85 case (chiếm gần 83 %).
- **Medium:** ~17 case.
- **Low:** 1 case (MD02 - validate trường số).

---

## 2. Chi tiết theo Module → Use Case

Mỗi item gồm: TC ID, mức ưu tiên, các bước thực hiện, **Kết quả mong muốn (expected)** vs **Kết quả thực tế (actual)**, ghi chú, trạng thái dev.

---

### MD01 — Đăng nhập (vai trò Quản lý)

#### UC_01 Đăng nhập với vai trò quản lý

**TC_T03_12 — Kiểm tra khoảng trắng đầu/cuối trong password** · Medium · Dev: ✅ Fixed
- Steps: Nhập password có khoảng trắng đầu/cuối.
- Expected: Hệ thống chặn không cho phép nhập.
- Actual: (trống — Pass sau khi fix). Status hiện tại vẫn đánh **Fail**, đề nghị retest và đóng nếu OK.

> **Not Run cần ưu tiên** (MD01, 8 case): Tài khoản bị khóa (TC_T01_012), Submit Enter (TC_T03_24, TC_T04_39), Quên mật khẩu với tài khoản khóa (TC_T04_05, _09), OTP hết hạn (TC_T04_12), Giới hạn sai OTP (TC_T04_18 — note: yêu cầu khóa 30p nhưng hệ thống đang khóa 1 tiếng), Unicode/ký tự đặc biệt (TC_T04_42).

---

### MD02 — Danh mục cơ bản

#### UC-MD-01 — Khai báo sản phẩm

**TC_ADD_003 — Bỏ trống tất cả các trường khi Thêm SP** · High
- Steps: Mở "Khai báo SP" → Thêm SP → bỏ trống → Lưu.
- Expected: Báo "Trường * bắt buộc nhập" dưới từng trường và lưu không thành công.
- Actual: Chỉ hiển thị "Mã SKU là bắt buộc" (thiếu validate các trường khác).

**(không có ID, row 35) — Nhập sai kiểu vào Trọng lượng / Thể tích / Tồn min / Tồn max** · Low
- Expected: Báo "Trường chỉ cho phép nhập số" (tiếng Việt).
- Actual: Hệ thống trả về thông báo tiếng Anh "Please enter a number." → cần i18n.

**(row 36) — Dữ liệu nhập trường trạng thái** · Low
- Expected: Hiển thị đúng trạng thái vừa chọn.
- Actual: Luôn mặc định "Đang hoạt động" sau khi lưu.

**TC_ADD_009 — Nhập trọng lượng âm** · High
- Expected: "Chỉ được phép nhập giá trị lớn hơn 0".
- Actual: Thông báo tiếng Anh "Value must be greater than or equal to 0." → cần i18n + đổi sang `> 0` thay vì `>= 0`.

**(row 50) — Thông tin Chỉnh sửa sản phẩm** · High
- Expected: Form sửa hiển thị 12 trường KHÔNG có "Tồn tối thiểu/tối đa".
- Actual: Form đang thừa 2 trường Tồn min/max. Note: "màn chỉnh sửa đang thừa - Tồn tối thiểu - Tồn tối đa".

**TC_MD_001 — Sửa sản phẩm thành công** · High
- Expected: Cập nhật thành công, hiển thị đúng thông tin đã nhập.
- Actual: Trạng thái luôn bị reset về "đang hoạt động" sau lưu.

**TC_MD_005 — Cập nhật trạng thái sản phẩm Active/Inactive** · Medium
- Expected: Hiển thị đúng trạng thái.
- Actual: Luôn hiển thị "ĐANG HOẠT ĐỘNG".

#### UC-MD-02 — Quản lý Mã hàng

**TC_001_001 — Thông tin "Tạo mã hàng" trên mobile** · High
- Expected: Có đủ trường + "Ảnh hàng / vỏ thùng" + Ghi chú + nút "Tạo mã hàng".
- Actual: Thiếu "ẢNH HÀNG / VỎ THÙNG".

**TC_001_002 — Tạo mã hàng thành công trên mobile** · High
- Steps: Login Thủ kho → Tạo mã hàng → Nhập hợp lệ → Tạo.
- Expected: Mã hàng được tạo, trạng thái "Chờ xử lý".
- Actual: Báo lỗi đỏ "Mã hàng theo chứng từ là bắt buộc" → không tạo được.

**TC_001_006 — Nhập mã hàng trùng** · High
- Expected: Hiển thị cảnh báo mã hàng trùng.
- Actual: Không thêm được nhưng cũng không cảnh báo.

**TC_001_010 — Nhập quy cách hợp lệ** · Medium
- Expected: Lưu thành công.
- Actual: Bị lỗi "Mã hàng theo chứng từ là bắt buộc" chặn lưu.

**(row 95) — Thông tin "Chuẩn hóa mã hàng"** · High
- Expected: Hiển thị các trường + nút "Chuẩn hóa".
- Actual: Hệ thống hiện tại chưa có tính năng chuẩn hóa.

**TC_STANDARD_001 — Chuẩn hóa mã hàng thành công** · High · Dev: ✅ Fixed
- Steps: Login Kế toán → mở mã hàng chờ xử lý → cập nhật thông tin chuẩn hóa → Lưu.
- Expected: Mã chuyển "Đã chuẩn hóa" + sản phẩm chuyển sang "Danh mục sản phẩm".
- Actual: Chuẩn hóa fail, chưa chuyển sang "Danh mục sản phẩm". → Retest sau fix.

**(row 97) — Tạo mã hàng mới (từ luồng chuẩn hóa)** · High · Dev: ✅ Fixed
- Expected: Form đủ trường + nút "Chuẩn hóa".
- Actual: Form đang hiển thị form Lưu/Tạo tiếp/Tạo mã (sai luồng). → Retest sau fix.

**TC_STANDARD_006 — Bỏ trống field bắt buộc khi chuẩn hóa** · High
- Expected: Validate hiển thị đúng.
- Actual: Báo "Mã hàng theo chứng từ là bắt buộc" (luôn chỉ check 1 field).

#### UC-MD-03 — Quản lý Nhóm hàng

**TC_GROUP_001 — Thông tin "Quản lý nhóm hàng"** · High
- Expected: Có nút Import / "Chọn file từ Excel".
- Actual: Thiếu hoàn toàn tính năng IMPORT.

#### UC-MD-05 — Quản lý Vị trí kho

**(row 187) — Thông tin "Quản lý vị trí kho"** · High
- Expected: Trạng thái: Trống / Đang dùng / Đầy / Còn một phần / Chờ kiểm kê / Khóa SD / Cần kiểm tra + nút Thêm / Import / Xem dạng sơ đồ.
- Actual: Trạng thái sai (Trống/Đang dùng/Đầy đủ/Bảo trì/Đặt chỗ/Chờ xuất). Thiếu IMPORT và "Xem dạng sơ đồ".

**TC_LOC_003 — Hiển thị màu sắc theo trạng thái vị trí kho** · High
- Expected: Mỗi trạng thái có màu đúng theo mockup.
- Actual: Màu hiển thị sai so với mockup.

**TC_LOC_014 → TC_LOC_019 (6 case) — Cập nhật trạng thái Trống / Đang dùng / Đầy / Còn một phần / Chờ kiểm kê / Khóa SD** · Medium
- Expected: Vị trí hiển thị đúng màu theo từng trạng thái.
- Actual: Hệ thống đang gán sai màu / sai trạng thái (bao gồm sai mapping label: "Còn một phần" hiển thị nhầm "Bảo trì", "Chờ kiểm kê" hiển thị "Đặt chỗ", "Khóa SD" hiển thị "Chờ xuất"). → **Liên quan đến vấn đề thiếu/sai mapping trạng thái ở [UC-MD-05] (row 187).**

**(row 207) — Cập nhật trạng thái "Cần kiểm tra lại"** · Medium
- Expected: (chưa điền).
- Actual: (chưa điền) — case cần bổ sung mô tả.

#### UC-MD-06 — Quản lý Nhà cung cấp

**TC_SUP_001 — Thông tin "Quản lý Nhà cung cấp"** · High · Dev: ✅ Fixed
- Expected: Bảng có cột … + **Số phiếu nhập** + Trạng thái.
- Actual: Hiển thị **MST** thay vì "Số phiếu nhập". Note: "Số phiếu nhập -> MST".

**TC_SUP_002 — Thông tin form "Thêm NCC"** · High · Dev: ✅ Fixed
- Expected: Form gồm Mã NCC, **Số phiếu nhập**, Tên NCC, Người liên hệ, SĐT, Email, Địa chỉ, Ghi chú, nút Hủy / Thêm.
- Actual: Form hiển thị **MST** thay vì "Số phiếu nhập". Note: "Số phiếu nhập -> MST".

> **Not Run (MD02, 7 case):** TC_MD_005 phân quyền xóa, TC_001_007 ký tự đặc biệt mã hàng, TC_GROUP_018 / _024 (CRUD nhóm), TC_UOM_005 / _031 (CRUD đơn vị tính), TC_LOC_030 (CRUD vị trí kho).

---

### MD03 — Pallet

#### UC-PAL-01 — Tạo pallet

**(row 15) — Thông tin màn "Tạo pallet"** · High
- Expected: Có Mã pallet + **Liên kết với phiếu nhập (tùy chọn)** + Ghi chú + nút Tạo pallet.
- Actual: Trên desktop thiếu "Liên kết với phiếu nhập". Trường năm chỉ giới hạn 4 ký tự nhưng đang nhập được 5 → sai validation.

**TC_CREATE_PAL_008 — Nhập Ngày nhập** · High
- Expected: Ngày được lưu, không chọn được ngày trong quá khứ.
- Actual: Nhập nhiều số ở trường năm vẫn được. → Sai validate ngày.

**TC_CREATE_PAL_011 — Trạng thái pallet sau khi tạo** · High
- Expected: Pallet ở trạng thái **"Chưa kích hoạt"**.
- Actual: Trạng thái **"Chưa kích hoạt"** (cùng giá trị nhưng đánh Fail — nghi do dấu cách hoặc text mismatch). → Cần verify lại text chính xác.

**(row 45) — Tạo pallet liên kết phiếu nhập** · High
- Expected: Tạo pallet thành công với phiếu nhập đã chọn.
- Actual: "Chưa liên kết phiếu" sau khi tạo.

**(row 46) — Hiển thị phiếu nhập gợi ý khi tạo pallet**
- Expected: Chỉ hiển thị phiếu chưa có pallet gán.
- Actual: Vẫn hiển thị phiếu đã gán cho pallet khác → leak data, có thể gán trùng.

**(row 47) — Hiển thị danh sách hàng khi đã liên kết phiếu nhập** · High
- Expected: Hiển thị đúng danh sách hàng như trong phiếu yêu cầu nhập.
- Actual: Chưa hiển thị danh sách hàng.

#### UC-PAL-02 — Cập nhật pallet (thêm hàng) — Note bug chung: "THỦ KHO CHƯA THÊM ĐƯỢC HÀNG PALLET"

**TC_UPDATE_PAL_001 — Thông tin "Cập nhật chi tiết pallet"** · High
- Expected: Tìm theo mã, Quét mã, SL, Đơn vị lẻ, Lô, HSD, Ghi chú, nút Lưu.
- Actual: Thiếu "Đơn vị lẻ" để quy đổi; hiển thị quy đổi ra đơn vị lẻ nhưng đang hiển thị "thùng" (sai unit).

**(row 50) — Thông tin pallet** · High
- Expected: Hiển thị Trạng thái pallet + Mã phiếu nhập + Tên người tạo + Thời gian.
- Actual: Hiển thị NCC + Trạng thái + SL dòng hàng + Khối lượng + Ngày tạo (sai mapping field).

**TC_UPDATE_PAL_005 — Bỏ trống từng trường bắt buộc** · Medium
- Expected: Nút "Thêm vào pallet" bị disable.
- Actual: Bỏ trống Lô + HSD bắt buộc vẫn thêm được. → Validation thiếu.

**TC_UPDATE_PAL_006 — Nhập dấu cách đầu/cuối các trường** · Medium
- Expected: Auto trim Mã hàng, lô, ghi chú…
- Actual: Không trim.

**TC_UPDATE_PAL_011 — Xác nhận dòng hàng** · High
- Expected: Dòng được thêm và hiển thị đầy đủ thông tin (gồm ghi chú).
- Actual: Không hiển thị ghi chú.

**(row 79) — Auto tự hiển thị đơn vị lẻ** · High
- Expected: Hiển thị đúng đơn vị tính lẻ của hàng.
- Actual: Chưa có đơn vị tính lẻ.

**TC_UPDATE_PAL_035 — Giao diện Cập nhật chi tiết pallet** · High
- Expected: Hiển thị đúng mockup.
- Actual: Trên Desktop thừa phần "Ảnh đính kèm".

**TC_UPDATE_PAL_037 — Chỉnh sửa khi đã liên kết phiếu YC nhập (role Thủ kho)** · High
- Expected: Được thêm/xóa dòng hàng.
- Actual: Role Thủ kho **không được thêm** dòng hàng. → Phân quyền sai.

#### UC-PAL-04 — Xác nhận pallet

**TC_CONFIRM_PAL_026 — Hiển thị đúng thông tin pallet sau xác nhận** · High
- Expected: Thông tin đầy đủ.
- Actual: Thiếu đơn vị lẻ; hiển thị quy đổi sai unit (vẫn là "thùng").

#### UC-PAL-05 — Sửa pallet sau xác nhận

**(row 143) — Thông tin sửa pallet sau xác nhận** · High
- Expected: Mã Pallet + Lý do sửa + Mô tả chi tiết + Người duyệt + nút "Tiếp tục sửa".
- Actual: Mobile chỉ có trường "Lý do sửa", thiếu các trường còn lại.

**(row 148) — Nhập lý do chỉnh sửa < 5 ký tự** · High
- Expected: Disable nút Xác nhận + hiển thị số ký tự đã nhập.
- Actual: Trên mobile không disable, không hiển thị counter ký tự.

**TC_EDIT_PAL_008, _013, _014, _018, _020 (5 case) — Audit log sau khi sửa pallet** · High
- Expected: Ghi đủ thông tin: đối tượng, hành động, người dùng, vai trò, IP, chi tiết thay đổi, lý do.
- Actual: Audit log **ghi sai đối tượng, hành động, thiếu user, vai trò, IP, lý do, format sai**. → Lỗi nghiêm trọng cho audit & compliance.

#### UC-PAL-06 — Xem lịch sử pallet

**(row 166) — Thông tin pallet (xem)** · High
- Expected: Thông tin mã + Dòng hàng + Lịch sử di chuyển.
- Actual: Hiển thị sai mockup.

**TC_HISTORY_PAL_002 — Tìm pallet theo ngày** · High
- Expected: Lọc đúng theo ngày.
- Actual: Chưa có filter theo ngày.

**TC_HISTORY_PAL_003 — Tìm pallet theo NCC** · High
- Expected: Lọc đúng theo NCC.
- Actual: Chưa có filter theo NCC.

**TC_HISTORY_PAL_004, _006, _008, _013, _014, _015, _017, _018, _020 (9 case) — Hiển thị chi tiết / lịch sử pallet** · High
- Expected: Hiển thị đầy đủ lịch sử vị trí, trạng thái, vòng đời pallet, dữ liệu sau chỉnh sửa, đa-role xem được.
- Actual: Lịch sử chưa cập nhật vị trí, chưa cập nhật trạng thái, hiển thị sai mockup, mới xem được với role Admin (các role khác fail). → Module Lịch sử pallet hầu như **chưa hoàn thiện**.

---

### MD04 — Nhập kho

#### UC-IN-01 — Lập phiếu yêu cầu nhập

**TC_IN_REQ_027 — Thông báo cho Thủ kho sau khi lưu phiếu** · High
- Expected: Thủ kho nhận thông báo.
- Actual: Chưa đồng bộ dữ liệu từ Kế toán → Thủ kho.

**TC_IN_REQ_028 — Hiển thị thông báo cho Thủ kho** · High
- Expected: Thông báo hiển thị đúng.
- Actual: Cùng nguyên nhân — chưa có cơ chế đồng bộ Kế toán ↔ Thủ kho.

#### UC-IN-02 — Tiếp nhận phiếu nhập (Thủ kho)

**TC_RECEIVE_IN_002 — Mở phiếu nhập trên điện thoại** · High
- Expected: Phiếu mở thành công.
- Actual: Hệ thống hiện "lỗi reload".

**TC_RECEIVE_IN_008 — Ghi chú hàng thiếu** · Medium
- Expected: Hệ thống ghi nhận chênh lệch hàng thiếu.
- Actual: Ô ghi chú đang hiển thị mặc định, không cho phép nhập.

**TC_RECEIVE_IN_009 — Ghi chú hàng thừa** · Medium
- Expected: Hệ thống ghi nhận chênh lệch hàng thừa.
- Actual: (trống).

**TC_RECEIVE_IN_014 — Hiển thị ghi chú chênh lệch sau khi lưu** · Medium
- Expected: Ghi chú hiển thị đúng.
- Actual: Hiển thị sai.

**TC_RECEIVE_IN_028 — Tiếp nhận phiếu nhập có nhiều ghi chú chênh lệch** · Low
- Expected: Lưu đầy đủ các ghi chú.
- Actual: Chưa có chức năng ghi chú (chênh lệch).

**TC_RECEIVE_IN_031 — Up file Excel NCC lớn (kéo thả)** · Medium
- Expected: Hiển thị đúng dữ liệu từ file.
- Actual: Hệ thống chưa xây dựng tính năng kéo thả file.

#### UC-IN-03 — Đối chiếu phiếu nhập

**(row 79) — Thông tin đối chiếu phiếu trên PC** · High
- Expected: Tổng yêu cầu + Tổng thực nhập + Pallet đã tạo + Mã tạm + Mã hàng + Tên + SL yêu cầu + SL thực nhập + Chênh lệch + Trạng thái + Pallet.
- Actual: Hiển thị NCC, Ngày dự kiến, Ngày tạo, Bắt đầu nhận, dòng hàng (mã, tên, SL dự kiến, SL thực nhận, chênh lệch, Lô, HSD), nút "Tạo pallet" — **thiếu Tổng yêu cầu / Tổng thực nhập / Pallet đã tạo + Trạng thái + Pallet (mapping)**.

#### UC-IN-04 — Chốt phiếu nhập

**TC_CLOSE_IN_006 — Cập nhật tồn kho sau khi chốt phiếu** · High
- Expected: Tồn kho được cập nhật.
- Actual: Hệ thống KHÔNG đồng bộ số lượng sản phẩm lên tổng tồn kho. Ref: Screenshot 2026-05-27 115021.png.

**TC_CLOSE_IN_010 — Hiển thị dữ liệu phiếu sau khi chốt** · High
- Expected: Dữ liệu phiếu hiển thị đúng.
- Actual: Chưa đồng bộ về tổng tồn kho.

**TC_CLOSE_IN_015 — Cập nhật tồn kho sau khi xử lý chênh lệch** · High
- Expected: Tồn kho cập nhật đúng.
- Actual: Không cập nhật đúng tổng tồn.

> **⚠️ Cụm bug nghiêm trọng:** TC_CLOSE_IN_006 / _010 / _015 cho thấy luồng **chốt phiếu nhập → cập nhật tồn kho** đang đứt. Đây là critical path.

> **Not Run (MD04, 3 case):** TC_IN_REQ_029 (Nhập từ Excel), TC_RECEIVE_IN_017/018 (ghi chú chênh lệch hàng thiếu/thừa).

---

### MD05 — Phiếu tồn tạm / Nhập đột xuất

#### UC-INTMP-01 — Tạo phiếu tồn tạm (Mobile)

**(row 17) — Không nhập trường bắt buộc khi tạo phiếu** · High
- Expected: Báo lỗi yêu cầu nhập.
- Actual: Vẫn tạo phiếu thành công khi thiếu "Tên người giao".

**(row 18) — So sánh mã phiếu trước & sau khi lưu** · High
- Expected: Mã phiếu ở màn tạo và sau khi lưu phải giống nhau.
- Actual: Hiển thị khác nhau.

**TC_TMP_IN_010 — Hiển thị phiếu tồn tạm sau khi lưu** · High
- Expected: Phiếu hiển thị trong danh sách.
- Actual: Không hiển thị ảnh đã tải lên từ mobile; hiển thị sai Ngày giờ nhập.

**TC_TMP_IN_011 — Lưu NCC trên phiếu tồn tạm** · High
- Expected: NCC được lưu đúng.
- Actual: Mới lưu thông tin NCC ngoài danh sách; bên trong chi tiết phiếu KHÔNG có.

**TC_TMP_IN_012 — Lưu ghi chú mô tả hàng** · High
- Expected: Ghi chú được lưu đúng.
- Actual: Không hiển thị ghi chú dòng hàng.

**TC_TMP_IN_019 — Tạo nhanh mã hàng mới trên mobile** · High
- Expected: Mã hàng mới được tạo thành công.
- Actual: Mã hàng không tạo thành công.

**TC_TMP_IN_023 — Mở lại phiếu sau khi lưu** · High
- Expected: Dữ liệu hiển thị đúng.
- Actual: Thiếu tên NCC; sai Ngày giờ nhập.

**TC_TMP_IN_024 — Lưu nhiều dòng hàng khác nhau** · High
- Expected: Tất cả dữ liệu lưu đúng.
- Actual: Hiển thị thiếu trường ghi chú.

**TC_TMP_IN_025 — Thao tác tạo phiếu trên điện thoại** · High
- Expected: Xử lý thành công & hiển thị đúng.
- Actual: Thiếu tên NCC; sai Ngày giờ; không hiển thị ảnh. Note: "Trên mobile hoạt động không đúng mockup".

#### UC-INTMP-02 — Chuẩn hóa phiếu tạm (Desktop)

**TC_STD_TMP_001 — Thông tin "Chuẩn hóa phiếu tạm"** · High
- Expected: Đầy đủ Nguồn / Người giao / Ngày giờ / Ảnh chứng từ + nút "Tạo NCC mới" + 4 bước tiến độ + nút Hoàn thành.
- Actual: Không có "Tạo NCC khi chưa có NCC"; chưa có bước "Liên kết / Tạo phiếu chính thức".

**TC_STD_TMP_002 — Thông tin "Chuẩn hóa mã hàng"** · High
- Expected: Cột Mã chứng từ + Tên rút gọn + SL + **Mã chuẩn** + Hành động.
- Actual: Thiếu nút "Hành động", sai format Mã chuẩn so với mockup. Note: "Mới test tạo phiếu trên PC".

**TC_STD_TMP_003 — Thông tin "Liên kết / Tạo phiếu chính thức"** · High
- Expected: 2 lựa chọn: liên kết với phiếu YC sẵn có / tạo phiếu YC mới (hồi tố).
- Actual: Không có chức năng.

**TC_STD_TMP_006 — Xem chi tiết phiếu tạm** · High
- Expected: Chi tiết phiếu tạm đầy đủ.
- Actual: Thiếu nút "Tạo NCC khi chưa có".

**TC_STD_TMP_007 — Hiển thị NCC trên phiếu tạm** · High
- Expected: NCC hiển thị đúng.
- Actual: Không hiển thị NCC.

**(row 55) — Click vào "Mã hàng chuẩn"** · High
- Expected: Giữ nguyên, không chuyển màn.
- Actual: Chuyển sang màn "Chuẩn hóa mã" → sai hành vi.

**TC_STD_TMP_023 — Lưu lý do từ chối** · High
- Expected: Lý do được lưu đúng.
- Actual: Không lưu lý do.

**TC_STD_TMP_029 — Mở lại phiếu sau khi phê duyệt** · High
- Expected: Dữ liệu hiển thị đúng.
- Actual: Hiển thị sai mã Phiếu.

**TC_STD_TMP_031 — Thao tác chuẩn hóa trên Desktop** · High
- Expected: Xử lý thành công.
- Actual: (trống — chưa retest).

#### UC-INTMP-03 — Xem tồn tạm (Phiếu chưa được xử lý)

**UC-INTMP-03-TC002 — Hiển thị Tổng phiếu tạm** · High
- Expected: Tổng phiếu hiển thị đúng DB.
- Actual: Hiển thị sai.

**UC-INTMP-03-TC017 — Mở chi tiết bằng icon `>`** · High
- Expected: Chuyển đến màn chi tiết phiếu.
- Actual: Chưa chuyển.

**UC-INTMP-03-TC018 — Điều hướng nhiều lần (click icon liên tục)** · Medium
- Expected: Không lỗi / không mở trùng tab.
- Actual: Chưa chuyển đến màn chi tiết phiếu.

---

### MD06 — Xe nâng (Forklift)

#### UC-FK-02 — Đưa Pallet vào vị trí chứa

**UC-FK-02_TC01 — Đưa pallet vào vị trí hợp lệ bằng QR** · High
- Expected: Pallet gán vào vị trí, trạng thái "Đang lưu kho".
- Actual: Hệ thống **chưa xây dựng tính năng quét QR để đồng bộ dữ liệu**.

**(row 46) — Thông tin lịch sử hoạt động hôm nay** · High
- Expected: Hiển thị đúng thông tin đã đồng bộ trong ngày.
- Actual: Hiển thị sai lịch sử hôm nay.

#### UC-FK-03 — Chuyển Vị trí chứa → Vị trí chứa

**UC-FK-03_TC20 — Lịch sử luân chuyển (audit/log)** · High
- Expected: Ghi nhận đầy đủ pallet, vị trí cũ, vị trí mới, user, thời gian.
- Actual: Hệ thống chưa xây dựng tính năng này.

#### UC-FK-04 — Chuyển Vị trí chứa → Khu chờ xuất (FEFO)

**UC-FK-04_TC03 — Hiển thị danh sách mã hàng bằng cách quét mã hàng** · High
- Expected: Ưu tiên pallet có HSD gần nhất (FEFO).
- Actual: Quét mã hàng hiển thị **sai vị trí** (chưa FEFO).

**(row 70) — Xuất 1 phần hàng** · High
- Expected: Pallet chuyển 1 phần sang vị trí chờ xuất.
- Actual: Hệ thống không hiển thị thông tin phần hàng chờ xuất.

#### UC-FK-06 — Lịch sử luân chuyển

**UC-FK-06_TC01 — Xem toàn bộ lịch sử luân chuyển** · High
- Expected: Hiển thị toàn bộ lịch sử di chuyển pallet.
- Actual: Chưa xây dựng tính năng.

> **Not Run (MD06, 10 case):** TC_FK_02_05/06/15 (quét QR vị trí với các điều kiện khác nhau), TC_FK_02_18 (audit log khi xếp pallet), TC_FK_03_01/08/09/10/12/18 (luồng chuyển vị trí — quét pallet, quét vị trí đích, lỗi QR…). → **Toàn bộ tính năng quét QR & audit log Forklift chưa làm xong.**

---

### MD07 — Khu chờ xuất / Outbound

#### UC-OUT-01 — Xem hàng tại Khu chờ xuất

**UC-OUT-01_TC01 — Xem danh sách khu chờ xuất hợp lệ** · High
- Expected: Hiển thị danh sách pallet/hàng đang ở Staging-out.
- Actual: Mới hiển thị khi xuất 100 % hàng (không hiển thị xuất 1 phần).

**UC-OUT-01_TC04 — Hiển thị đầy đủ thông tin dashboard** · High
- Expected: Dashboard có Tổng pallet, **Tổng mã**, Tổng SL, **Quá 24H**; mỗi dòng: Pallet, Mã hàng, Lô/Date, SL, Thời gian đến khu chờ xuất.
- Actual: Thiếu "Tổng mã" và "Quá 24H"; thừa "Tổng KG" và "HSD gần nhất".

> ⚠️ **Lưu ý:** Sheet MD07 có PASS=0, FAIL=2 → đa số test case khác chưa chạy. Cần ưu tiên test thêm Outbound.

---

### MD08 — Tồn kho & Kiểm kê *(CHƯA TEST)*
Sheet trống PASS/FAIL = 0. UC tham chiếu: **UC-INV-01 Tồn kho theo mã hàng**, …

### MD09 — Dashboard *(CHƯA TEST)*
Sheet trống. UC tham chiếu: **UC-DASH-01 Dashboard theo vai trò (Kế toán kho, …)**.

### MD10 — Hệ thống / Cấu hình *(CHƯA TEST)*
Sheet trống. UC tham chiếu: **UC-SYS-01 Cấu hình chung**.

### MD11 — Tích hợp / Quét QR Mobile *(CHƯA TEST)*
Sheet trống. UC tham chiếu: **UC-INT-01 Quét barcode / QR (Mobile)**, ít nhất 15 TC đã được liệt kê nhưng chưa chạy.

---

## 3. Cụm bug nổi bật cần fix gấp (Priority A)

1. **Chốt phiếu nhập không cập nhật tồn kho** — MD04 TC_CLOSE_IN_006/_010/_015. Critical path luồng nhập.
2. **Toàn bộ tính năng quét QR/barcode + audit log của Xe nâng chưa làm** — MD06 (6 Fail + 10 Not Run).
3. **Audit log sửa pallet ghi sai/thiếu** — MD03 TC_EDIT_PAL_008/_013/_014/_018/_020. Ảnh hưởng compliance.
4. **Tồn kho theo mã hàng (MD08), Dashboard (MD09), Hệ thống (MD10), Tích hợp QR (MD11) chưa test 1 case nào.**
5. **Phiếu tạm Mobile thiếu validation, sai thời gian, mất ảnh, mất NCC** — MD05 cụm UC-INTMP-01 (9 Fail).
6. **Trạng thái Vị trí kho sai cả label lẫn màu (TC_LOC_003 → _019)** — MD02. Ảnh hưởng UI/UX & nghiệp vụ.
7. **Đồng bộ Kế toán ↔ Thủ kho khi tạo phiếu YC nhập (MD04 TC_IN_REQ_027/028)** — chưa có notification.

## 4. Cụm bug ưu tiên trung bình (Priority B)

- I18n thông báo validate (MD02 row 35, TC_ADD_009 — đang trả về tiếng Anh).
- Auto-trim các trường text (MD03 TC_UPDATE_PAL_006, MD01 TC_T03_12).
- Phân quyền role Thủ kho cập nhật pallet (MD03 TC_UPDATE_PAL_037).
- Form Thêm/Sửa NCC mapping sai cột Số phiếu nhập ↔ MST (MD02 TC_SUP_001/002 — đã Fixed, cần retest).
- Form Khai báo SP mặc định trạng thái sai khi Sửa (MD02 TC_MD_001/005, row 36, row 50).
- Submit Enter ở luồng quên mật khẩu khi đã "show password" — MD01 TC_T03_24/TC_T04_39 (Not Run, có kết quả thực tế quan sát).

## 5. Khuyến nghị

- **Retest** tất cả TC có Dev = `Fixed` (MD01 TC_T03_12, MD02 TC_STANDARD_001 / row 97 / TC_SUP_001 / TC_SUP_002, MD03 TC_CREATE_PAL_011 nghi text mismatch) trước khi đẩy báo cáo cho khách hàng.
- **Hoàn thành test** 4 module trống (MD08-MD11) — đặc biệt MD08 (Tồn kho) và MD11 (Quét QR), vì chúng phụ thuộc vào nghiệp vụ đã test ở MD03-06.
- **Bổ sung mô tả** cho các TC còn trống Expected/Actual (vd: MD02 row 207, MD03 TC_HISTORY_PAL_xxx có cùng "Lịch sử chưa cập nhật rõ vị trí" — gộp thành 1 bug ticket).
- **Group bug theo Critical Path** đã liệt kê trong [CRITICAL_PATHS.md](../CRITICAL_PATHS.md) để xếp lịch fix theo flow nghiệp vụ thay vì theo module rời rạc.
