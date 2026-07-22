# BÁO CÁO PHÂN TÍCH LỖI KIỂM THỬ & KẾ HOẠCH FIX (UC-INT-02: CHỤP ẢNH CHỨNG TỪ / HÀNG HÓA)

Tài liệu này tổng hợp chi tiết 5 lỗi kiểm thử (Fail/Fixed=Fail) trong phân hệ **Chụp ảnh chứng từ / hàng hóa (UC-INT-02)**, chỉ ra nguyên nhân gốc rễ trong mã nguồn hiện tại và đề xuất kế hoạch khắc phục chi tiết.

---

## 1. DANH SÁCH CÁC TESTCASE CẦN KHẮC PHỤC

| Mã Testcase | Tên kiểm thử | Trạng thái hiện tại | Lỗi ghi nhận (Fail) | Nguyên nhân gốc rễ trong mã nguồn | Kế hoạch khắc phục (Giải pháp) |
|---|---|---|---|---|---|
| **UC_INT_02_TC03** | Chọn ảnh từ thư viện thành công | **Fail** | Hệ thống chưa có tính năng tải ảnh từ thư viện. | Thẻ input file đang bị hardcode thuộc tính `capture="environment"`, ép thiết bị di động mở camera trực tiếp mà không cho chọn thư viện ảnh. | Loại bỏ `capture="environment"` để trình duyệt hiển thị hộp thoại cho phép chọn cả Camera và Thư viện ảnh. |
| **UC_INT_02_TC10** | Nhập ghi chú quá dài | **Fail** | Hệ thống chưa có validate trường ghi chú. | Component `ImageUpload.tsx` chưa có ô nhập ghi chú (note) và API chưa kiểm tra giới hạn độ dài ký tự của mô tả gửi lên. | Bổ sung ô nhập ghi chú với thuộc tính `maxLength={500}`, thêm validate server-side chặn ghi chú vượt quá 500 ký tự. |
| **UC_INT_02_TC14** | Hủy chọn ảnh từ thư viện | **Fail** | Chưa xây dựng tính năng upload ảnh từ thư viện nên không kiểm tra được hủy. | Tương tự TC03, do bị khóa chặt ở chế độ camera nên không thể hủy thao tác từ thư viện. | Sửa đổi cơ chế chọn file (TC03) sẽ tự động giải quyết luồng hủy chọn ảnh từ thư viện một cách tự nhiên. |
| **UC_INT_02_TC15** | Kiểm tra preview ảnh sau khi thêm | **Fail** | Chưa xây dựng tính năng preview ảnh. | Component chỉ hiển thị thumbnail thu nhỏ kích thước cố định, chưa có tính năng bấm vào để xem ảnh lớn (modal lightbox). | Tích hợp Modal Lightbox phóng to ảnh khi người dùng bấm vào hình thu nhỏ, hỗ trợ xem đầy đủ mô tả/ghi chú. |
| **UC_INT_02_TC16** | Xóa ảnh đã thêm trước khi lưu | **Fail** | Chưa xây dựng upload từ thư viện -> không có nút xóa. | Người dùng hiểu nhầm do không thấy tùy chọn thư viện, và nút xóa (dấu `×`) hiện tại chưa nổi bật trên thiết bị di động. | Nâng cấp nút xóa ảnh (nút `×` màu đỏ ở góc ảnh) to hơn, dễ tương tác trên màn hình cảm ứng, và hiển thị rõ ràng. |

---

## 2. KẾ HOẠCH KHẮC PHỤC CHI TIẾT (GIẢI PHÁP KỸ THUẬT)

