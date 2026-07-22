/**
 * Nội dung HƯỚNG DẪN SỬ DỤNG chi tiết cho từng màn hình admin (WMS Vĩnh Giang).
 * Viết theo kiểu "cầm tay chỉ việc" — người chưa từng dùng phần mềm cũng làm theo được.
 *
 * - Hiển thị qua nút "Trợ giúp" (icon ?) trên thanh tiêu đề — popup theo màn đang xem.
 * - Khớp theo prefix DÀI NHẤT: route con tự lấy hướng dẫn riêng, không có thì lấy của màn cha.
 * - Thêm/sửa: chỉ cần sửa 1 mục trong mảng GUIDES bên dưới.
 */

export type GuideSection = {
  heading: string;
  role?: string; // nhãn vai trò: "Kế toán", "Thủ kho"...
  steps: string[]; // mỗi phần tử = 1 bước (đánh số tự động khi hiển thị)
};

export type HelpGuide = {
  title: string;
  subtitle?: string;
  /** Giải thích bằng lời thường: khi nào thì mở màn này ra dùng */
  whenToUse?: string;
  /** Giải thích thuật ngữ cho người mới */
  concepts?: { term: string; explain: string }[];
  sections: GuideSection[];
  /** Lưu ý / lỗi thường gặp (hiện ô đỏ) */
  notes?: string[];
  /** Mẹo (hiện ô vàng) */
  tips?: string[];
};

type Entry = { prefix: string; guide: HelpGuide };

