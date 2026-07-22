# BÁO CÁO CHI TIẾT KẾT QUẢ SỬA LỖI KIỂM THỬ (UC-SYS-05: PROFILE CÁ NHÂN)

Tài liệu này tổng hợp chi tiết các lỗi kiểm thử (Fail) đã được khắc phục và nâng cấp lên trạng thái **Fixed** trong phân hệ **Hồ sơ cá nhân (Profile)**.

---

## 1. DANH SÁCH TESTCASE FAIL ĐÃ ĐƯỢC KHẮC PHỤC (FIXED)

| Mã Testcase | Tên kiểm thử | Trạng thái cũ | Trạng thái mới | Chi tiết lỗi ban đầu | Giải pháp khắc phục |
|---|---|---|---|---|---|
| **UC_SYS_05_TC05** | Upload ảnh đại diện hợp lệ | **Fail** | **Fixed** | Cả PC và Mobile đều không có tính năng đổi ảnh đại diện (avatar). | Xây dựng trình tải lên ảnh (File input + POST API + DB Save). |
| **UC_SYS_05_TC12** | Upload ảnh sai định dạng | **Fail** | **Fixed** | Do thiếu chức năng upload nên không kiểm tra được định dạng ảnh. | Thêm ràng buộc định dạng file ảnh hợp lệ ở cả Frontend và Backend. |
| **UC_SYS_05_TC13** | Upload ảnh vượt dung lượng | **Fail** | **Fixed** | Do thiếu chức năng upload nên không kiểm tra được dung lượng ảnh. | Thêm validate dung lượng file tối đa là 2MB trước khi upload. |
| **UC_SYS_05_TC24** | Upload ảnh kích thước rất nhỏ | **Fail** | **Fixed** | Do thiếu chức năng upload nên không kiểm tra được việc vỡ layout. | Thiết lập khung bao quanh avatar cố định và sử dụng scale ảnh thông minh. |

---

## 2. PHÂN TÍCH CHI TIẾT TỪNG TESTCASE & GIẢI PHÁP KỸ THUẬT

### 2.1. UC_SYS_05_TC05: Upload ảnh đại diện hợp lệ

*   **Vấn đề lỗi (Fail):** 
    Trước đây, trên giao diện profile cá nhân chỉ hiển thị cứng một biểu tượng người dùng (`person` icon) dạng icon font tĩnh. Hệ thống hoàn toàn thiếu thẻ `<input type="file">`, các hàm bắt sự kiện chọn tệp tin, cũng như luồng API kết nối lưu trữ ảnh đại diện.
*   **Giải pháp khắc phục:**
    *   **Frontend UI (`src/app/system/profile/page.tsx`):**
        *   Tích hợp thẻ input ẩn:
            ```typescript
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            ```
        *   Đặt nút thay đổi ảnh đè lên ảnh đại diện khi di chuột qua (`group-hover:opacity-100`):
            ```typescript
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            </button>
            ```
    *   **Logic xử lý hàm `handleAvatarUpload`:**
        1.  Đóng gói ảnh được chọn vào `FormData`.
        2.  Thực hiện request `POST` gửi file lên API lưu trữ tập tin chung của dự án: `/api/attachments`.
        3.  Khi có đường dẫn ảnh trả về từ API (ví dụ: `/uploads/user_avatar/...`), gọi API `PUT` `/api/auth/profile` để lưu `avatar_url` vào cơ sở dữ liệu.
        4.  Ghi đè thông tin người dùng mới trong bộ nhớ cache LocalStorage bằng `auth.saveUser(updated)` giúp dữ liệu ảnh không bị mất đi khi F5/refresh trang.

---

### 2.2. UC_SYS_05_TC12: Upload ảnh sai định dạng

*   **Vấn đề lỗi (Fail):**
    Nếu người dùng chọn tải lên các tệp tin không phải là ảnh (như `.exe`, `.txt`, `.zip`), hệ thống sẽ chấp nhận tải lên gây lỗi hiển thị hoặc tiềm ẩn lỗ hổng bảo mật.
