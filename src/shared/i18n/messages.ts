/**
 * BẢNG CHUỖI GIAO DIỆN — nguồn duy nhất cho mọi text người dùng nhìn thấy.
 *
 * Quy ước:
 * - `MESSAGES_VI` là bản gốc: mọi khoá phải có ở đây, và tiếng Việt là chuẩn.
 * - `MESSAGES_EN` được ràng kiểu theo `MESSAGES_VI` nên gõ sai TÊN KHOÁ sẽ đỏ
 *   typecheck ngay; nhưng THIẾU khoá thì hợp lệ — `t()` tự rơi về tiếng Việt.
 *   Nhờ vậy không bao giờ có khoá thô (`dashboard.title`) lọt ra giao diện.
 * - Nhãn nghiệp vụ do BE trả về (status/severity) KHÔNG nằm ở đây; chúng thuộc
 *   `@/shared/constants/business-labels.ts`.
 *
 * Chỗ nào cần chèn giá trị thì dùng `{tên}` — xem `useT.ts`.
 */

export const MESSAGES_VI = {
  common: {
    loadingData: "Đang tải số liệu…",
    retry: "Thử lại",
    close: "Đóng",
    viewDetail: "Xem chi tiết",
  },

  topbar: {
    language: "Ngôn ngữ",
    languageVietnamese: "Tiếng Việt",
    languageEnglish: "English",
    openMenu: "Mở menu",
  },

  nav: {
    primary: "Điều hướng chính",
    collapse: "Thu gọn thanh điều hướng",
    expand: "Mở rộng thanh điều hướng",
    brand: "Biểu trưng Hoa Nam WMS",
    currentlySelected: "Đang chọn: {label}",
  },

  dashboard: {
    badge: "Tổng quan vận hành",
    title: "Tổng quan kho",
    subtitle:
      "Theo dõi tồn kho, nhập xuất, bảo hành và các vấn đề cần xử lý trên cùng một màn hình.",
    periodCaption:
      "Kỳ đang xem: {from} → {to}. Dữ liệu tổng hợp theo múi giờ Việt Nam.",

    state: {
      noPermissionTitle: "Không có quyền xem báo cáo tổng quan.",
      noPermissionDesc:
        "Vui lòng liên hệ quản trị viên nếu bạn cần quyền truy cập.",
      loadingTitle: "Đang tải số liệu tổng quan…",
      loadingDesc: "Hệ thống đang tổng hợp dữ liệu vận hành.",
      errorForbidden: "Bạn không có quyền xem báo cáo tổng quan.",
      errorInvalidRange: "Khoảng ngày đã chọn không hợp lệ.",
      errorGeneric: "Không tải được số liệu tổng quan.",
      errorSessionExpired: "Phiên đăng nhập không còn hợp lệ.",
      errorNoStale:
        "Hệ thống không hiển thị dữ liệu cũ khi việc tải dữ liệu thất bại.",
    },

    period: {
      today: "Hôm nay",
      week: "Tuần này",
      month: "Tháng này",
      quarter: "Quý này",
      year: "Năm này",
      weekBucket: "Tuần {index}",
      monthBucket: "Th{month}/{year}",
    },

    skuType: {
      all: "Sản phẩm & Linh kiện",
      product: "Sản phẩm",
      component: "Linh kiện",
    },

    kpi: {
      sectionTitle: "Chỉ số vận hành",
      toggleLabel: "Chọn loại hàng cho chỉ số",
      scopePrefix: "Phạm vi dữ liệu:",
      scopeGlobal: "Toàn hệ thống",
      scopeWarehouses: "Theo {count} kho bạn được phân quyền",
      scopeProductOnly: "Chỉ tính sản phẩm",
      scopeComponentOnly: "Chỉ tính linh kiện",
      scopeBoth: "Gồm cả sản phẩm và linh kiện",
      drillFallback: "Xem chi tiết {label}",
      onHand: "Tổng tồn hiện tại",
      onHandNote: "{scope} · bấm để tra cứu tồn kho",
      onHandDrill: "Mở màn Tra cứu tồn & đối soát",
      receiptToday: "Nhập hôm nay",
      issueToday: "Xuất hôm nay",
      receiptMonth: "Đã nhập tháng này",
      issueMonth: "Đã xuất tháng này",
      receiptNote: "{scope} · bấm để xem phiếu nhập",
      issueNote: "{scope} · bấm để xem phiếu xuất",
      receiptDrill: "Mở danh sách phiếu nhập",
      issueDrill: "Mở danh sách phiếu xuất",
    },

    threshold: {
      sectionTitle: "Định mức tồn kho",
      configuredWithTotal: "Trên tổng {count} SKU đã đặt định mức",
      configuredFallback: "So với định mức đã đặt ở danh mục SKU",
      unavailable: "Chưa có dữ liệu định mức từ máy chủ",
      belowMin: "Tồn dưới định mức",
      belowMinNote:
        "SKU có tồn khả dụng thấp hơn định mức tối thiểu — cần nhập bổ sung.",
      aboveMax: "Tồn vượt định mức",
      aboveMaxNote:
        "SKU có tồn khả dụng cao hơn định mức tối đa — cân nhắc giảm nhập.",
      unavailableHint:
        "Chỉ số này sẽ hiển thị khi máy chủ bổ sung dữ liệu định mức vào báo cáo tổng quan. Định mức từng SKU được đặt tại màn Danh mục SKU.",
    },

    highlights: {
      sectionLabel: "Bảo hành tiếp nhận và SKU nổi bật",
      warrantyReceived: "Số máy tiếp nhận bảo hành",
      warrantyToggleLabel: "Chọn kỳ xem số máy tiếp nhận bảo hành",
      warrantyNote:
        "Tính theo ngày tiếp nhận. Số liệu bảo hành là toàn hệ thống, không giới hạn theo kho.",
      bestSku: "SKU xuất nhiều nhất",
      bestSkuNote: "Xuất nhiều nhất trong kỳ đang xem",
      worstSku: "SKU xuất ít nhất",
      worstSkuNote: "Ít nhất trong số các SKU có phát sinh xuất",
      skuEmpty: "Kỳ này chưa phát sinh xuất hàng.",
      issuedQty: "Đã xuất {qty}",
    },

    flowChart: {
      title: "Nhập – Xuất theo thời gian",
      description:
        "So sánh lượng nhập sản phẩm, nhập linh kiện, xuất sản phẩm và xuất linh kiện bảo hành.",
      toggleLabel: "Chọn kỳ xem biểu đồ nhập xuất",
      empty: "Kỳ này chưa phát sinh nhập hoặc xuất.",
      ariaLabel: "Biểu đồ nhập xuất theo thời gian: {summary}",
      receiptProduct: "Nhập sản phẩm",
      receiptComponent: "Nhập linh kiện",
      issueProduct: "Xuất sản phẩm",
      issueComponent: "Xuất linh kiện bảo hành",
    },

    trend: {
      title: "Xu hướng tồn kho",
      description:
        "Tồn khả dụng cuối mỗi ngày, cho thấy tồn đang tăng hay giảm.",
      toggleLabel: "Chọn kỳ xem xu hướng tồn kho",
      empty: "Chưa có dữ liệu tồn trong kỳ.",
      seriesName: "Tồn khả dụng",
      footer: "Tồn cuối kỳ {last} — {direction} {delta} so với đầu kỳ.",
      ariaLabel:
        "Biểu đồ xu hướng tồn kho: đầu kỳ {first}, cuối kỳ {last}, {direction} {delta}.",
      directionUp: "tăng",
      directionDown: "giảm",
      directionFlat: "không đổi",
    },

    structure: {
      title: "Cơ cấu tồn kho hiện tại",
      description: "Tỉ trọng tồn theo từng trạng thái tại thời điểm hiện tại.",
      toggleLabel: "Chọn loại hàng cho cơ cấu tồn kho",
      empty: "Chưa có tồn kho cho nhóm hàng này.",
      ariaLabel: "Cơ cấu tồn kho {type}: {summary}",
      typeProduct: "sản phẩm",
      typeComponent: "linh kiện",
    },

    warrantyStatus: {
      title: "Tình trạng bảo hành",
      description: "Số ca theo từng trạng thái tính đến thời điểm hiện tại.",
      empty: "Chưa có ca bảo hành.",
      ariaLabel: "Biểu đồ tình trạng bảo hành: {summary}",
      centerLabel: "Tổng ca",
      overdueCount: "{count} ca quá hạn",
      overdueNote: "Đã qua ngày dự kiến hoàn thành nhưng chưa xử lý xong.",
    },

    issues: {
      title: "Vấn đề cần xử lý",
      description:
        "Số lượng tồn đọng tính đến thời điểm hiện tại. Nhấn vào một thanh để xem chi tiết.",
      footer:
        "Số lần quét lỗi không được hệ thống ghi lại nên không nằm trong danh sách này.",
      empty: "Không có vấn đề nào cần xử lý.",
      ariaLabel: "Biểu đồ vấn đề cần xử lý: {summary}",
      inventoryMismatch: "Đối soát tồn lệch",
      warrantyOverdue: "Bảo hành quá hạn",
      importError: "Import lỗi",
      printFailed: "In nhãn lỗi",
      skuPendingInfo: "SKU chờ điền thông tin",
    },

    overdueDialog: {
      title: "Ca bảo hành quá hạn",
      introPrefix:
        "Ca có ngày dự kiến hoàn thành đã qua nhưng chưa kết thúc xử lý. Tổng",
      introSuffixCase: "ca",
      introTruncated: " — đang hiển thị {count} ca cũ hạn nhất.",
      empty: "Không có ca bảo hành nào quá hạn.",
      columnCode: "Mã ca",
      columnCustomer: "Khách hàng",
      columnStatus: "Trạng thái",
      columnDue: "Hạn dự kiến",
      columnOverdue: "Quá hạn",
      daysOverdue: "{days} ngày",
    },

    workflow: {
      title: "Luồng nghiệp vụ",
      laneInbound: "Nhập kho",
      laneOutbound: "Xuất kho",
      laneWarranty: "Bảo hành",
      laneControl: "Kiểm soát",
      receiptList: "Danh sách phiếu nhập",
      createDraft: "Tạo phiếu nháp",
      scanGoods: "Quét hàng",
      postReceipt: "Ghi nhận nhập kho",
      componentsAwaitingTray: "Linh kiện chờ xếp khay",
      putaway: "Xếp vị trí",
      issueRequest: "Phiếu yêu cầu xuất",
      importExcel: "Nhập từ Excel / nhập tay",
      issueList: "Danh sách phiếu xuất",
      issueDetail: "Chi tiết phiếu xuất",
      scanReconcile: "Quét đối chiếu",
      printLabel: "In nhãn",
      rfidIssue: "Gắn RFID / ghi nhận xuất",
      warrantyList: "Danh sách bảo hành",
      warrantyIntake: "Tiếp nhận bảo hành",
      warrantyDetail: "Chi tiết bảo hành",
      componentIssue: "Xuất linh kiện",
      stockLookup: "Tra cứu tồn",
      trace: "Truy vết",
      adjustmentList: "Danh sách điều chỉnh tồn",
      createAdjustment: "Tạo điều chỉnh tồn",
    },
  },

  inbound: {
    list: {
      statusUnknown: "Chưa xác định",
      colDocument: "Phiếu nhập",
      colSource: "Nguồn / tham chiếu",
      colCreated: "Ngày tạo",
      colNote: "Ghi chú",
      colScannedQty: "Số lượng đã quét",
      colStatus: "Trạng thái",
      colUpdated: "Cập nhật",
      startScan: "Bắt đầu quét",
      continueScan: "Tiếp tục quét",
      editInfo: "Sửa thông tin",
      searchPlaceholder: "Tìm mã phiếu / nguồn nhập...",
      searchAria: "Tìm phiếu nhập",
      statusFilterAria: "Lọc trạng thái phiếu nhập",
      statusFilterPlaceholder: "Trạng thái: Tất cả",
      pageSizeAria: "Số dòng mỗi trang",
      create: "Tạo phiếu nhập",
      loadError: "Không tải được danh sách phiếu nhập.",
      selectionLabel: "Chọn phiếu nhập {code}",
      noCode: "chưa có mã",
      empty: "Chưa có phiếu nhập phù hợp",
      itemLabel: "phiếu nhập",
      view: "Xem",
    },

    draft: {
      errDocumentDate: "Chọn ngày chứng từ.",
      errDocumentDateFuture: "Ngày chứng từ không được ở tương lai.",
      errWarehouse: "Chọn kho nhận.",
      updated: "Đã cập nhật thông tin phiếu nhập.",
      created:
        "Đã tạo phiếu nhập. Quét hàng để hệ thống tự nhận SKU và số lượng.",
      saveError: "Không lưu được phiếu nhập.",
      titleEdit: "Thông tin phiếu nhập",
      titleCreate: "Tạo phiếu nhập",
      submitEdit: "Lưu thông tin",
      submitCreate: "Tạo phiếu & quét hàng",
      loadError: "Không tải được phiếu nhập.",
      readonly: "Phiếu đã kết thúc và chỉ được xem",
      documentDate: "Ngày chứng từ",
      documentDateHelper: "Định dạng: ngày/tháng/năm",
      warehouse: "Kho nhận",
      warehousePlaceholder: "Chọn kho nhận",
      sourceRef: "Nguồn / tham chiếu",
      sourceRefPlaceholder: "Chứng từ vận chuyển / nhà cung cấp (tùy chọn)",
      note: "Ghi chú",
    },

    camera: {
      title: "Quét mã vạch / QR / hộp bằng camera",
      closeManual: "Đóng / nhập tay",
      unsupported:
        "Trình duyệt chưa hỗ trợ tính năng đọc mã vạch/QR. Hãy đóng camera và nhập mã thủ công.",
      httpsRequired:
        "Camera của WMS yêu cầu kết nối HTTPS an toàn. Hãy đóng camera và nhập mã thủ công.",
      noDevice:
        "Thiết bị hoặc trình duyệt không cung cấp chức năng camera. Hãy nhập mã thủ công.",
      ready: "Camera sẵn sàng",
      initializing: "Đang khởi tạo camera...",
      hint: "Đưa mã vạch/QR vào khung hình. Camera chỉ đọc mã; dữ liệu vẫn phải qua cùng kiểm tra hợp lệ như khi nhập tay. Camera không dùng để đọc RFID.",
    },

    error: {
      responseCode: "Mã phản hồi {status}",
      errorCode: "Mã lỗi: {code}",
      requestId: "Mã yêu cầu: {id}",
    },

    carton: {
      wrongType:
        '"{code}" là vật chứa loại {type}, không phải thùng carton của luồng nhập sản phẩm.',
      finishFirst:
        'Đang quét dở thùng {active}. Hãy bấm "Đã quét xong thùng" trước khi chuyển sang {next}.',
      alreadyActive: "Thùng {code} đang là thùng được quét.",
      activeBanner:
        "Thùng đang quét: {code} · Sản phẩm quét tiếp theo sẽ gắn vào thùng này",
      opened:
        'Đã mở thùng {code}. Quét các máy trong thùng rồi bấm "Đã quét xong thùng".',
      closedEmpty:
        "Đã đóng thùng {code}. Chưa ghi nhận máy nào nên không tạo mốc nhật ký.",
      closed:
        "Đã quét xong thùng {code}: {qty} máy. Tồn kho không đổi — chỉ hoàn tất nhập kho mới tăng tồn.",
      closeError: "Không ghi nhận được mốc xong thùng.",
      activeLabel: "Thùng đang quét: {code}",
      scannedInto:
        "vào thùng này. Sản phẩm quét tiếp theo sẽ được gắn vào thùng {code}.",
      scannedPrefix: "Đã quét",
      scannedSuffix: "máy",
      finishButton: "Đã quét xong thùng",
    },

    scan: {
      noResult: "Hệ thống không trả kết quả quét.",
      componentBox: " · hộp linh kiện",
      inCarton: " · thùng {code}",
      duplicateEntry: "Hợp lệ · đã ghi nhận trước đó, không cộng thêm",
      validEntry: "Hợp lệ · +{qty}{identity}{candidate}{kind}",
      replayed:
        "Lần quét này đã được ghi nhận trước đó. Hệ thống trả lại kết quả cũ — số đã quét không tăng thêm.",
      invalidCode: "Mã quét không hợp lệ.",
      emptyInput: "Vui lòng quét hoặc nhập một mã.",
      inputPlaceholder: "Quét sản phẩm hoặc mã hộp linh kiện (BOX-…)",
      hint: "Quét sản phẩm hoặc mã hộp linh kiện — hệ thống tự nhận diện: sản phẩm/linh kiện dán mã ghi nhận +1, mã hộp (BOX-…) mở ô nhập số lượng.",
      sectionTitle: "Ghi nhận mã vạch / QR / hộp",
    },

    removeEntry: {
      title: "Gỡ mã đã quét?",
      description:
        "Mã sẽ bị xóa khỏi phiếu nhập. Muốn thêm lại, bạn phải quét lại sản phẩm đó. Tồn kho không thay đổi.",
      confirm: "Gỡ mã",
      cancel: "Hủy",
      done: "Đã gỡ mã khỏi phiếu. Dòng còn {qty} đơn vị đã quét; tồn kho không đổi.",
      error: "Không gỡ được mã đã quét.",
    },

    post: {
      replayed:
        "Phiếu đã được hoàn tất nhập kho trước đó. Hệ thống trả lại kết quả cũ, tồn kho không tăng thêm lần nữa.",
      success: "Hoàn tất nhập kho thành công. Tồn kho tăng đúng một lần.",
      error: "Không hoàn tất nhập kho được.",
      successTitle: "Nhập kho thành công",
      failedTitle: "Nhập kho thất bại, phiếu đã bị hủy",
      cancelledNote: "Phiếu đã hủy không làm thay đổi tồn kho. ",
      evidenceTitle: "Kết quả hoàn tất nhập kho",
      evidenceDocument: "Phiếu nhập:",
      evidenceMovements: "Biến động tồn kho ({count}):",
    },

    cancel: {
      success: "Đã hủy phiếu nhập. Không phát sinh biến động tồn kho.",
      error: "Không hủy được phiếu nhập.",
      title: "Hủy phiếu nhập",
      trigger: "Hủy phiếu",
      back: "Quay lại",
      confirm: "Xác nhận hủy",
      pending: "Đang hủy...",
      warning: "Hủy là trạng thái kết thúc và không làm thay đổi tồn kho",
      note: "Phiếu đã hủy không thể tiếp tục quét hoặc hoàn tất nhập kho. Nếu cần làm lại, hãy tạo phiếu mới để bảo toàn lịch sử thao tác.",
      reasonLabel: "Lý do hủy (bắt buộc)",
      reasonPlaceholder: "Lý do hủy bắt buộc",
    },

    box: {
      title: "Hộp linh kiện: {sku}",
      description:
        "chứa linh kiện {sku}. Nhập số lượng đếm được trong hộp rồi bấm Xác nhận. Nếu SKU chưa có trong kho, hệ thống sẽ tự tạo và bạn bổ sung thông tin sau.",
      codePrefix: "Mã hộp",
      qtyLabel: "Số lượng linh kiện trong hộp *",
      confirm: "Xác nhận",
      cancel: "Hủy",
    },

    newSku: {
      title: "Đây là sản phẩm hay linh kiện?",
      heading: 'Mã "{code}" chưa có trong hệ thống',
      description:
        "Hệ thống phát hiện mã bạn vừa quét là mã mới chưa có trong kho. Bạn cần xác nhận đây là sản phẩm hay linh kiện.",
      cancel: "Hủy",
      component: "Linh kiện",
      product: "Sản phẩm",
      candidateSuffix: "Sản phẩm mới · chờ ghi nhận",
    },

    detail: {
      titleWithCode: "Quét & hoàn tất nhập kho · {code}",
      title: "Quét & hoàn tất nhập kho",
      loadError: "Không tải được phiếu nhập.",
      post: "Ghi nhận nhập",
      posting: "Đang xử lý...",
      fieldDocument: "Phiếu",
      fieldSource: "Nguồn",
      fieldStatus: "Trạng thái",
      fieldVersion: "Phiên bản dữ liệu",
      statValidCodes: "Mã hợp lệ",
      statSkuLines: "Dòng SKU thực nhận",
      statRemoved: "Mã đã gỡ",
      statSessionErrors: "Mã trùng / lỗi (phiên)",
      receivedTitle: "Hàng thực nhận theo SKU",
      receivedEmpty:
        "Chưa có dòng SKU nào — quét mã sản phẩm đầu tiên để hệ thống tự tạo dòng.",
      entriesTitle: "Mã đã quét của phiếu",
      entriesSummary: "{valid} hợp lệ",
      entriesRemovedSuffix: " · {count} đã gỡ",
      entriesLoadError: "Không tải được danh sách mã đã quét.",
      entriesEmpty:
        "Chưa ghi nhận mã nào. Quét mã vạch/QR hoặc đăng ký hộp để bắt đầu.",
      sessionTitle: "Diễn biến quét trong phiên thao tác",
      sessionEmpty:
        "Chưa có lượt quét nào trong phiên này — kết quả từng lượt quét sẽ hiện ở đây.",
      colNameType: "Tên / loại",
      colScannedQty: "Số lượng đã quét",
      colCode: "Mã",
      colResult: "Kết quả",
      colSource: "Nguồn",
      colAction: "Hành động",
      sourceCamera: "Camera / mã",
      sourceManual: "Nhập tay",
      resultValid: "Hợp lệ",
      resultRemoved: "Đã gỡ",
      removeAction: "Gỡ mã",
    },

    placeholder: {
      scanModal:
        "Quét & hoàn tất nhập kho được mở từ Danh sách phiếu nhập dưới dạng cửa sổ thao tác.",
      list: "IN-01/IN-02 được quản lý trong Danh sách phiếu nhập.",
    },
  },
} as const;