const GUIDES: Entry[] = [
  // ══════════════════════════════ TỔNG QUAN ══════════════════════════════
  {
    prefix: "/",
    guide: {
      title: "Trang Tổng quan (Màn hình chính)",
      subtitle: "Nơi xem nhanh tình hình kho và đi tới các công việc khác.",
      whenToUse:
        "Đây là màn hình đầu tiên khi bạn đăng nhập. Mở ra để xem nhanh: kho còn bao nhiêu hàng, hôm nay nhập/xuất bao nhiêu, có gì sắp hết hạn cần xử lý. Từ đây bấm vào menu bên trái để sang các công việc khác.",
      concepts: [
        { term: "Tồn kho", explain: "Số lượng hàng đang thực có trong kho ngay lúc này." },
        { term: "Tỷ lệ lấp đầy", explain: "Kho đang dùng bao nhiêu phần trăm số ô chứa hàng. Vd 9.6% là còn rất trống." },
        { term: "HSD", explain: "Hạn Sử Dụng của hàng. Hệ thống cảnh báo hàng gần hết hạn để xuất trước." },
      ],
      sections: [
        {
          heading: "Bạn nhìn thấy gì trên màn này",
          steps: [
            "Các ô số lớn (gọi là 'thẻ KPI') ở trên cùng: tổng tồn kho, số hàng nhập/xuất trong kỳ, tỷ lệ lấp đầy kho.",
            "Ô cảnh báo: hàng sắp hết hạn hoặc tồn đang xuống thấp — cần để ý xử lý.",
            "Sơ đồ kho ở dưới: hình các ô vuông tượng trưng cho vị trí thật trong kho. Màu xanh = đang chứa hàng, viền nét đứt = ô trống, đỏ = đầy.",
          ],
        },
        {
          heading: "Hiểu toàn bộ quy trình kho (rất quan trọng cho người mới)",
          steps: [
            "NHẬP HÀNG: Kế toán lập phiếu nhập báo 'sắp có hàng về' → Thủ kho nhận hàng thật, xếp lên pallet, quét mã → Xe nâng đưa pallet vào vị trí trong kho → Kế toán chốt phiếu để cộng vào tồn.",
            "XUẤT HÀNG: Kế toán/Quản lý tạo phiếu yêu cầu xuất → Xe nâng lấy pallet ra khu chờ xuất → xác nhận xuất để trừ tồn.",
            "KIỂM KÊ: Quản lý mở 1 đợt kiểm kê → người Kiểm kê đi đếm hàng thật bằng điện thoại → nếu lệch so với hệ thống thì điều chỉnh lại cho khớp.",
          ],
        },
      ],
      tips: ["Cần tìm nhanh 1 pallet / phiếu / mã hàng? Gõ vào ô tìm kiếm trên cùng (hoặc bấm Ctrl+K)."],
    },
  },
  {
    prefix: "/dashboard/manager",
    guide: {
      title: "Bảng theo dõi của Quản lý",
      subtitle: "Xem tổng hợp tình hình vận hành để ra quyết định.",
      whenToUse: "Dành cho Quản lý mở ra hằng ngày để nắm: sản lượng nhập/xuất, hàng sắp hết hạn, mặt hàng tồn thấp cần nhập thêm.",
      sections: [
        {
          heading: "Cách dùng",
          role: "Quản lý",
          steps: [
            "Đọc các thẻ số liệu để biết tình hình chung.",
            "Thấy dòng nào bất thường (vd hàng cận hạn nhiều) → bấm vào để đi tới chi tiết và xử lý.",
          ],
        },
      ],
    },
  },

  // ══════════════════════════════ NHẬP KHO ══════════════════════════════
  {
    prefix: "/inbound/new",
    guide: {
      title: "Lập phiếu nhập hàng (PHN)",
      subtitle: "Khai báo trước với kho rằng 'sắp có hàng này về'.",
      whenToUse:
        "Khi nhà cung cấp chuẩn bị giao hàng tới kho. Bạn (Kế toán) lập phiếu này TRƯỚC để Thủ kho biết sắp nhận hàng gì, số lượng bao nhiêu mà chuẩn bị.",
      concepts: [
        { term: "PHN", explain: "Phiếu Hàng Nhập — tờ khai 'sắp có hàng về'. Mã tự sinh dạng PHN-2026-0001, bạn không cần tự đặt." },
        { term: "Mã hàng (SKU)", explain: "Mã riêng của từng loại sản phẩm. Vd Coca lon 330ml có 1 mã, Pepsi chai 1.5L có 1 mã khác." },
        { term: "Nhà cung cấp (NCC)", explain: "Công ty bán/giao hàng cho kho." },
      ],
      sections: [
        {
          heading: "Cách lập 1 phiếu nhập mới",
          role: "Kế toán",
          steps: [
            "Ở menu bên trái bấm 'Phiếu nhập', rồi bấm nút màu xanh đậm '+ Lập phiếu mới' (góc trên bên phải).",
            "Ở ô 'Nhà cung cấp': bấm vào và chọn tên công ty giao hàng. KHÔNG thấy tên trong danh sách? → mở màn 'Nhà cung cấp' tạo trước rồi quay lại.",
            "Bấm '+ Thêm dòng hàng'. Mỗi dòng tương ứng 1 loại hàng.",
            "Trong dòng đó: chọn Mã hàng (gõ tên hoặc mã để tìm), điền Số lượng (số thùng dự kiến nhận), điền Lô và Hạn sử dụng nếu mặt hàng đó có quản lý lô/hạn.",
            "Còn loại hàng khác trong chuyến giao? Bấm '+ Thêm dòng hàng' lần nữa và làm lại.",
            "Soát lại cho đúng. Chưa chắc chắn → bấm 'Lưu nháp' (sửa sau). Chắc rồi → bấm 'Gửi phiếu'.",
            "Sau khi gửi, phiếu chuyển trạng thái 'Chờ tiếp nhận' — Thủ kho sẽ thấy và bắt đầu nhận hàng. Phần việc của bạn tạm xong.",
          ],
        },
      ],
      notes: [
        "Số lượng ở đây là số ĐẶT/DỰ KIẾN. Số thực nhận sẽ do Thủ kho ghi lại khi hàng tới (có thể lệch).",
        "Đã 'Gửi phiếu' rồi mới phát hiện sai? Phải nhờ Thủ kho chưa nhận để sửa, hoặc hủy phiếu — vì vậy hãy kiểm tra kỹ trước khi gửi.",
      ],
      tips: ["Nhập nhiều mặt hàng cùng lúc? Dùng nút 'Import Excel' để khỏi gõ tay từng dòng."],
    },
  },
  {
    prefix: "/inbound/import",
    guide: {
      title: "Nhập phiếu bằng file Excel",
      subtitle: "Tạo phiếu nhập nhiều dòng cùng lúc từ 1 file Excel.",
      whenToUse: "Khi chuyến hàng có RẤT NHIỀU mặt hàng, gõ tay từng dòng sẽ lâu. Bạn điền sẵn vào file Excel rồi tải lên một lần.",
      sections: [
        {
          heading: "Cách làm",
          role: "Kế toán",
          steps: [
            "Bấm nút 'Tải file mẫu' để lấy file Excel chuẩn về máy.",
            "Mở file mẫu, điền dữ liệu theo đúng các cột có sẵn (mã hàng, số lượng, lô, hạn dùng...). KHÔNG đổi tên/thứ tự cột.",
            "Quay lại màn này, bấm 'Chọn file' và chọn file Excel vừa điền.",
            "Hệ thống đọc file và hiện bảng XEM TRƯỚC. Dòng nào bị tô cảnh báo (mã hàng lạ, sai định dạng) thì sửa lại trong file rồi tải lên lại.",
            "Khi tất cả dòng đã đúng → bấm 'Xác nhận' để hệ thống tạo phiếu nhập từ dữ liệu đó.",
          ],
        },
      ],
      notes: ["Sai 1 cột hoặc để trống ô bắt buộc là dòng đó sẽ báo lỗi — sửa trong Excel chứ không sửa trên web."],
    },
  },
  {
    prefix: "/inbound/temp",
    guide: {
      title: "Phiếu nhập tạm (PNT)",
      subtitle: "Hàng về sớm/bất ngờ, chưa có phiếu chính thức — ghi tạm trước.",
      whenToUse: "Khi hàng đã tới kho nhưng CHƯA kịp lập phiếu nhập chính thức (vd hàng về sớm, hàng trả lại không báo trước). Ghi tạm để không thất lạc, rồi chuẩn hóa sau.",
      sections: [
        {
          heading: "Luồng xử lý",
          role: "Kế toán / Thủ kho",
          steps: [
            "Ghi nhận tạm: nhập nhanh hàng gì, bao nhiêu, từ đâu tới.",
            "Sau đó bấm 'Chuẩn hóa': gắn với nhà cung cấp và mã hàng thật → hệ thống tạo phiếu nhập chính thức (PHN) từ phiếu tạm này.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/inbound/[id]",
    guide: {
      title: "Nhận hàng & Chốt phiếu nhập",
      subtitle: "Xem chi tiết 1 phiếu, nhận hàng thực tế và chốt để cộng tồn.",
      whenToUse: "Mở ra khi cần xử lý 1 phiếu nhập cụ thể: Thủ kho nhận hàng thật, hoặc Kế toán đối chiếu và chốt.",
      sections: [
        {
          heading: "Bước 1 — Nhận hàng thực tế",
          role: "Thủ kho",
          steps: [
            "Mở phiếu, bấm 'Bắt đầu nhận hàng' — phiếu chuyển sang 'Đang nhập'.",
            "Tạo pallet (xem hướng dẫn màn Pallet), quét hoặc nhập mã từng mặt hàng, ghi SỐ LƯỢNG THỰC NHẬN (đếm tay thực tế).",
            "Báo Xe nâng đưa pallet vào vị trí lưu kho.",
          ],
        },
        {
          heading: "Bước 2 — Đối chiếu & chốt",
          role: "Kế toán",
          steps: [
            "So sánh số đặt (lúc lập phiếu) và số thực nhận (Thủ kho ghi).",
            "Lệch nhau? Ghi lý do (vd NCC giao thiếu) rồi xử lý chênh lệch.",
            "Bấm 'Chốt phiếu' — lúc này tồn kho mới được CỘNG vào hệ thống.",
          ],
        },
      ],
      notes: ["Tồn kho chỉ tăng SAU KHI Kế toán chốt phiếu, không phải lúc Thủ kho vừa nhận."],
    },
  },
  {
    prefix: "/inbound-adhoc",
    guide: {
      title: "Nhập hàng phát sinh",
      subtitle: "Nhập nhanh không qua phiếu yêu cầu (hàng trả lại, phát sinh ngoài kế hoạch).",
      whenToUse: "Khi cần nhập hàng mà không có phiếu đặt trước — vd khách trả hàng, hoặc hàng lẻ phát sinh.",
      sections: [
        {
          heading: "Cách làm",
          role: "Thủ kho / Kế toán",
          steps: [
            "Bấm tạo phiếu nhập phát sinh, chọn nguồn hàng (nhà cung cấp / hàng trả lại / khác).",
            "Thêm các dòng hàng và số lượng, tạo pallet như nhập thường.",
            "Hoàn tất để cộng vào tồn kho.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/inbound",
    guide: {
      title: "Danh sách Phiếu nhập",
      subtitle: "Xem và quản lý tất cả phiếu yêu cầu nhập hàng.",
      whenToUse: "Mở ra để xem các phiếu nhập đang ở giai đoạn nào, tìm 1 phiếu cụ thể, hoặc bắt đầu lập phiếu mới.",
      concepts: [
        { term: "Trạng thái phiếu", explain: "Nháp (chưa gửi) → Chờ tiếp nhận → Đang nhập → Đối chiếu → Đã chốt (xong)." },
      ],
      sections: [
        {
          heading: "Cách dùng",
          steps: [
            "Dùng các nút lọc theo trạng thái để xem nhóm phiếu cần xử lý.",
            "Bấm '+ Lập phiếu mới' để tạo phiếu.",
            "Bấm vào 1 dòng phiếu để mở chi tiết và xử lý tiếp.",
          ],
        },
      ],
    },
  },

  // ══════════════════════════════ PALLET ══════════════════════════════
  {
    prefix: "/pallets/[id]",
    guide: {
      title: "Chi tiết 1 Pallet",
      subtitle: "Xem hàng trên pallet, quét thêm mã, và xác nhận pallet.",
      whenToUse: "Khi đang xếp hàng lên 1 pallet và cần thêm mã hàng vào, hoặc xác nhận pallet đã xếp xong.",
      concepts: [
        { term: "Pallet", explain: "Tấm kê để xếp hàng thành chồng, dễ dùng xe nâng di chuyển. Mỗi pallet có 1 mã (vd PL260601.010)." },
        { term: "Đang thêm hàng", explain: "Trạng thái pallet còn mở, cho phép thêm/sửa dòng hàng. Sau khi xác nhận sẽ khóa lại." },
      ],
      sections: [
        {
          heading: "Cách thêm hàng & xác nhận",
          role: "Thủ kho",
          steps: [
            "Pallet phải ở trạng thái 'Đang thêm hàng'. Bấm nút 'Quét mã' (biểu tượng máy quét).",
            "Camera bật lên → đưa mã vạch/QR trên thùng hàng vào khung. Quét xong hệ thống tự thêm dòng hàng đó.",
            "Không quét được? Bấm 'Nhập tay' và gõ mã, hoặc 'Ảnh' để chọn ảnh có chứa mã.",
            "Kiểm tra số lượng từng dòng cho đúng với hàng thực xếp.",
            "Xếp xong → bấm 'Xác nhận pallet'. Pallet khóa lại, sẵn sàng để Xe nâng đưa vào vị trí.",
          ],
        },
      ],
      notes: ["Tính năng Quét mã CHỈ chạy trên ĐIỆN THOẠI mở bằng tên miền HTTPS hợp lệ (vd khohangvinhgiang.io.vn) và phải bấm 'Cho phép' khi trình duyệt xin quyền camera."],
    },
  },
  {
    prefix: "/pallets/qr-print",
    guide: {
      title: "In tem QR cho Pallet",
      subtitle: "In mã QR để dán lên pallet, sau này quét cho nhanh.",
      whenToUse: "Khi muốn dán nhãn QR lên pallet thật để Xe nâng/Thủ kho quét nhận diện.",
      sections: [{ heading: "Cách làm", steps: ["Chọn (tick) các pallet cần in → bấm 'In' → in ra giấy → dán đúng pallet tương ứng."] }],
    },
  },
  {
    prefix: "/pallets",
    guide: {
      title: "Quản lý Pallet",
      subtitle: "Tạo pallet mới và theo dõi các pallet trong kho.",
      whenToUse: "Khi Thủ kho bắt đầu xếp 1 chồng hàng và cần tạo 1 pallet để gắn hàng vào.",
      sections: [
        {
          heading: "Cách tạo 1 pallet",
          role: "Thủ kho",
          steps: [
            "Bấm nút 'Tạo pallet'. Một cửa sổ hiện ra; mã pallet TỰ SINH (dạng PLYYMMDD.STT), bạn không cần đặt.",
            "(Nên làm) Ở ô 'Liên kết phiếu nhập', chọn phiếu nhập tương ứng → hệ thống TỰ sao chép sẵn các dòng hàng và nhà cung cấp vào pallet, đỡ phải gõ lại.",
            "Bấm 'Tạo pallet'. Pallet mới ở trạng thái 'Đang thêm hàng'.",
            "Mở pallet vừa tạo → quét/nhập mã hàng (xem hướng dẫn 'Chi tiết Pallet').",
          ],
        },
      ],
      notes: [
        "Ô 'Liên kết phiếu nhập' chỉ hiện những phiếu đang chờ nhận và CHƯA có pallet nào. Nếu trống nghĩa là chưa có phiếu nào đủ điều kiện — hãy gửi/duyệt 1 phiếu nhập trước.",
        "Liên kết phiếu nhập là TÙY CHỌN — vẫn tạo được pallet không liên kết, nhưng nên liên kết để truy vết dễ hơn.",
      ],
    },
  },

  // ══════════════════════════════ XUẤT KHO ══════════════════════════════
  {
    prefix: "/outbound/requests/new",
    guide: {
      title: "Tạo phiếu yêu cầu xuất (PYX)",
      subtitle: "Lập yêu cầu lấy hàng ra khỏi kho cho khách/đơn hàng.",
      whenToUse: "Khi có đơn hàng cần xuất. Bạn lập phiếu này để báo kho lấy hàng nào, bao nhiêu.",
      concepts: [
        { term: "PYX", explain: "Phiếu Yêu cầu Xuất — tờ khai 'cần lấy hàng này ra khỏi kho'." },
        { term: "FEFO", explain: "Nguyên tắc 'hết hạn trước thì xuất trước' (First Expired First Out). Hệ thống tự gợi ý lấy hàng cũ/cận hạn trước để đỡ hư hỏng." },
      ],
      sections: [
        {
          heading: "Cách tạo phiếu xuất",
          role: "Kế toán / Quản lý",
          steps: [
            "Thêm từng dòng hàng cần xuất: chọn mã hàng và nhập số lượng.",
            "Hệ thống tự gợi ý pallet/lô nên lấy theo nguyên tắc FEFO (cận hạn trước).",
            "Kiểm tra rồi bấm 'Lưu' — phiếu chuyển sang khâu lấy hàng (Xe nâng).",
          ],
        },
      ],
    },
  },
  {
    prefix: "/outbound/requests",
    guide: {
      title: "Phiếu yêu cầu xuất (PYX)",
      subtitle: "Theo dõi và xử lý các phiếu xuất hàng.",
      whenToUse: "Xem danh sách phiếu xuất, tạo phiếu mới, hoặc theo dõi tiến độ lấy/giao hàng.",
      sections: [
        {
          heading: "Toàn bộ luồng xuất hàng",
          steps: [
            "Tạo phiếu yêu cầu xuất (Kế toán/Quản lý).",
            "Bấm 'Bắt đầu lấy hàng' → Xe nâng đưa các pallet ra khu chờ xuất.",
            "Hàng lên xe xong → bấm 'Xác nhận xuất'. Lúc này tồn kho mới được TRỪ.",
          ],
        },
      ],
      notes: ["Tồn chỉ giảm khi bấm 'Xác nhận xuất', không phải lúc mới tạo phiếu."],
    },
  },
  {
    prefix: "/outbound/rebalance",
    guide: {
      title: "Cân lại tồn theo file xuất",
      subtitle: "Đối chiếu file xuất thực tế và chỉnh tồn cho khớp.",
      whenToUse: "Khi việc xuất hàng được làm bên ngoài (vd file bán hàng) và bạn cần đồng bộ lại tồn kho theo file đó.",
      sections: [
        {
          heading: "Cách làm",
          role: "Kế toán",
          steps: [
            "Tải file xuất lên — hệ thống tự khớp với pallet/lô trong kho.",
            "Xem bảng kết quả: dòng Khớp / Vượt (file nhiều hơn tồn) / Hết (đã xuất sạch).",
            "Bấm 'Áp dụng' để cập nhật tồn theo file.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/outbound/reorder",
    guide: {
      title: "Đề xuất nhập bổ sung",
      subtitle: "Gợi ý mặt hàng nên nhập thêm dựa trên tồn và sức bán.",
      whenToUse: "Khi Quản lý lên kế hoạch nhập hàng, xem mặt hàng nào sắp hết để đặt thêm.",
      sections: [{ heading: "Cách dùng", role: "Quản lý", steps: ["Xem danh sách SKU tồn thấp / bán chạy để quyết định nhập thêm bao nhiêu."] }],
    },
  },
  {
    prefix: "/outbound/report",
    guide: {
      title: "Báo cáo xuất kho",
      subtitle: "Thống kê đã xuất bao nhiêu, mặt hàng nào, trong khoảng thời gian nào.",
      whenToUse: "Khi cần số liệu xuất hàng để báo cáo hoặc đối chiếu.",
      sections: [{ heading: "Cách dùng", steps: ["Chọn khoảng thời gian (từ ngày — đến ngày) → xem bảng → bấm 'Xuất Excel' nếu cần lưu/gửi."] }],
    },
  },
  {
    prefix: "/outbound/turnover",
    guide: {
      title: "Vòng quay tồn kho",
      subtitle: "Xem hàng nào bán nhanh, hàng nào tồn lâu (ế).",
      whenToUse: "Khi Quản lý muốn biết mặt hàng nào luân chuyển nhanh/chậm để tối ưu nhập và sắp xếp kho.",
      sections: [{ heading: "Cách dùng", role: "Quản lý", steps: ["Xem SKU quay vòng nhanh (nên trữ nhiều) và quay chậm (nên giảm nhập)."] }],
    },
  },
  {
    prefix: "/outbound",
    guide: {
      title: "Xuất kho",
      subtitle: "Trung tâm các công việc liên quan xuất hàng.",
      whenToUse: "Điểm khởi đầu cho mọi nghiệp vụ xuất: tạo phiếu xuất, cân lại tồn, đề xuất nhập, báo cáo, vòng quay.",
      sections: [{ heading: "Gồm các mục", steps: ["Phiếu yêu cầu xuất (PYX), Cân lại tồn, Đề xuất nhập, Báo cáo xuất, Vòng quay tồn — bấm từng mục ở menu để vào."] }],
    },
  },

  // ══════════════════════════════ TỒN KHO ══════════════════════════════
  {
    prefix: "/inventory/adjustments",
    guide: {
      title: "Phiếu điều chỉnh tồn",
      subtitle: "Sửa số tồn khi thực tế khác hệ thống (hỏng, mất, thừa, sau kiểm kê).",
      whenToUse: "Khi phát hiện số trên hệ thống KHÔNG khớp hàng thật: hàng bị vỡ/hỏng/mất, hoặc đếm kiểm kê thấy lệch.",
      sections: [
        {
          heading: "Cách tạo & duyệt 1 phiếu điều chỉnh",
          steps: [
            "Bấm 'Tạo phiếu điều chỉnh'. Chọn loại: Giảm tồn (hỏng/mất) hoặc Tăng tồn (thừa).",
            "Chọn pallet/mã hàng cần chỉnh, nhập số lượng chênh và lý do rõ ràng.",
            "Lưu phiếu — lúc này phiếu ở trạng thái 'Chờ duyệt', TỒN CHƯA ĐỔI.",
            "Quản lý mở phiếu, kiểm tra và bấm 'Duyệt'. CHỈ KHI DUYỆT thì tồn kho mới thay đổi.",
          ],
        },
      ],
      notes: [
        "Tồn chỉ thay đổi khi Quản lý DUYỆT. Mới tạo phiếu thì chưa ảnh hưởng tồn.",
        "Phải ghi lý do trung thực — phiếu này được lưu vào nhật ký để truy vết sau này.",
      ],
    },
  },
  {
    prefix: "/inventory/alerts",
    guide: {
      title: "Cảnh báo tồn kho",
      subtitle: "Hàng sắp hết hạn và hàng tồn xuống thấp.",
      whenToUse: "Mở thường xuyên để bắt sớm: hàng nào sắp hết hạn (cần xuất gấp) và hàng nào sắp hết (cần nhập thêm).",
      sections: [
        {
          heading: "Cách dùng",
          steps: [
            "Xem nhóm 'Cận hạn': lọc theo ≤7 ngày (gấp), ≤30 ngày để ưu tiên xuất trước.",
            "Xem nhóm 'Tồn thấp': mặt hàng dưới mức tối thiểu → lên kế hoạch nhập.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/inventory/by-location",
    guide: {
      title: "Tồn theo Vị trí",
      subtitle: "Xem mỗi ô/kệ trong kho đang chứa gì.",
      whenToUse: "Khi muốn biết 1 vị trí cụ thể đang để pallet/hàng nào, hoặc kiểm tra vị trí trống.",
      sections: [{ heading: "Cách dùng", steps: ["Bấm vào 1 vị trí trên danh sách/sơ đồ để xem chi tiết pallet và lô đang chứa ở đó."] }],
    },
  },
  {
    prefix: "/inventory/by-pallet",
    guide: {
      title: "Tồn theo Pallet",
      subtitle: "Tra cứu chi tiết từng pallet.",
      whenToUse: "Khi cần xem 1 pallet cụ thể đang chứa hàng gì, lô nào, hạn dùng, đặt ở đâu.",
      sections: [{ heading: "Cách dùng", steps: ["Gõ mã pallet để tìm → xem các dòng hàng, lô, HSD và vị trí."] }],
    },
  },
  {
    prefix: "/inventory/by-lot",
    guide: {
      title: "Tồn theo Lô",
      subtitle: "Quản lý hàng theo số lô sản xuất / hạn dùng.",
      whenToUse: "Khi cần truy theo lô (vd thu hồi 1 lô, hoặc theo dõi lô cận date).",
      sections: [{ heading: "Cách dùng", steps: ["Lọc theo số lô hoặc HSD để xem hàng thuộc lô đó đang ở đâu, còn bao nhiêu."] }],
    },
  },
  {
    prefix: "/inventory/by-sku",
    guide: {
      title: "Tồn theo SKU — các vị trí",
      subtitle: "Một mã hàng đang nằm rải ở những vị trí nào.",
      whenToUse: "Khi cần gom 1 mặt hàng đang để nhiều nơi, hoặc tìm chỗ lấy gần nhất.",
      sections: [{ heading: "Cách dùng", steps: ["Xem tất cả vị trí đang chứa mã hàng này để điều phối lấy/gom hàng."] }],
    },
  },
  {
    prefix: "/inventory",
    guide: {
      title: "Tồn kho",
      subtitle: "Tra cứu hàng đang có trong kho theo nhiều cách.",
      whenToUse: "Khi cần biết kho đang còn gì, bao nhiêu, để ở đâu.",
      sections: [
        {
          heading: "Các cách xem tồn",
          steps: [
            "Theo SKU (mã hàng), theo Vị trí, theo Pallet, theo Lô.",
            "Xem Cảnh báo (cận hạn / tồn thấp).",
            "Tạo Phiếu điều chỉnh khi số liệu lệch thực tế.",
          ],
        },
      ],
    },
  },

  // ══════════════════════════════ DỮ LIỆU NỀN ══════════════════════════════
  {
    prefix: "/item-codes",
    guide: {
      title: "Mã hàng (chuẩn hóa SKU)",
      subtitle: "Khai báo và làm sạch mã hàng dùng chung toàn hệ thống.",
      whenToUse: "Khi có mã hàng mới chưa khai báo, hoặc các mã quét về bị lộn xộn cần gom về 1 mã chuẩn.",
      concepts: [
        { term: "Chuẩn hóa", explain: "Gom nhiều mã/biến thể lộn xộn của cùng 1 sản phẩm về 1 mã chính thức để quản lý nhất quán." },
      ],
      sections: [
        {
          heading: "Cách dùng",
          role: "Kế toán",
          steps: [
            "Tạo mã hàng mới, hoặc mở mã đang 'Chờ xử lý' để chuẩn hóa.",
            "Gắn mã với sản phẩm, đơn vị tính, khối lượng mỗi thùng.",
            "Lưu lại — từ đó mã này dùng được khi lập phiếu nhập/xuất.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/master-data",
    guide: {
      title: "Sản phẩm (dữ liệu nền)",
      subtitle: "Danh mục tất cả sản phẩm: tên, nhóm, đơn vị, quản lý lô/HSD.",
      whenToUse: "Khi cần thêm sản phẩm mới vào hệ thống, hoặc sửa thông tin sản phẩm (tên, nhóm, có quản lý hạn dùng hay không).",
      sections: [
        {
          heading: "Cách thêm sản phẩm",
          steps: [
            "Bấm 'Thêm sản phẩm'. Điền tên, chọn nhóm, đơn vị tính.",
            "Bật 'Quản lý lô' và 'Quản lý hạn sử dụng' nếu mặt hàng có lô/date (vd thực phẩm).",
            "Lưu lại. Có nhiều sản phẩm? Dùng 'Import Excel' để tạo hàng loạt.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/product-groups",
    guide: {
      title: "Nhóm sản phẩm",
      subtitle: "Phân loại sản phẩm theo nhóm để dễ quản lý và báo cáo.",
      whenToUse: "Khi muốn gom sản phẩm thành nhóm (vd Nước giải khát, Bánh kẹo).",
      sections: [{ heading: "Cách dùng", steps: ["Bấm 'Thêm nhóm', đặt tên nhóm, lưu. Khi tạo sản phẩm sẽ chọn được nhóm này."] }],
    },
  },
  {
    prefix: "/units",
    guide: {
      title: "Đơn vị tính",
      subtitle: "Khai báo đơn vị đếm hàng (thùng, lốc, chai...).",
      whenToUse: "Khi cần thêm đơn vị tính mới để dùng khi khai báo sản phẩm.",
      sections: [{ heading: "Cách dùng", steps: ["Bấm 'Thêm', gõ tên đơn vị (vd Thùng), lưu lại."] }],
    },
  },
  {
    prefix: "/suppliers",
    guide: {
      title: "Nhà cung cấp",
      subtitle: "Danh sách công ty giao hàng cho kho.",
      whenToUse: "Khi có nhà cung cấp mới — phải tạo ở đây TRƯỚC thì khi lập phiếu nhập mới chọn được tên họ.",
      sections: [
        {
          heading: "Cách thêm nhà cung cấp",
          steps: ["Bấm 'Thêm nhà cung cấp'. Điền tên công ty, mã số thuế, người liên hệ, số điện thoại.", "Lưu lại — từ giờ chọn được tên này khi lập phiếu nhập."],
        },
      ],
    },
  },

  // ══════════════════════════════ VỊ TRÍ KHO ══════════════════════════════
  {
    prefix: "/locations/qr-print",
    guide: {
      title: "In tem QR Vị trí",
      subtitle: "In mã QR cho từng ô/kệ trong kho.",
      whenToUse: "Khi muốn dán nhãn QR tại mỗi vị trí để Xe nâng quét xác nhận đặt đúng chỗ.",
      sections: [{ heading: "Cách làm", steps: ["Chọn các vị trí cần in → bấm 'In' → dán tem đúng kệ/ô."] }],
    },
  },
  {
    prefix: "/locations",
    guide: {
      title: "Vị trí kho (Sơ đồ kho)",
      subtitle: "Khai báo các ô/kệ chứa hàng và theo dõi trạng thái.",
      whenToUse: "Khi thiết lập kho lần đầu (khai báo các vị trí), hoặc khi cần đổi trạng thái 1 vị trí (vd khóa ô đang sửa chữa).",
      concepts: [
        { term: "Mã vị trí", explain: "Dạng Khu-Kệ-Tầng, vd A-03-02 nghĩa là Khu A, Kệ 03, Tầng 02." },
        { term: "Trạng thái ô", explain: "Trống / Đang dùng / Đầy / Khóa sử dụng (không cho để hàng) / Chờ kiểm kê..." },
      ],
      sections: [
        {
          heading: "Cách tạo vị trí",
          steps: [
            "Tạo lẻ: bấm 'Thêm vị trí', điền Khu/Kệ/Tầng → lưu.",
            "Tạo hàng loạt: bấm 'Tạo nhiều', chọn khoảng Kệ từ-đến và Tầng từ-đến → hệ thống sinh tất cả ô cùng lúc.",
            "Đổi trạng thái nhanh: bấm vào 1 ô → chọn trạng thái mới (vd Khóa sử dụng) → lưu.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/movements",
    guide: {
      title: "Lịch sử di chuyển",
      subtitle: "Nhật ký mọi lần xe nâng di chuyển pallet trong kho.",
      whenToUse: "Khi cần tra: pallet nào đã được đưa vào/chuyển/ra khu chờ lúc nào, do ai làm.",
      sections: [{ heading: "Cách dùng", steps: ["Lọc theo thời gian hoặc loại di chuyển (đưa vào vị trí / chuyển / ra khu chờ / hoàn trả) để tra cứu."] }],
    },
  },

  // ══════════════════════════════ KIỂM KÊ ══════════════════════════════
  {
    prefix: "/stock-count/[id]/discrepancy",
    guide: {
      title: "Xử lý chênh lệch kiểm kê",
      subtitle: "Giải quyết phần đếm thực tế lệch so với hệ thống.",
      whenToUse: "Sau khi đếm xong 1 đợt kiểm kê, nếu số đếm KHÁC số trên hệ thống thì xử lý ở đây.",
      sections: [
        {
          heading: "Cách xử lý từng dòng lệch",
          role: "Quản lý",
          steps: [
            "Với mỗi dòng lệch, chọn 1 trong 2: 'Chấp nhận' (tin số đếm → tạo phiếu điều chỉnh tồn) hoặc 'Đếm lại' (nghi sai, cho đếm lại).",
            "Làm xong tất cả dòng → hoàn tất. Các dòng 'Chấp nhận' sẽ sinh phiếu điều chỉnh tương ứng.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/stock-count/new",
    guide: {
      title: "Tạo phiên kiểm kê",
      subtitle: "Mở 1 đợt đi đếm hàng thực tế.",
      whenToUse: "Khi Quản lý muốn kiểm tra hàng thật trong kho có khớp số hệ thống không.",
      sections: [
        {
          heading: "Cách tạo",
          role: "Quản lý",
          steps: [
            "Chọn phạm vi kiểm: theo Vị trí (đếm vài khu) hoặc theo Mã hàng (đếm vài mặt hàng).",
            "Bấm 'Tạo phiên'. Sau đó người Kiểm kê dùng app trên ĐIỆN THOẠI để đi đếm thực tế.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/stock-count",
    guide: {
      title: "Kiểm kê kho",
      subtitle: "Quản lý các đợt kiểm kê và kết quả đếm.",
      whenToUse: "Khi cần đối chiếu hàng thật với hệ thống định kỳ, hoặc khi nghi ngờ thất thoát.",
      sections: [
        {
          heading: "Toàn bộ luồng kiểm kê",
          steps: [
            "Quản lý tạo phiên kiểm kê (chọn phạm vi).",
            "Người Kiểm kê dùng điện thoại đi đếm hàng thực tế tại kho.",
            "Đếm xong, xử lý các dòng lệch → điều chỉnh tồn cho khớp thực tế.",
          ],
        },
      ],
    },
  },

  // ══════════════════════════════ XE NÂNG (điều phối) ══════════════════════════════
  {
    prefix: "/forklift",
    guide: {
      title: "Điều phối Xe nâng",
      subtitle: "Giao việc cho tài xế và theo dõi đội xe nâng.",
      whenToUse: "Khi Quản lý/điều phối cần phân công ai lấy/đưa pallet nào, và xem tài xế đang làm gì.",
      sections: [
        {
          heading: "Cách giao việc",
          role: "Quản lý / Điều phối",
          steps: [
            "Xem bảng 'Danh sách nhiệm vụ': các pallet đang chờ đưa vào vị trí hoặc ra khu chờ xuất.",
            "Bấm nút 'Giao việc' (góc trên), chọn pallet cần xử lý và chọn tài xế xe nâng.",
            "Bấm xác nhận. Tài xế sẽ thấy việc trên điện thoại của họ.",
            "Theo dõi khung 'Đội ngũ tài xế' bên dưới: ai đang làm việc, làm bao nhiêu việc hôm nay, vị trí hoạt động gần nhất.",
          ],
        },
      ],
    },
  },

  // ══════════════════════════════ HỆ THỐNG ══════════════════════════════
  {
    prefix: "/system/users",
    guide: {
      title: "Quản lý người dùng",
      subtitle: "Tạo tài khoản đăng nhập và phân vai trò cho nhân viên.",
      whenToUse: "Khi có nhân viên mới cần tài khoản, hoặc cần khóa tài khoản người đã nghỉ.",
      concepts: [
        { term: "Vai trò", explain: "Quyết định người đó thấy/làm được gì: Quản lý, Kế toán, Thủ kho, Xe nâng, Kiểm kê. Mỗi vai trò có màn hình riêng." },
      ],
      sections: [
        {
          heading: "Cách tạo tài khoản mới",
          role: "Quản trị",
          steps: [
            "Bấm 'Thêm người dùng'. Điền họ tên, email/số điện thoại, đặt mật khẩu.",
            "Chọn Vai trò phù hợp (vd Thủ kho thì dùng app mobile, Kế toán dùng web).",
            "Lưu lại. Đưa tài khoản + mật khẩu cho nhân viên đăng nhập.",
            "Nhân viên nghỉ việc? Mở tài khoản đó và bấm 'Khóa' để chặn đăng nhập.",
          ],
        },
      ],
      notes: ["Mật khẩu KHÔNG được chứa khoảng trắng. Nên đặt mạnh: có chữ HOA, chữ thường, số và ký tự đặc biệt (@ # $ ...)."],
    },
  },
  {
    prefix: "/system/rbac",
    guide: {
      title: "Phân quyền (RBAC)",
      subtitle: "Quy định vai trò nào được vào màn hình / chức năng nào.",
      whenToUse: "Khi muốn mở/khóa quyền truy cập 1 màn cho 1 vai trò (vd không cho Thủ kho xem báo cáo doanh thu).",
      sections: [
        {
          heading: "Cách chỉnh quyền",
          role: "Quản trị",
          steps: [
            "Tìm vai trò và màn hình cần chỉnh trong bảng.",
            "Tick (cho phép) hoặc bỏ tick (cấm) ô tương ứng.",
            "Bấm 'Lưu'. Thay đổi áp dụng từ lần đăng nhập / đồng bộ kế tiếp của người dùng.",
          ],
        },
      ],
    },
  },
  {
    prefix: "/system/config",
    guide: {
      title: "Cấu hình hệ thống",
      subtitle: "Các thiết lập chung của phần mềm.",
      whenToUse: "Khi cần chỉnh tham số vận hành chung (do Quản trị thực hiện).",
      sections: [{ heading: "Cách dùng", role: "Quản trị", steps: ["Chỉnh các giá trị cần thiết rồi bấm 'Lưu'."] }],
    },
  },
  {
    prefix: "/system/mail",
    guide: {
      title: "Cấu hình Email gửi đi",
      subtitle: "Khai báo tài khoản dùng để hệ thống gửi email (OTP, thông báo).",
      whenToUse: "Khi muốn hệ thống gửi được mã OTP/quên mật khẩu qua email tới người dùng.",
      concepts: [
        { term: "SMTP", explain: "Cách gửi email qua 1 tài khoản mail (vd Gmail)." },
        { term: "App Password", explain: "Mật khẩu ứng dụng 16 ký tự do Gmail cấp riêng cho phần mềm — KHÔNG phải mật khẩu đăng nhập Gmail thường." },
      ],
      sections: [
        {
          heading: "Cách khai báo (dùng Gmail)",
          role: "Quản trị",
          steps: [
            "Ở ô nhà cung cấp, chọn SMTP.",
            "Điền: máy chủ smtp.gmail.com, cổng 587, tài khoản là email Gmail, mật khẩu là 'App Password' 16 ký tự (vào Google → Bảo mật → App passwords để tạo).",
            "Bấm 'Kiểm tra kết nối'. Báo thành công nghĩa là dùng được. Sau đó Lưu.",
          ],
        },
      ],
      notes: ["Phải bật Xác minh 2 bước cho Gmail thì mới tạo được App Password."],
    },
  },
  {
    prefix: "/system/audit-log",
    guide: {
      title: "Nhật ký hoạt động",
      subtitle: "Ghi lại ai đã làm gì, lúc nào — để truy vết khi cần.",
      whenToUse: "Khi cần kiểm tra lịch sử thao tác: ai sửa cái gì, ai duyệt phiếu nào, lúc nào.",
      sections: [
        {
          heading: "Cách tra cứu",
          steps: [
            "Dùng các ô lọc: khoảng thời gian, loại hành động, đối tượng, tên người dùng.",
            "Bấm mũi tên ở cuối mỗi dòng để bung xem chi tiết dữ liệu Trước → Sau của thao tác đó.",
          ],
        },
      ],
      notes: ["Một số bản ghi CŨ có cột 'Người thực hiện' để trống vì lúc đó hệ thống chưa ghi được. Các thao tác từ giờ sẽ luôn có đầy đủ tên."],
    },
  },
  {
    prefix: "/system/change-password",
    guide: {
      title: "Đổi mật khẩu",
      subtitle: "Tự đổi mật khẩu đăng nhập của bạn.",
      whenToUse: "Khi muốn đổi mật khẩu (định kỳ hoặc nghi bị lộ).",
      sections: [
        {
          heading: "Các bước",
          steps: [
            "Nhập mật khẩu hiện tại đang dùng.",
            "Nhập mật khẩu mới (đủ mạnh, KHÔNG có khoảng trắng) và nhập lại lần nữa ở ô xác nhận.",
            "Bấm 'Lưu thay đổi'. Hệ thống đăng xuất để bạn đăng nhập lại bằng mật khẩu mới.",
          ],
        },
      ],
      notes: ["Mật khẩu không được chứa khoảng trắng — gõ dấu cách sẽ không nhận."],
    },
  },
  {
    prefix: "/system/profile",
    guide: {
      title: "Hồ sơ cá nhân",
      subtitle: "Xem và cập nhật thông tin tài khoản của bạn.",
      whenToUse: "Khi cần đổi họ tên/liên hệ, xem vai trò của mình hoặc các thiết bị đang đăng nhập.",
      sections: [{ heading: "Cách dùng", steps: ["Sửa thông tin cá nhân rồi lưu; xem danh sách phiên đăng nhập, có thể đăng xuất thiết bị lạ."] }],
    },
  },
  {
    prefix: "/system",
    guide: {
      title: "Hệ thống",
      subtitle: "Khu vực quản trị: người dùng, phân quyền, cấu hình, nhật ký.",
      whenToUse: "Dành cho Quản trị viên thiết lập và giám sát hệ thống.",
      sections: [{ heading: "Gồm các mục", steps: ["Người dùng, Phân quyền (RBAC), Cấu hình, Email, Nhật ký hoạt động, Hồ sơ, Đổi mật khẩu — chọn ở menu."] }],
    },
  },
];

const DEFAULT_GUIDE: HelpGuide = {
  title: "Hướng dẫn sử dụng",
  subtitle: "Màn hình này thuộc hệ thống WMS Vĩnh Giang.",
  whenToUse: "Dùng các nút thao tác và bộ lọc trên màn để làm việc. Nếu cần hướng dẫn cụ thể hơn, hãy báo để được bổ sung.",
  sections: [
    {
      heading: "Gợi ý chung",
      steps: [
        "Các nút hành động chính thường nằm ở góc trên bên phải.",
        "Bộ lọc/tìm kiếm thường ở phía trên danh sách.",
        "Cần tra nhanh mã pallet / phiếu / SKU? Dùng ô tìm kiếm trên cùng (Ctrl+K).",
        "Bấm nút Trợ giúp (?) ở các màn khác để xem hướng dẫn riêng của màn đó.",
      ],
    },
  ],
};

/** Tìm hướng dẫn theo đường dẫn hiện tại — chọn prefix khớp DÀI NHẤT. */
export function getGuideForPath(pathname: string): HelpGuide {
  let path = pathname || "/";
  path = path.replace(/^\/(wms|xenang|thukho|kiemke)(?=\/|$)/, "") || "/";
  if (path.length > 1) path = path.replace(/\/+$/, "");

  let best: Entry | null = null;
  for (const entry of GUIDES) {
    const p = entry.prefix;
    const isMatch =
      p === "/"
        ? path === "/"
        : path === p || path.startsWith(p + "/") || matchesDynamic(path, p);
    if (isMatch && (!best || p.length > best.prefix.length)) best = entry;
  }
  return best?.guide ?? DEFAULT_GUIDE;
}

/** Khớp prefix có đoạn động "[id]" với segment thật (vd /inbound/abc ↔ /inbound/[id]). */
function matchesDynamic(path: string, prefix: string): boolean {
  if (!prefix.includes("[")) return false;
  const pa = path.split("/");
  const pb = prefix.split("/");
  if (pa.length < pb.length) return false;
  for (let i = 0; i < pb.length; i++) {
    if (pb[i].startsWith("[")) continue;
    if (pb[i] !== pa[i]) return false;
  }
  return true;
}
