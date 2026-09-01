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
};