### 2.1. Khắc phục việc chọn ảnh từ thư viện & Hủy chọn (TC03 & TC14)
*   **Tệp tin cần sửa**: [ImageUpload.tsx](file:///d:/wms-vinhgiang_repo/src/components/shared/ImageUpload.tsx)
*   **Chi tiết lỗi**: Thuộc tính `capture="environment"` trên thẻ input file:
    ```tsx
    <input ref={fileRef} type="file" accept={ACCEPT} capture="environment" ... />
    ```
    Thuộc tính này ép hệ điều hành di động (iOS/Android) bỏ qua việc chọn ảnh từ Album/Gallery và bắt buộc bật Camera sau.
*   **Giải pháp**: Loại bỏ thuộc tính `capture="environment"` để khôi phục hành vi mặc định của hệ điều hành. Khi người dùng bấm "Thêm ảnh", thiết bị sẽ hiển thị menu cho phép họ **"Chụp ảnh mới"** hoặc **"Chọn từ Thư viện (Tệp/Ảnh)"** một cách tự nhiên.

---

### 2.2. Bổ sung ghi chú ảnh & Validate độ dài (TC09 & TC10)
*   **Tệp tin cần sửa**: 
    1. [ImageUpload.tsx](file:///d:/wms-vinhgiang_repo/src/components/shared/ImageUpload.tsx)
    2. [route.ts (api/attachments)](file:///d:/wms-vinhgiang_repo/src/app/api/attachments/route.ts)
*   **Giải pháp**:
    *   **Frontend**:
        1. Thêm state lưu trữ mô tả tạm thời: `const [pendingNote, setPendingNote] = useState("");`.
        2. Hiển thị một ô nhập mô tả ngắn (`textarea`) ở ngay dưới/trên danh sách ảnh:
           ```tsx
           <textarea
             value={pendingNote}
             onChange={(e) => setPendingNote(e.target.value)}
             maxLength={500}
             placeholder="Nhập mô tả cho ảnh tiếp theo tải lên (tối đa 500 ký tự)..."
             className="w-full text-xs border rounded-lg p-2 bg-surface"
           />
           ```
        3. Trong hàm `handleSelect`, đính kèm ghi chú vào body tải lên:
           ```typescript
           if (pendingNote.trim()) fd.append("note", pendingNote.trim());
           ```
        4. Reset ghi chú về rỗng sau khi tải lên thành công.
    *   **Backend API**:
        Trong `src/app/api/attachments/route.ts`, bổ sung kiểm tra độ dài chuỗi ký tự nhận được:
        ```typescript
        const note = formData.get("note") as string | null;
        if (note && note.length > 500) {
          return NextResponse.json({ success: false, error: "Mô tả ảnh không được vượt quá 500 ký tự." }, { status: 400 });
        }
        ```

---

### 2.3. Tính năng xem ảnh lớn (Preview Lightbox) (TC15)
*   **Tệp tin cần sửa**: [ImageUpload.tsx](file:///d:/wms-vinhgiang_repo/src/components/shared/ImageUpload.tsx)
*   **Giải pháp**:
    *   Thêm state kiểm soát hiển thị ảnh phóng to:
        ```typescript
        const [previewUrl, setPreviewUrl] = useState<string | null>(null);
        const [previewNote, setPreviewNote] = useState<string | null>(null);
        ```
    *   Cho phép người dùng bấm vào hình ảnh để xem trước:
        ```tsx
        <img
          src={url}
          onClick={() => { setPreviewUrl(url); setPreviewNote(f.note); }}
          className="cursor-pointer hover:scale-105 transition-transform"
        />
        ```
    *   Hiển thị một Modal Overlay (lớp phủ toàn màn hình) chứa ảnh lớn, ghi chú đi kèm và nút **"Đóng"**:
        ```tsx
        {previewUrl && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
            <img src={previewUrl} className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl" />
            {previewNote && <p className="text-white text-sm mt-3 bg-black/40 px-3 py-1.5 rounded-lg">{previewNote}</p>}
            <button className="mt-4 px-6 py-2 bg-white text-black font-semibold rounded-lg">Đóng</button>
          </div>
        )}
        ```

---

### 2.4. Tăng cường nút Xóa ảnh (TC16)
*   **Tệp tin cần sửa**: [ImageUpload.tsx](file:///d:/wms-vinhgiang_repo/src/components/shared/ImageUpload.tsx)
*   **Giải pháp**:
    *   Nút xóa ảnh (dấu `×` màu đỏ) hiện tại có kích thước `w-6 h-6`. Trên màn hình di động, kích thước này hơi nhỏ và khó bấm trúng bằng ngón tay.
    *   Nâng cấp kích thước nút xóa lên `w-8 h-8`, tăng cỡ chữ hoặc đổi sang icon thùng rác (`delete`) từ Material Symbols để người dùng dễ nhận biết và tương tác.
    *   Đồng thời, hiển thị nút xóa rõ ràng hơn mà không cần hover (vì thiết bị di động không hỗ trợ hover).