/** Mọi đường dẫn dạng `namespace.khoá` trỏ tới một chuỗi lá. */
type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

export type MessageKey = Leaves<typeof MESSAGES_VI>;

/**
 * Bản dịch được phép THIẾU khoá (rơi về tiếng Việt) nhưng không được phép có
 * khoá lạ — đó là lý do dùng optional thay vì `Record<string, string>`.
 */
type Translation<T> = {
  [K in keyof T]?: T[K] extends string ? string : Translation<T[K]>;
};

export type MessageTree = Translation<typeof MESSAGES_VI>;

export const MESSAGES_EN: MessageTree = {
  common: {
    loadingData: "Loading data…",
    retry: "Retry",
    close: "Close",
    viewDetail: "View detail",
  },

  topbar: {
    language: "Language",
    languageVietnamese: "Tiếng Việt",
    languageEnglish: "English",
    openMenu: "Open menu",
  },

  nav: {
    primary: "Main navigation",
    collapse: "Collapse the navigation bar",
    expand: "Expand the navigation bar",
    brand: "Hoa Nam WMS logo",
    currentlySelected: "Currently selected: {label}",
  },

  dashboard: {
    badge: "Operations overview",
    title: "Warehouse overview",
    subtitle:
      "Track stock, receipts, issues, warranty and outstanding problems on a single screen.",
    periodCaption:
      "Viewing period: {from} → {to}. Figures are aggregated in Vietnam time.",

    state: {
      noPermissionTitle:
        "You do not have permission to view the overview report.",
      noPermissionDesc: "Please contact an administrator if you need access.",
      loadingTitle: "Loading overview figures…",
      loadingDesc: "The system is aggregating operational data.",
      errorForbidden: "You do not have permission to view the overview report.",
      errorInvalidRange: "The selected date range is invalid.",
      errorGeneric: "Could not load the overview figures.",
      errorSessionExpired: "Your session is no longer valid.",
      errorNoStale: "Stale data is not shown when loading fails.",
    },

    period: {
      today: "Today",
      week: "This week",
      month: "This month",
      quarter: "This quarter",
      year: "This year",
      weekBucket: "Week {index}",
      monthBucket: "M{month}/{year}",
    },

    skuType: {
      all: "Products & components",
      product: "Products",
      component: "Components",
    },

    kpi: {
      sectionTitle: "Operational indicators",
      toggleLabel: "Choose item type for the indicators",
      scopePrefix: "Data scope:",
      scopeGlobal: "Entire system",
      scopeWarehouses: "Across {count} warehouses you are authorised for",
      scopeProductOnly: "Products only",
      scopeComponentOnly: "Components only",
      scopeBoth: "Products and components",
      drillFallback: "View detail for {label}",
      onHand: "Current stock on hand",
      onHandNote: "{scope} · click to look up stock",
      onHandDrill: "Open Stock lookup & reconciliation",
      receiptToday: "Received today",
      issueToday: "Issued today",
      receiptMonth: "Received this month",
      issueMonth: "Issued this month",
      receiptNote: "{scope} · click to view receipt notes",
      issueNote: "{scope} · click to view issue notes",
      receiptDrill: "Open the receipt note list",
      issueDrill: "Open the issue note list",
    },

    threshold: {
      sectionTitle: "Stock thresholds",
      configuredWithTotal: "Out of {count} SKUs with thresholds set",
      configuredFallback: "Against the thresholds set in the SKU catalogue",
      unavailable: "No threshold data from the server yet",
      belowMin: "Below minimum",
      belowMinNote:
        "SKUs whose available stock is below the minimum threshold — replenishment needed.",
      aboveMax: "Above maximum",
      aboveMaxNote:
        "SKUs whose available stock is above the maximum threshold — consider receiving less.",
      unavailableHint:
        "This indicator appears once the server includes threshold data in the overview report. Per-SKU thresholds are set on the SKU catalogue screen.",
    },

    highlights: {
      sectionLabel: "Warranty intake and notable SKUs",
      warrantyReceived: "Units received for warranty",
      warrantyToggleLabel: "Choose period for warranty intake",
      warrantyNote:
        "Counted by intake date. Warranty figures cover the whole system, not a single warehouse.",
      bestSku: "Most issued SKU",
      bestSkuNote: "Highest issued quantity in the current period",
      worstSku: "Least issued SKU",
      worstSkuNote: "Lowest among SKUs that had any issue activity",
      skuEmpty: "No goods were issued in this period.",
      issuedQty: "Issued {qty}",
    },

    flowChart: {
      title: "Receipts – Issues over time",
      description:
        "Compares product receipts, component receipts, product issues and warranty component issues.",
      toggleLabel: "Choose period for the receipt/issue chart",
      empty: "No receipts or issues in this period.",
      ariaLabel: "Receipts and issues over time: {summary}",
      receiptProduct: "Product receipts",
      receiptComponent: "Component receipts",
      issueProduct: "Product issues",
      issueComponent: "Warranty component issues",
    },

    trend: {
      title: "Stock trend",
      description:
        "Available stock at the end of each day, showing whether stock is rising or falling.",
      toggleLabel: "Choose period for the stock trend",
      empty: "No stock data in this period.",
      seriesName: "Available stock",
      footer:
        "Closing stock {last} — {direction} {delta} versus the start of the period.",
      ariaLabel:
        "Stock trend chart: opening {first}, closing {last}, {direction} {delta}.",
      directionUp: "up",
      directionDown: "down",
      directionFlat: "unchanged",
    },

    structure: {
      title: "Current stock composition",
      description: "Share of stock by status as of now.",
      toggleLabel: "Choose item type for stock composition",
      empty: "No stock for this item group.",
      ariaLabel: "Stock composition for {type}: {summary}",
      typeProduct: "products",
      typeComponent: "components",
    },

    warrantyStatus: {
      title: "Warranty status",
      description: "Case count by status as of now.",
      empty: "No warranty cases yet.",
      ariaLabel: "Warranty status chart: {summary}",
      centerLabel: "Total cases",
      overdueCount: "{count} overdue cases",
      overdueNote: "Past the estimated completion date and still unresolved.",
    },

    issues: {
      title: "Issues to resolve",
      description:
        "Outstanding counts as of now. Click a bar to see the details.",
      footer:
        "Failed scans are not recorded by the system, so they are not listed here.",
      empty: "Nothing needs attention.",
      ariaLabel: "Issues to resolve: {summary}",
      inventoryMismatch: "Stock reconciliation gaps",
      warrantyOverdue: "Overdue warranty",
      importError: "Import errors",
      printFailed: "Label print failures",
      skuPendingInfo: "SKUs awaiting details",
    },

    overdueDialog: {
      title: "Overdue warranty cases",
      introPrefix:
        "Cases past their estimated completion date and still open. Total",
      introSuffixCase: "cases",
      introTruncated: " — showing the {count} most overdue.",
      empty: "No overdue warranty cases.",
      columnCode: "Case code",
      columnCustomer: "Customer",
      columnStatus: "Status",
      columnDue: "Due date",
      columnOverdue: "Overdue",
      daysOverdue: "{days} days",
    },

    workflow: {
      title: "Business flow",
      laneInbound: "Inbound",
      laneOutbound: "Outbound",
      laneWarranty: "Warranty",
      laneControl: "Control",
      receiptList: "Receipt note list",
      createDraft: "Create draft note",
      scanGoods: "Scan goods",
      postReceipt: "Post the receipt",
      componentsAwaitingTray: "Components awaiting tray",
      putaway: "Put away",
      issueRequest: "Issue request",
      importExcel: "Import from Excel / manual entry",
      issueList: "Issue note list",
      issueDetail: "Issue note detail",
      scanReconcile: "Scan to reconcile",
      printLabel: "Print labels",
      rfidIssue: "Attach RFID / post the issue",
      warrantyList: "Warranty list",
      warrantyIntake: "Warranty intake",
      warrantyDetail: "Warranty detail",
      componentIssue: "Issue components",
      stockLookup: "Stock lookup",
      trace: "Trace",
      adjustmentList: "Stock adjustment list",
      createAdjustment: "Create stock adjustment",
    },
  },

  inbound: {
    list: {
      statusUnknown: "Not determined",
      colDocument: "Receipt note",
      colSource: "Source / reference",
      colCreated: "Created on",
      colNote: "Note",
      colScannedQty: "Scanned quantity",
      colStatus: "Status",
      colUpdated: "Updated",
      startScan: "Start scanning",
      continueScan: "Continue scanning",
      editInfo: "Edit details",
      searchPlaceholder: "Search note code / source...",
      searchAria: "Search receipt notes",
      statusFilterAria: "Filter receipt note status",
      statusFilterPlaceholder: "Status: All",
      pageSizeAria: "Rows per page",
      create: "Create receipt note",
      loadError: "Could not load the receipt note list.",
      selectionLabel: "Select receipt note {code}",
      noCode: "no code yet",
      empty: "No matching receipt notes",
      itemLabel: "receipt notes",
      view: "View",
    },

    draft: {
      errDocumentDate: "Choose a document date.",
      errDocumentDateFuture: "The document date cannot be in the future.",
      errWarehouse: "Choose a receiving warehouse.",
      updated: "Receipt note details updated.",
      created:
        "Receipt note created. Scan the goods so the system detects SKU and quantity.",
      saveError: "Could not save the receipt note.",
      titleEdit: "Receipt note details",
      titleCreate: "Create receipt note",
      submitEdit: "Save details",
      submitCreate: "Create note & scan goods",
      loadError: "Could not load the receipt note.",
      readonly: "This note is closed and is read-only",
      documentDate: "Document date",
      documentDateHelper: "Format: day/month/year",
      warehouse: "Receiving warehouse",
      warehousePlaceholder: "Choose a receiving warehouse",
      sourceRef: "Source / reference",
      sourceRefPlaceholder: "Shipping document / supplier (optional)",
      note: "Note",
    },

    camera: {
      title: "Scan barcode / QR / box with the camera",
      closeManual: "Close / enter manually",
      unsupported:
        "This browser does not support barcode/QR reading. Close the camera and enter the code manually.",
      httpsRequired:
        "The WMS camera requires a secure HTTPS connection. Close the camera and enter the code manually.",
      noDevice:
        "This device or browser provides no camera function. Please enter the code manually.",
      ready: "Camera ready",
      initializing: "Starting the camera...",
      hint: "Hold the barcode/QR inside the frame. The camera only reads codes; the data still goes through the same validation as manual entry. The camera does not read RFID.",
    },

    error: {
      responseCode: "Response code {status}",
      errorCode: "Error code: {code}",
      requestId: "Request id: {id}",
    },

    carton: {
      wrongType:
        '"{code}" is a container of type {type}, not a carton of the product inbound flow.',
      finishFirst:
        'Carton {active} is still being scanned. Press "Carton scan complete" before switching to {next}.',
      alreadyActive: "Carton {code} is already the active carton.",
      activeBanner:
        "Active carton: {code} · the next product scanned will be attached to it",
      opened:
        'Carton {code} opened. Scan the units inside, then press "Carton scan complete".',
      closedEmpty:
        "Carton {code} closed. No unit was recorded, so no log milestone was created.",
      closed:
        "Carton {code} scanned: {qty} units. Stock is unchanged — only posting the receipt increases stock.",
      closeError: "Could not record the carton completion milestone.",
      activeLabel: "Active carton: {code}",
      scannedInto:
        "into this carton. The next product scanned will be attached to carton {code}.",
      scannedPrefix: "Scanned",
      scannedSuffix: "units",
      finishButton: "Carton scan complete",
    },

    scan: {
      noResult: "The system returned no scan result.",
      componentBox: " · component box",
      inCarton: " · carton {code}",
      duplicateEntry: "Valid · already recorded, nothing added",
      validEntry: "Valid · +{qty}{identity}{candidate}{kind}",
      replayed:
        "This scan was already recorded. The system returned the earlier result — the scanned count did not increase.",
      invalidCode: "Invalid scan code.",
      emptyInput: "Please scan or type a code.",
      inputPlaceholder: "Scan a product or a component box code (BOX-…)",
      hint: "Scan a product or a component box code — the system detects it automatically: a labelled product/component records +1, a box code (BOX-…) opens a quantity field.",
      sectionTitle: "Record barcode / QR / box",
    },

    removeEntry: {
      title: "Remove the scanned code?",
      description:
        "The code will be deleted from the receipt note. To add it back you must scan that product again. Stock is unaffected.",
      confirm: "Remove code",
      cancel: "Cancel",
      done: "Code removed from the note. The line still has {qty} scanned units; stock is unchanged.",
      error: "Could not remove the scanned code.",
    },

    post: {
      replayed:
        "This note was already posted. The system returned the earlier result; stock did not increase again.",
      success: "Receipt posted successfully. Stock increased exactly once.",
      error: "Could not post the receipt.",
      successTitle: "Receipt posted",
      failedTitle: "Posting failed, the note was cancelled",
      cancelledNote: "A cancelled note leaves stock unchanged. ",
      evidenceTitle: "Receipt posting result",
      evidenceDocument: "Receipt note:",
      evidenceMovements: "Stock movements ({count}):",
    },

    cancel: {
      success: "Receipt note cancelled. No stock movement occurred.",
      error: "Could not cancel the receipt note.",
      title: "Cancel receipt note",
      trigger: "Cancel note",
      back: "Go back",
      confirm: "Confirm cancellation",
      pending: "Cancelling...",
      warning: "Cancellation is a final state and leaves stock unchanged",
      note: "A cancelled note cannot be scanned or posted any further. If you need to redo it, create a new note so the operation history stays intact.",
      reasonLabel: "Cancellation reason (required)",
      reasonPlaceholder: "Cancellation reason is required",
    },

    box: {
      title: "Component box: {sku}",
      description:
        "contains component {sku}. Enter the quantity counted in the box, then press Confirm. If the SKU is not in stock yet, the system creates it and you fill in the details later.",
      codePrefix: "Box code",
      qtyLabel: "Component quantity in the box *",
      confirm: "Confirm",
      cancel: "Cancel",
    },

    newSku: {
      title: "Is this a product or a component?",
      heading: 'Code "{code}" is not in the system yet',
      description:
        "The system detected that the code you just scanned is new. Please confirm whether it is a product or a component.",
      cancel: "Cancel",
      component: "Component",
      product: "Product",
      candidateSuffix: "New product · pending record",
    },

    detail: {
      titleWithCode: "Scan & post receipt · {code}",
      title: "Scan & post receipt",
      loadError: "Could not load the receipt note.",
      post: "Post receipt",
      posting: "Processing...",
      fieldDocument: "Note",
      fieldSource: "Source",
      fieldStatus: "Status",
      fieldVersion: "Data version",
      statValidCodes: "Valid codes",
      statSkuLines: "Received SKU lines",
      statRemoved: "Removed codes",
      statSessionErrors: "Duplicate / failed codes (session)",
      receivedTitle: "Goods received by SKU",
      receivedEmpty:
        "No SKU line yet — scan the first product code and the system creates the line.",
      entriesTitle: "Codes scanned for this note",
      entriesSummary: "{valid} valid",
      entriesRemovedSuffix: " · {count} removed",
      entriesLoadError: "Could not load the scanned code list.",
      entriesEmpty:
        "No code recorded yet. Scan a barcode/QR or register a box to start.",
      sessionTitle: "Scan activity in this session",
      sessionEmpty:
        "No scan in this session yet — the result of each scan will appear here.",
      colNameType: "Name / type",
      colScannedQty: "Scanned quantity",
      colCode: "Code",
      colResult: "Result",
      colSource: "Source",
      colAction: "Action",
      sourceCamera: "Camera / code",
      sourceManual: "Manual entry",
      resultValid: "Valid",
      resultRemoved: "Removed",
      removeAction: "Remove code",
    },

    placeholder: {
      scanModal:
        "Scan & post receipt opens from the receipt note list as an operation window.",
      list: "IN-01/IN-02 are managed in the receipt note list.",
    },
  },
};