*   **Giải pháp khắc phục:**
    *   **Ràng buộc ở Hộp thoại chọn File (OS File Dialog):** Thêm thuộc tính `accept="image/png,image/jpeg,image/jpg,image/webp"` để chỉ hiển thị các tệp tin ảnh khi mở thư mục.
    *   **Validate bằng Javascript (Frontend):** Trước khi tạo request gửi lên API, thực hiện kiểm tra MIME type của tệp:
        ```typescript
        if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
          setToast({ message: "Chỉ chấp nhận file ảnh định dạng PNG, JPG, JPEG, hoặc WebP.", type: "error" });
          setTimeout(() => setToast(null), 4000);
          return;
        }
        ```
        Nếu sai định dạng, hệ thống chặn lại lập tức và xuất ra Toast cảnh báo màu đỏ trực quan.

---

### 2.3. UC_SYS_05_TC13: Upload ảnh vượt dung lượng cho phép

*   **Vấn đề lỗi (Fail):**
    Người dùng tải ảnh dung lượng quá lớn (vài chục MB) sẽ làm chậm đường truyền dữ liệu và tiêu tốn tài nguyên lưu trữ của máy chủ VPS.
*   **Giải pháp khắc phục:**
    *   Thêm bước so khớp thuộc tính `file.size` trước khi thực hiện tải lên. Giới hạn dung lượng tối đa là **2MB**:
        ```typescript
        const MAX_SIZE_MB = 2;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          setToast({ message: `Dung lượng ảnh không được vượt quá ${MAX_SIZE_MB}MB.`, type: "error" });
          setTimeout(() => setToast(null), 4000);
          return;
        }
        ```
        Nếu vượt hạn mức, hệ thống ngăn chặn hành động tải lên và thông báo rõ ràng lý do cho người dùng.

---

### 2.4. UC_SYS_05_TC24: Upload ảnh kích thước rất nhỏ

*   **Vấn đề lỗi (Fail):**
    Khi tải lên một hình ảnh có kích thước rất nhỏ (ví dụ `16x16` hoặc `32x32`), trình duyệt sẽ cố gắng scale to làm vỡ ảnh hoặc ảnh bị kéo dãn làm hỏng tỷ lệ khung tròn avatar (vỡ layout).
*   **Giải pháp khắc phục:**
    *   Áp dụng các thuộc tính CSS chuyên dụng của Tailwind để bo tròn và cố định không gian hiển thị:
        *   `w-16 h-16`: Khóa cứng kích thước hiển thị của Avatar là 64px x 64px dù ảnh gốc có độ phân giải bao nhiêu.
        *   `rounded-full`: Cắt ảnh theo hình tròn hoàn hảo.
        *   `overflow-hidden`: Đảm bảo các phần ảnh thừa ngoài khung tròn bị ẩn đi.
        *   `object-cover`: Ảnh đại diện tự động căn giữa và lấp đầy khung tròn một cách cân đối, giữ nguyên tỷ lệ gốc của ảnh mà không bị méo mó.

---

## 3. FILE CHI TIẾT LIÊN QUAN

1.  **Frontend Logic & UI**: [page.tsx (system/profile)](file:///d:/wms-vinhgiang_repo/src/app/system/profile/page.tsx)
2.  **API lưu trữ File**: [route.ts (api/attachments)](file:///d:/wms-vinhgiang_repo/src/app/api/attachments/route.ts)
3.  **API lưu thông tin Profile**: [route.ts (api/auth/profile)](file:///d:/wms-vinhgiang_repo/src/app/api/auth/profile/route.ts)
4.  **Cấu hình xác thực người dùng**: [auth.ts (lib/auth)](file:///d:/wms-vinhgiang_repo/src/lib/auth.ts)
