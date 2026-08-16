/* eslint-disable */
// @ts-nocheck
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/constants/routes";

/** Pixel source port of HN_WMS_Wireframe_MVP.html. */
function table(headers, rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function field(label, value){return `<div class="field"><label>${label}</label><div class="value">${value}</div></div>`}
function card(title, body, cls=''){return `<div class="card ${cls}"><div class="section-title">${title}</div>${body}</div>`}

const screens = {
  'MAP-01':()=>`
    <div class="flow">
      <div class="lane"><div class="tag">Nhập kho</div><span class="node">Danh sách phiếu nhập</span><span>→</span><span class="node">Tạo DRAFT</span><span>→</span><span class="node">Quét / camera</span><span>→</span><span class="node">Post Receipt toàn bộ</span><span>→</span><span class="node">Linh kiện chờ xếp khay</span><span>→</span><span class="node">Putaway</span></div>
      <div class="lane"><div class="tag">Xuất kho</div><span class="node">Phiếu toa / yêu cầu xuất</span><span>→</span><span class="node">Import Excel / nhập tay</span><span>→</span><span class="node">Confirm Outbound DRAFT</span><span>→</span><span class="node">Quét & match đủ</span><span>→</span><span class="node">Tổng hợp lô</span><span>→</span><span class="node">Packing Label DRAFT</span><span>→</span><span class="node">Preview / Ready / Print</span><span>→</span><span class="node">Dán 1 nhãn ngoài kiện/lô</span><span>→</span><span class="node">Hoàn tất xuất / Post Issue</span></div>
      <div class="lane"><div class="tag">RFID</div><span class="node">Map cho PRODUCT khi có tag</span><span>→</span><span class="node">Tùy chọn · stock-neutral · không chặn Post</span></div>
      <div class="lane"><div class="tag">Bảo hành</div><span class="node">Danh sách bảo hành</span><span>→</span><span class="node">Tiếp nhận bảo hành</span><span>→</span><span class="node">Chi tiết bảo hành</span><span>→</span><span class="node">Xuất linh kiện</span></div>
      <div class="lane"><div class="tag">Kiểm soát</div><span class="node">Tra cứu tồn</span><span>→</span><span class="node">Truy vết</span><span>→</span><span class="node">Danh sách Reversal</span><span>→</span><span class="node">Tạo Reversal</span></div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      ${card('Ghi chú phạm vi MVP',`
        <div class="rule"><span class="dot"></span><span>Không dựng App PV trong bộ wireframe này.</span></div>
        <div class="rule"><span class="dot"></span><span>Giao diện ưu tiên tiếng Việt cho người dùng vận hành kho.</span></div>
        <div class="rule"><span class="dot"></span><span>Camera điện thoại đọc Barcode / QR; RFID là mapping bổ sung khi có tag.</span></div>
        <div class="rule"><span class="dot"></span><span>Luồng nhập / xuất full-post only; không có partial post.</span></div>
        <div class="rule"><span class="dot"></span><span>Outbound chỉ có <b>01 Packing Label cho toàn phiếu/lô xuất</b>, không có nhãn theo từng Item.</span></div>
        <div class="rule"><span class="dot"></span><span>Scan/match, tổng hợp, tạo/in/dán nhãn đều <b>không đổi tồn</b>. Chỉ <b>Hoàn tất xuất / Post Issue</b> thành công mới trừ tồn.</span></div>
      `,'soft')}
      ${card('Gate Hoàn tất xuất / Post Issue',`
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>Full match toàn bộ Item và đủ available_qty.</span></div>
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>Packing Label = PRINTED và snapshot hiện hành.</span></div>
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>Người dùng xác nhận đã dán nhãn ngoài kiện/lô.</span></div>
        <div class="rule"><span class="dot" style="background:#2563eb"></span><span>RFID không phải gate; thiếu RFID vẫn dùng Barcode/QR fallback.</span></div>
      `,'soft')}
    </div>
    <div class="footer-note">Wireframe low-fi · Nguồn hiện hành: BRD v3.20 / SRS-FRD v1.12 / BPD v1.12 · DEC-HN-20260814-01.</div>
  `,
  'IAM-01':()=>`
    <div class="toolbar"><input class="input search" value="" placeholder="Tìm tên / tên đăng nhập"/><select class="select"><option>Vai trò: Tất cả</option></select><select class="select"><option>Trạng thái: Tất cả</option></select><div class="spacer"></div><button class="btn primary" onclick="go('IAM-02')">+ Thêm người dùng</button></div>
    ${table(['Người dùng','Vai trò','Phạm vi','Trạng thái','Đăng nhập cuối',''],[
      ['Nguyễn Văn Kho<br><span class="muted">nvkho01</span>','Nhân viên kho','Kho tổng','<span class="pill ok">Đang hoạt động</span>','10/08/2026 08:14','<button class="btn small" onclick="go(\'IAM-02\')">Sửa</button>'],
      ['Lê Thu Bảo Hành<br><span class="muted">warranty02</span>','Nhân viên bảo hành','Bảo hành','<span class="pill ok">Đang hoạt động</span>','09/08/2026 16:02','<button class="btn small" onclick="go(\'IAM-02\')">Sửa</button>'],
      ['Trần Lãnh Đạo<br><span class="muted">report01</span>','Lãnh đạo','Chỉ xem báo cáo','<span class="pill warn-pill">Tạm ngưng</span>','08/08/2026 09:30','<button class="btn small" onclick="go(\'IAM-02\')">Sửa</button>']
    ])}
  `,
  'IAM-02':()=>`
    <div class="grid-2">
      ${card('Thông tin tài khoản', field('Họ và tên *','Nguyễn Văn Kho')+field('Tên đăng nhập *','nvkho01')+field('Số điện thoại','0901234567')+field('Email','nvkho01@hoanam.vn')+field('Trạng thái *','Đang hoạt động'))}
      ${card('Phân quyền', field('Vai trò *','Nhân viên kho')+field('Phạm vi dữ liệu *','Kho tổng Hoa Nam')+field('Mật khẩu tạm / đặt lại','••••••••')+field('Ghi chú','Tài khoản dùng cho khu nhập hàng'))}
    </div>
    <div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('IAM-01')">Hủy</button><button class="btn primary">Lưu người dùng</button></div>
  `,
  'MST-01':()=>`
    <div class="toolbar"><input class="input search" placeholder="Tìm SKU / tên / model"/><select class="select"><option>Loại: Tất cả</option></select><select class="select"><option>Hãng</option></select><div class="spacer"></div><button class="btn primary" onclick="go('MST-02')">+ Tạo SKU</button></div>
    ${table(['SKU','Tên sản phẩm / linh kiện','Loại','Hãng','Theo dõi serial','Trạng thái',''],[
      ['DCH-DRILL-DJZ10A-220V-V1','Máy khoan Dongcheng DJZ10A 220V','PRODUCT','Dongcheng','Có','<span class="pill ok">ACTIVE</span>','<button class="btn small" onclick="go(\'MST-02\')">Sửa</button>'],
      ['LK-DCH-PIN-20V-V1','Pin 20V Dongcheng','COMPONENT','Dongcheng','Có','<span class="pill ok">ACTIVE</span>','<button class="btn small" onclick="go(\'MST-02\')">Sửa</button>'],
      ['LK-DCH-OC-VIT-M2-V1','Ốc vít M2','COMPONENT','Dongcheng','Không','<span class="pill ok">ACTIVE</span>','<button class="btn small" onclick="go(\'MST-02\')">Sửa</button>']
    ])}
    <div class="footer-note">Sau cột <b>Trạng thái</b> chỉ giữ action <b>Sửa</b>, không cần action Xem riêng.</div>
  `,
  'MST-02':()=>`<div class="grid-2">${card('Thông tin định danh',field('SKU code *','DCH-DRILL-DJZ10A-220V-V1')+field('Tên SKU *','Máy khoan Dongcheng DJZ10A 220V')+field('Loại SKU *','PRODUCT')+field('Đơn vị tính *','cái'))}${card('Thông tin sản phẩm',field('Hãng *','Dongcheng')+field('Category *','DRILL')+field('Model *','DJZ10A')+field('Nguồn điện *','Điện trực tiếp 220V')+field('Theo dõi serial *','Có'))}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('MST-01')">Hủy</button><button class="btn primary">Lưu SKU</button></div>`,
  'AGY-01':()=>`
    <div class="toolbar"><input class="input search" placeholder="Tìm mã / tên đại lý"/><div class="spacer"></div><button class="btn primary" onclick="go('AGY-02')">+ Thêm đại lý</button></div>
    ${table(['Mã','Tên đại lý / nơi nhận','Liên hệ','Địa chỉ','Trạng thái',''],[
      ['AG-HN-001','Đại lý Minh Anh','0901 234 567','Hà Nội','<span class="pill ok">ACTIVE</span>','<button class="btn small" onclick="go(\'AGY-02\')">Sửa</button>'],
      ['AG-HP-002','Đại lý Hải Phòng','0912 888 999','Hải Phòng','<span class="pill ok">ACTIVE</span>','<button class="btn small" onclick="go(\'AGY-02\')">Sửa</button>']
    ])}`,
  'AGY-02':()=>`<div class="grid-2">${card('Thông tin chung',field('Mã đại lý *','AG-HN-001')+field('Tên đại lý *','Đại lý Minh Anh')+field('Trạng thái *','ACTIVE')+field('Nhóm đại lý','Đại lý cấp 1'))}${card('Liên hệ',field('Người liên hệ','Nguyễn Văn A')+field('Số điện thoại','0901234567')+field('Email','daily.minhanh@example.com')+field('Địa chỉ','Số 12 Hoàng Quốc Việt, Hà Nội'))}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('AGY-01')">Hủy</button><button class="btn primary">Lưu đại lý</button></div>`,
  'DEF-01':()=>`
    <div class="toolbar"><input class="input search" placeholder="Tìm mã / tên bệnh lỗi"/><div class="spacer"></div><button class="btn primary" onclick="go('DEF-02')">+ Thêm bệnh / lỗi</button></div>
    ${table(['Mã lỗi','Tên bệnh / lỗi','Mô tả','Trạng thái',''],[
      ['DF-MOTOR-01','Không chạy motor','Motor không quay khi cấp nguồn','<span class="pill ok">ACTIVE</span>','<button class="btn small" onclick="go(\'DEF-02\')">Sửa</button>'],
      ['DF-BATT-02','Pin tụt nhanh','Dung lượng giảm bất thường','<span class="pill ok">ACTIVE</span>','<button class="btn small" onclick="go(\'DEF-02\')">Sửa</button>'],
      ['DF-OLD-01','Lỗi cũ không dùng','Giữ lịch sử','<span class="pill danger-pill">INACTIVE</span>','<button class="btn small" onclick="go(\'DEF-02\')">Sửa</button>']
    ])}`,
  'DEF-02':()=>`<div class="grid-2">${card('Thông tin lỗi',field('Mã lỗi *','DF-MOTOR-01')+field('Tên bệnh / lỗi *','Không chạy motor')+field('Trạng thái *','ACTIVE'))}${card('Mô tả & sử dụng',field('Mô tả','Motor không quay khi cấp nguồn hoặc quay không ổn định')+field('Nhóm áp dụng','Máy khoan / máy mài')+field('Ghi chú nội bộ','Dùng cho báo cáo bảo hành'))}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('DEF-01')">Hủy</button><button class="btn primary">Lưu bệnh / lỗi</button></div>`,
  'IN-01':()=>`<div class="toolbar"><input class="input search" placeholder="Tìm mã phiếu / nguồn nhập"/><select class="select"><option>Trạng thái: Tất cả</option></select><div class="spacer"></div><button class="btn primary" onclick="go('IN-02')">+ Tạo phiếu nhập</button></div>${table(['Phiếu nhập','Nguồn','Tiến độ','Trạng thái','Cập nhật',''],[['IN-20260810-003','Nhà cung cấp TQ','8 / 10','<span class="pill blue">SCANNING</span>','10/08 10:08','<button class="btn small" onclick="go(\'IN-03\')">Mở</button>'],['IN-20260809-014','Nhà cung cấp TQ','24 / 24','<span class="pill ok">POSTED</span>','09/08 16:31','<button class="btn small" onclick="go(\'IN-03\')">Xem</button>']])}`,
  'IN-02':()=>`<div class="grid-2">${card('Thông tin phiếu',field('Mã phiếu','Tự sinh sau khi lưu')+field('Nguồn / tham chiếu','Nhà cung cấp TQ')+field('Kho','Kho tổng Hoa Nam'))}${card('Quy tắc',`<div class="rule"><span class="dot"></span><span>expected_qty là số lượng đầy đủ cần nhận.</span></div><div class="rule"><span class="dot"></span><span>Không có nhập một phần / thiếu / thừa.</span></div><div class="rule"><span class="dot"></span><span>Scan vượt expected_qty bị từ chối.</span></div>`,'soft')}</div><div style="margin-top:14px">${table(['SKU','Tên','Expected qty','Loại'],[['DCH-DRILL-DJZ10A-220V-V1','Máy khoan DJZ10A','10','PRODUCT'],['LK-DCH-PIN-20V-V1','Pin 20V','20','COMPONENT']])}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('IN-01')">Hủy</button><button class="btn primary" onclick="go('IN-03')">Lưu & bắt đầu quét</button></div>`,
  'IN-03':()=>`
    <div class="stats"><div class="stat"><div class="n" id="inScanned">8</div><div class="l">Mã hợp lệ</div></div><div class="stat"><div class="n">10</div><div class="l">Số lượng cần nhận</div></div><div class="stat"><div class="n">0</div><div class="l">Mã trùng</div></div><div class="stat"><div class="n">0</div><div class="l">Mã lỗi</div></div></div>
    <div class="grid-2">
      ${card('Quét hàng',`<div class="toolbar-wrap"><input class="input search" placeholder="Nhập / quét Barcode hoặc QR"/><button class="btn">Quét bằng camera</button><button class="btn" onclick="demoInboundComplete()">Demo đủ 10/10</button></div><div class="muted">DCH-DRILL-DJZ10A-220V-V1: <b id="inProgressLabel">8 / 10</b></div><div class="progress" style="margin-top:8px"><span id="inProgressBar" style="width:80%"></span></div>`)}
      ${card('Điều kiện Post',`<div class="rule"><span id="inGate" class="dot" style="background:#d97706"></span><span id="inGateText">Còn thiếu 2 Item - Post đang khóa.</span></div><div class="rule"><span class="dot" style="background:#16a34a"></span><span>Không có scan lỗi chưa xử lý.</span></div><div class="muted">Retry cùng idempotency key không được tăng tồn lần hai.</div>`,'soft')}
    </div>
    <div style="margin-top:14px">${table(['Mã','SKU','Kết quả','Nguồn'],[['ITEM-BC-000008','DCH-DRILL-DJZ10A-220V-V1','<span class="pill ok">Hợp lệ</span>','CAMERA'],['ITEM-BC-000007','DCH-DRILL-DJZ10A-220V-V1','<span class="pill ok">Hợp lệ</span>','NHẬP TAY']])}</div>
    <div class="toolbar" style="margin-top:16px"><button class="btn">Lưu nháp</button><button class="btn danger">Hủy phiếu</button><button id="inPostBtn" class="btn success" disabled>Post Receipt toàn bộ</button></div>
  `,
  'PTW-00':()=>`<div class="toolbar"><input class="input search" placeholder="Tìm box code / SKU"/><div class="spacer"></div><button class="btn">Làm mới</button></div>${table(['Box code','SKU','Số lượng','Trạng thái','Khu vực gợi ý',''],[['BOX-COMP-0012','LK-DCH-OC-VIT-M2-V1','100','<span class="pill warn-pill">CHỜ XẾP KHAY</span>','Khu linh kiện','<button class="btn small" onclick="go(\'PTW-01\')">Mở</button>'],['BOX-COMP-0013','LK-DCH-PIN-20V-V1','20','<span class="pill warn-pill">CHỜ XẾP KHAY</span>','Khu pin/sạc','<button class="btn small" onclick="go(\'PTW-01\')">Mở</button>']])}<div class="footer-note">Nhân viên chọn box từ danh sách này để thực hiện Putaway.</div>`,
  'PTW-01':()=>`<div class="grid-2">${card('Box được chọn',field('Box code','BOX-COMP-0012')+field('SKU','LK-DCH-OC-VIT-M2-V1')+field('Số lượng','100')+field('Khu vực gợi ý hiện tại','Khu linh kiện')+field('Trạng thái','CHỜ XẾP KHAY'))}${card('Khay đích',field('Tray code','TRAY-A-07')+field('zone_code','COMPONENT_AREA')+field('location_hint','Dãy trái khu linh kiện')+`<button class="btn">Quét bằng camera</button>`)}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('PTW-00')">Quay lại danh sách chờ</button><button class="btn primary">Confirm Putaway</button></div>`,
  'OUT-REQ-01':()=>`
    <div class="grid-2">
      ${card('Nhập tay thông tin phiếu yêu cầu xuất',field('source_request_no *','REQ-20260810-001')+field('Người nhận *','Nguyễn Văn A')+field('Địa chỉ *','Số 12 Hoàng Quốc Việt, Hà Nội')+field('SĐT liên hệ','0901234567'))}
      ${card('Import file Excel',`<div class="field"><label>File Excel</label><div class="toolbar-wrap"><button class="btn">+ Chọn file Excel</button><span class="muted">sales_request_20260810.xlsx</span></div></div><div class="field"><label>Kết quả import preview</label><div class="alert">Đọc được 2 dòng hàng · 1 người nhận · source_request_no = REQ-20260810-001</div></div><div class="muted">Sau import, người dùng kiểm tra preview trước khi Confirm.</div>`,'soft')}
    </div>
    <div style="margin-top:14px">${table(['SKU','Tên','Số lượng yêu cầu','Khả dụng','Kết quả'],[['DCH-DRILL-DJZ10A-220V-V1','Máy khoan DJZ10A','2','18','<span class="pill ok">Có thể đáp ứng</span>'],['DCH-GRINDER-DSM02-850W-V1','Máy mài DSM02','1','7','<span class="pill ok">Có thể đáp ứng</span>']])}</div>
    <div class="toolbar" style="margin-top:16px"><button class="btn">Hủy</button><button class="btn primary" onclick="go('OUT-03')">Confirm & tạo Outbound DRAFT</button></div>
  `,
  'OUT-01':()=>`
    <div class="toolbar"><input class="input search" placeholder="Tìm phiếu xuất / request / người nhận"/><select class="select"><option>Trạng thái: Tất cả</option></select><div class="spacer"></div><button class="btn primary" onclick="go('OUT-REQ-01')">+ Tiếp nhận yêu cầu xuất</button></div>
    ${table(['Phiếu xuất','Request','Người nhận','Match Item','Packing Label','RFID','Trạng thái',''],[
      ['OUT-20260810-005','REQ-20260810-001','Nguyễn Văn A','3/3','<span class="pill ok">PRINTED · ĐÃ DÁN</span>','2/3 · tùy chọn','<span class="pill blue">SCANNING</span>','<button class="btn small" onclick="go(\'OUT-03\')">Mở</button>'],
      ['OUT-20260809-020','REQ-20260809-007','Đại lý Minh Anh','5/5','<span class="pill ok">PRINTED · ĐÃ DÁN</span>','5/5 · tùy chọn','<span class="pill ok">POSTED</span>','<button class="btn small" onclick="go(\'OUT-03\')">Xem</button>'],
      ['OUT-20260809-018','REQ-20260809-004','Trần Minh','2/4','<span class="pill warn-pill">CHƯA TẠO</span>','0/4 · tùy chọn','<span class="pill warn-pill">SCANNING</span>','<button class="btn small" onclick="go(\'OUT-03\')">Mở</button>']
    ])}
    <div class="footer-note"><b>Packing Label tính theo phiếu/lô xuất, không theo Item.</b> Phiếu OUT-20260810-005 có 3 Item nhưng chỉ có 1 Packing Label.</div>
  `,
  'OUT-03':()=>`
    <div class="grid-2">
      ${card('Thông tin chung',`<div class="kpi"><span>Phiếu xuất</span><b>OUT-20260810-005</b></div><div class="kpi"><span>Phiếu yêu cầu xuất</span><b>REQ-20260810-001</b></div><div class="kpi"><span>Người nhận</span><b>Nguyễn Văn A</b></div><div class="kpi"><span>Địa chỉ</span><b>Số 12 Hoàng Quốc Việt, Hà Nội</b></div><div class="kpi"><span>SĐT</span><b>0901234567</b></div><div class="kpi"><span>Trạng thái</span><span class="pill blue">SCANNING</span></div>`)}
      ${card('Tiến độ & gate',`<div class="kpi"><span>Match Item</span><b>3 / 3</b></div><div class="kpi"><span>Tổng hợp lô</span><b>2 SKU · 3 Item</b></div><div class="kpi"><span>Packing Label</span><b>1 / 1 · PRINTED</b></div><div class="kpi"><span>Xác nhận đã dán nhãn</span><b>Có</b></div><div class="kpi"><span>RFID đã map</span><b>2 / 3 · tùy chọn</b></div><div class="kpi"><span>Có thể Hoàn tất xuất</span><b>Có · thiếu RFID không chặn</b></div>`,'soft')}
    </div>
    <div class="grid-2" style="margin-top:14px">
      ${card('Packing Label của lô/phiếu xuất',`<div class="kpi"><span>packing_label_id</span><b>PKL-OUT-20260810-005</b></div><div class="kpi"><span>Snapshot</span><b>PLS-000005 · current</b></div><div class="kpi"><span>Trạng thái</span><span class="pill ok">PRINTED</span></div><div class="kpi"><span>Phạm vi</span><b>Toàn bộ OUT-20260810-005</b></div><div class="muted" style="margin-top:8px">3 Item / 2 SKU vẫn chỉ dùng <b>01 nhãn ngoài kiện/lô</b>.</div>`)}
      ${card('Nguyên tắc tồn kho',`<div class="rule"><span class="dot" style="background:#2563eb"></span><span>Scan/match: stock effect = 0.</span></div><div class="rule"><span class="dot" style="background:#2563eb"></span><span>Tổng hợp + Preview/Ready/Print + dán nhãn: stock effect = 0.</span></div><div class="rule"><span class="dot" style="background:#2563eb"></span><span>Map RFID: stock effect = 0 và optional.</span></div><div class="rule"><span class="dot" style="background:#16a34a"></span><span>Chỉ Hoàn tất xuất / Post Issue thành công mới tạo ISSUE_POSTED và giảm tồn.</span></div>`,'soft')}
    </div>
    <div style="margin-top:14px">${table(['Item code','SKU','Match','RFID (tùy chọn)'],[
      ['ITEM-BC-A001','DCH-DRILL-DJZ10A-220V-V1','<span class="pill ok">Matched</span>','RFID-E200-000001'],
      ['ITEM-BC-A002','DCH-DRILL-DJZ10A-220V-V1','<span class="pill ok">Matched</span>','RFID-E200-000002'],
      ['ITEM-BC-G011','DCH-GRINDER-DSM02-850W-V1','<span class="pill ok">Matched</span>','<span class="pill blue">Barcode/QR fallback</span>']
    ])}</div>
    <div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('OUT-01')">Quay lại danh sách</button><button class="btn" onclick="go('OUT-02')">Quét & match Item</button><button class="btn primary" onclick="go('LBL-01')">Packing Label lô hàng</button><button class="btn" onclick="go('RFID-01')">RFID tùy chọn / Hoàn tất xuất</button></div>
  `,
  'OUT-02':()=>`
    <div class="stats"><div class="stat"><div class="n">3 / 3</div><div class="l">Item đã match</div></div><div class="stat"><div class="n">0</div><div class="l">Mã sai SKU</div></div><div class="stat"><div class="n">0</div><div class="l">Mã trùng</div></div><div class="stat"><div class="n">0</div><div class="l">Unknown</div></div></div>
    <div class="toolbar-wrap"><input class="input search" placeholder="Quét Barcode / QR item"/><button class="btn">Quét bằng camera</button></div>
    <div style="margin-top:14px">${table(['Mã quét','SKU kỳ vọng','Kết quả','Nguồn'],[
      ['ITEM-BC-A001','DCH-DRILL-DJZ10A-220V-V1','<span class="pill ok">Match</span>','CAMERA'],
      ['ITEM-BC-A002','DCH-DRILL-DJZ10A-220V-V1','<span class="pill ok">Match</span>','CAMERA'],
      ['ITEM-BC-G011','DCH-GRINDER-DSM02-850W-V1','<span class="pill ok">Match</span>','NHẬP TAY']
    ])}</div>
    <div class="alert" style="margin-top:14px"><b>Đủ 3/3 Item.</b> Bước kế tiếp là hệ thống <b>tổng hợp toàn bộ lô</b> và tạo/đảm bảo đúng <b>01 Packing Label DRAFT</b> cho phiếu xuất. Chưa trừ tồn ở bước này.</div>
    <div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('OUT-03')">Quay lại chi tiết phiếu</button><button class="btn">Lưu kết quả match</button><button class="btn primary" onclick="go('LBL-01')">Tổng hợp & chuẩn bị Packing Label</button></div>
  `,
  'LBL-01':()=>`
    <div class="grid-2">
      <div>
        ${card('Packing Label của phiếu/lô xuất',`
          <div class="kpi"><span>Phiếu xuất</span><b>OUT-20260810-005</b></div>
          <div class="kpi"><span>Packing Label</span><b>PKL-OUT-20260810-005</b></div>
          <div class="kpi"><span>Phạm vi nhãn</span><b>Toàn bộ lô xuất · 3 Item / 2 SKU</b></div>
          <div class="kpi"><span>Trạng thái</span><span class="pill ok">PRINTED</span></div>
          <div class="kpi"><span>Snapshot</span><b>PLS-000005 · immutable/current</b></div>
          <div class="kpi"><span>Đã dán nhãn</span><b>Có</b></div>
        `)}
        <div style="margin-top:14px">${table(['SKU','Tên hàng','Số lượng trong lô'],[
          ['DCH-DRILL-DJZ10A-220V-V1','Máy khoan DJZ10A','2'],
          ['DCH-GRINDER-DSM02-850W-V1','Máy mài DSM02','1']
        ])}</div>
        <div class="footer-note"><b>Không tạo Item_Label.</b> Danh sách Item/SKU chỉ là nội dung tổng hợp nằm trong snapshot của 01 Packing Label.</div>
      </div>
      <div>
        <div class="section-title">Xem trước Packing Label ngoài kiện/lô</div>
        <div class="print-sheet">
          <div class="label-preview">
            <div class="label-head"><div><div class="label-brand">HOA NAM</div><div class="label-sub">PACKING LABEL · PHIẾU/LÔ XUẤT</div></div><div class="pill blue">1 nhãn / 1 lô</div></div>
            <div class="label-grid">
              <div class="label-cell"><b>Mã nhãn</b><span>PKL-OUT-20260810-005</span></div>
              <div class="label-cell"><b>Phiếu xuất</b><span>OUT-20260810-005</span></div>
              <div class="label-cell"><b>Phiếu toa / Request</b><span>REQ-20260810-001</span></div>
              <div class="label-cell"><b>Ngày giờ</b><span>10/08/2026 11:05</span></div>
              <div class="label-cell"><b>Người nhận</b><span>Nguyễn Văn A</span></div>
              <div class="label-cell"><b>SĐT</b><span>0901234567</span></div>
              <div class="label-cell" style="grid-column:1 / -1"><b>Địa chỉ giao</b><span>Số 12 Hoàng Quốc Việt, Hà Nội</span></div>
              <div class="label-cell"><b>Tổng SKU</b><span>2</span></div>
              <div class="label-cell"><b>Tổng Item</b><span>3</span></div>
              <div class="label-cell" style="grid-column:1 / -1"><b>Tóm tắt hàng</b><span>DJZ10A × 2 · DSM02 × 1</span></div>
            </div>
            <div class="barcode-box"><div class="barcode-bars"></div><div class="barcode-text">OUT-20260810-005</div></div>
            <div class="alert" style="margin-top:12px">QR/Barcode đại diện cho kiện/phiếu xuất. Không dùng Barcode của từng Item làm Packing Label.</div>
          </div>
        </div>
      </div>
    </div>
    <div class="grid-2" style="margin-top:14px">
      ${card('Lifecycle trước Hoàn tất xuất',`<div class="lane"><span class="node">DRAFT</span><span>→</span><span class="node">PREVIEWED</span><span>→</span><span class="node">READY_TO_PRINT</span><span>→</span><span class="node">PRINTED</span><span>→</span><span class="node">ĐÃ DÁN</span></div><div class="muted" style="margin-top:10px">Ready đóng băng immutable Packing_Label_Snapshot. Print/Retry/Reprint không đổi tồn.</div>`,'soft')}
      ${card('Điều kiện sau bước nhãn',`<div class="rule"><span class="dot" style="background:#16a34a"></span><span>Label PRINTED.</span></div><div class="rule"><span class="dot" style="background:#16a34a"></span><span>Snapshot current với outbound.</span></div><div class="rule"><span class="dot" style="background:#16a34a"></span><span>Nhân viên đã dán nhãn ngoài kiện/lô.</span></div><div class="rule"><span class="dot" style="background:#2563eb"></span><span>Vẫn chưa trừ tồn; stock effect = 0 cho tới khi Hoàn tất xuất/Post Issue.</span></div>`,'soft')}
    </div>
    <div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('OUT-03')">Quay lại chi tiết phiếu</button><button class="btn">Preview</button><button class="btn">Ready / đóng băng snapshot</button><button class="btn">Print / Retry</button><button class="btn primary" onclick="go('RFID-01')">Xác nhận đã dán & tiếp tục</button></div>
  `,
  'RFID-01':()=>`
    <div class="grid-2">
      ${card('Map RFID cho PRODUCT (tùy chọn)',`
        <div class="toolbar-wrap"><input class="input search" placeholder="Quét RFID / nhập EPC nếu có tag"/><button class="btn">Map RFID</button></div>
        ${table(['Item','RFID','Kết quả'],[
          ['ITEM-BC-A001','RFID-E200-000001','<span class="pill ok">Đã map</span>'],
          ['ITEM-BC-A002','RFID-E200-000002','<span class="pill ok">Đã map</span>'],
          ['ITEM-BC-G011','-','<span class="pill blue">Không có tag · dùng Barcode/QR</span>']
        ])}
        <div class="footer-note">RFID mapping là stock-neutral. Thiếu RFID không chặn Hoàn tất xuất/Post Issue.</div>
      `)}
      ${card('Gate Hoàn tất xuất / Post Issue',`
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>3/3 Item đã full match.</span></div>
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>available_qty đủ tại thời điểm completion.</span></div>
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>01 Packing Label = PRINTED.</span></div>
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>Packing_Label_Snapshot hiện hành.</span></div>
        <div class="rule"><span class="dot" style="background:#16a34a"></span><span>label_applied_confirmed = true.</span></div>
        <div class="rule"><span class="dot" style="background:#2563eb"></span><span>RFID 2/3: <b>không phải blocker</b>.</span></div>
        <div class="alert" style="margin-top:10px"><b>Stock effect:</b> chỉ khi bấm Hoàn tất xuất / Post Issue và giao dịch thành công mới giảm tồn, tạo ISSUE_POSTED và chuyển Outbound sang POSTED.</div>
      `,'soft')}
    </div>
    <div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('OUT-03')">Quay lại chi tiết phiếu</button><button class="btn" onclick="go('LBL-01')">Kiểm tra Packing Label</button><button class="btn success">Hoàn tất xuất / Post Issue · Trừ tồn</button></div>
  `,
  'WAR-01':()=>`<div class="toolbar"><input class="input search" placeholder="Tìm case / mã máy / mã tạm / SĐT"/><select class="select"><option>Trạng thái: Tất cả</option></select><div class="spacer"></div><button class="btn primary" onclick="go('WAR-02')">+ Tiếp nhận bảo hành</button></div>${table(['Case','Nhận diện','Khách hàng','Sản phẩm','Bệnh / lỗi','Trạng thái',''],[['WAR-20260810-008','ITEM-BC-A001','Nguyễn V•• A','DJZ10A','Không chạy motor','<span class="pill blue">CHECKING</span>','<button class="btn small" onclick="go(\'WAR-03\')">Mở</button>'],['WAR-20260809-021','TEMP-WAR-0098','Trần T•• B','Mô tả thủ công','Mất mã / không lên nguồn','<span class="pill warn-pill">RECEIVED</span>','<button class="btn small" onclick="go(\'WAR-03\')">Mở</button>']])}<div class="footer-note">Bấm <b>Mở</b> sẽ vào <b>Chi tiết bảo hành</b>.</div>`,
  'WAR-02':()=>`<div class="grid-2">${card('Thông tin tiếp nhận',field('Mã case','Tự sinh')+field('Loại tiếp nhận','IDENTIFIED / TEMP_ONLY')+field('Khách hàng','Nguyễn Văn A')+field('SĐT','0901234567'))}${card('Sản phẩm & lỗi',field('Item code / mã tạm','ITEM-BC-A001')+field('SKU / model','DJZ10A')+field('Bệnh / lỗi','Không chạy motor')+field('Ghi chú','Khách báo máy không chạy'))}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('WAR-01')">Hủy</button><button class="btn primary" onclick="go('WAR-03')">Lưu tiếp nhận</button></div>`,
  'WAR-03':()=>`<div class="grid-2">${card('Thông tin case',`<div class="kpi"><span>Mã case</span><b>WAR-20260810-008</b></div><div class="kpi"><span>Khách hàng</span><b>Nguyễn Văn A</b></div><div class="kpi"><span>SĐT</span><b>0901234567</b></div><div class="kpi"><span>Nhận diện</span><b>ITEM-BC-A001</b></div><div class="kpi"><span>Trạng thái</span><span class="pill blue">CHECKING</span></div>`)}${card('Thông tin kỹ thuật',`<div class="kpi"><span>Sản phẩm</span><b>DJZ10A</b></div><div class="kpi"><span>Bệnh / lỗi</span><b>Không chạy motor</b></div><div class="kpi"><span>Kết quả kiểm tra</span><b>Cần thay pin 20V</b></div><div class="kpi"><span>Ảnh đính kèm</span><b>3 ảnh</b></div>`,'soft')}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('WAR-01')">Quay lại danh sách</button><button class="btn primary" onclick="go('COMP-01')">Xuất linh kiện</button></div>`,
  'COMP-01':()=>`${table(['Case','Linh kiện','Số lượng','Mục đích','Trạng thái'],[['WAR-20260810-008','Pin 20V','1','WARRANTY','<span class="pill ok">Có thể xuất</span>']])}<div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('WAR-03')">Quay lại case</button><button class="btn primary">Tạo phiếu xuất linh kiện</button></div>`,
  'INV-01':()=>`<div class="toolbar"><input class="input search" placeholder="Tìm SKU / serial / item"/><select class="select"><option>Kho tổng Hoa Nam</option></select><button class="btn">Tra cứu</button></div>${table(['SKU','Tên','Khả dụng','Đang giữ','Cập nhật cuối'],[['DCH-DRILL-DJZ10A-220V-V1','Máy khoan DJZ10A','18','0','10/08/2026 14:10'],['DCH-GRINDER-DSM02-850W-V1','Máy mài DSM02','7','0','10/08/2026 14:10'],['LK-DCH-PIN-20V-V1','Pin 20V','12','1 cho bảo hành','10/08/2026 14:10']])}`,
  'TRACE-01':()=>`<div class="toolbar"><input class="input search" placeholder="Nhập Item code / Box / Tray / RFID"/><button class="btn">Tra cứu</button></div><div class="grid-2"><div class="card"><div class="section-title">Kết quả truy vết</div><div class="kpi"><span>Mã tra cứu</span><b>ITEM-BC-A001</b></div><div class="kpi"><span>SKU</span><b>DCH-DRILL-DJZ10A-220V-V1</b></div><div class="kpi"><span>Trạng thái hiện tại</span><b>Đang bảo hành</b></div><div class="kpi"><span>RFID</span><b>RFID-E200-000001</b></div></div><div class="card soft"><div class="section-title">Chuỗi nghiệp vụ</div><div class="rule"><span class="dot"></span><span>Receipt từ IN-20260801-003</span></div><div class="rule"><span class="dot"></span><span>Issue từ OUT-20260803-011</span></div><div class="rule"><span class="dot"></span><span>Receive Warranty WAR-20260810-008</span></div></div></div>`,
  'REV-00':()=>`<div class="toolbar"><input class="input search" placeholder="Tìm mã phiếu / movement / SKU"/><select class="select"><option>Loại phiếu: Tất cả</option></select><div class="spacer"></div><button class="btn">Làm mới</button></div>${table(['Chứng từ','Loại','Ngày Post','Nội dung chính','Trạng thái',''],[['OUT-20260802-014','Phiếu xuất','02/08/2026 14:30','DCH-DRILL-DJZ10A-220V-V1 · 1 Item','<span class="pill ok">Có thể Reversal</span>','<button class="btn small" onclick="go(\'REV-01\')">Tạo Reversal</button>'],['IN-20260801-003','Phiếu nhập','01/08/2026 09:00','LK-DCH-PIN-20V-V1 · 20 đơn vị','<span class="pill ok">Có thể Reversal</span>','<button class="btn small" onclick="go(\'REV-01\')">Tạo Reversal</button>'],['OUT-20260728-004','Phiếu xuất','28/07/2026 16:40','DCH-GRINDER-DSM02-850W-V1 · 1 Item','<span class="pill danger-pill">Bị chặn phụ thuộc</span>','Xem lý do']])}<div class="footer-note">Người dùng chọn phiếu từ danh sách này trước khi vào màn Tạo Reversal.</div>`,
  'REV-01':()=>`<div class="grid-2">${card('Phiếu / movement nguồn',field('Loại phiếu','Phiếu xuất')+field('Mã phiếu','OUT-20260802-014')+field('Movement','MOV-ISSUE-000882')+field('SKU','DCH-DRILL-DJZ10A-220V-V1')+field('Số lượng đã Post','1'))}${card('Yêu cầu Reversal',field('Số lượng đảo *','1')+field('Tình trạng trả về *','SELLABLE')+field('Lý do *','Giao nhầm Item')+`<div class="alert">Kết quả kiểm tra phụ thuộc: PASS · reversible_qty = 1</div>`,'soft')}</div><div style="margin-top:14px">${table(['Hiện tại','Reversal','Sau Reversal'],[['Khả dụng = 17','+1','Khả dụng = 18'],['Movement gốc giữ nguyên','Tạo movement đối ứng','Có original_movement_id']])}</div><div class="toolbar" style="margin-top:16px"><button class="btn" onclick="go('REV-00')">Quay lại danh sách phiếu</button><button class="btn danger">Post Reversal</button></div>`,
  'RPT-01':()=>`
    <div class="toolbar-wrap">
      <button class="btn small primary report-tab" onclick="showReport('tonkho',this)">Tồn kho</button>
      <button class="btn small report-tab" onclick="showReport('xnt',this)">Nhập - Xuất - Tồn</button>
      <button class="btn small report-tab" onclick="showReport('request',this)">Đối soát toa</button>
      <button class="btn small report-tab" onclick="showReport('label',this)">Nhật ký nhãn</button>
      <button class="btn small report-tab" onclick="showReport('warranty',this)">Bảo hành & linh kiện</button>
      <button class="btn small report-tab" onclick="showReport('history',this)">Lịch sử nhập / xuất</button>
    </div>
    <div class="card soft">
      <div class="toolbar-wrap"><input class="input" value="01/08/2026"/><span>→</span><input class="input" value="10/08/2026"/><select class="select"><option>Kho tổng Hoa Nam</option></select><button class="btn primary">Áp dụng</button><div class="spacer"></div><button class="btn">Xuất Excel / PDF</button></div>
      <div id="reportArea"></div>
    </div>
    <div class="footer-note">Phần demo sẽ thay đổi ngay khi chọn loại báo cáo.</div>
  `
};

function demoInboundComplete(){
  const scanned=document.getElementById('inScanned'); if(scanned) scanned.textContent='10';
  const label=document.getElementById('inProgressLabel'); if(label) label.textContent='10 / 10';
  const bar=document.getElementById('inProgressBar'); if(bar) bar.style.width='100%';
  const gate=document.getElementById('inGate'); if(gate) gate.style.background='#16a34a';
  const gateText=document.getElementById('inGateText'); if(gateText) gateText.textContent='Đủ 10/10 - Có thể Post.';
  const post=document.getElementById('inPostBtn'); if(post) post.disabled=false;
}
function showReport(type, el){
  document.querySelectorAll('.report-tab').forEach(b=>b.classList.remove('primary'));
  if(el) el.classList.add('primary');
  const area=document.getElementById('reportArea'); if(!area) return;
  const views={
    tonkho: table(['SKU','Tên SKU','Khả dụng','Trạng thái'],[['DCH-DRILL-DJZ10A-220V-V1','Máy khoan DJZ10A','18','Còn hàng'],['DCH-GRINDER-DSM02-850W-V1','Máy mài DSM02','7','Còn hàng'],['LK-DCH-PIN-20V-V1','Pin 20V','12','Còn hàng']]),
    xnt: table(['Ngày','Tồn đầu','Nhập','Xuất','Reversal','Tồn cuối'],[['08/08/2026','120','42','31','0','131'],['09/08/2026','131','80','104','1','108'],['10/08/2026','108','42','31','0','119']]),
    request: table(['Phiếu yêu cầu xuất','Người nhận','Số dòng','Kết quả match','Trạng thái'],[['REQ-20260810-001','Nguyễn Văn A','2','3/3 Item','Đã tạo outbound'],['REQ-20260809-007','Đại lý Minh Anh','4','5/5 Item','Đã Post']]),
    label: table(['Phiếu xuất','Packing_Label','Label_Snapshot','Tổng Item / SKU','Số lần in','Đã dán','Trạng thái'],[['OUT-20260810-005','PKL-OUT-20260810-005','PLS-000005','3 Item / 2 SKU','1','Có','PRINTED'],['OUT-20260809-020','PKL-OUT-20260809-020','PLS-000020','5 Item / 4 SKU','2','Có','REPRINTED']]),
    warranty: table(['Case','Bệnh / lỗi','Linh kiện đã xuất','Trạng thái','Ngày cập nhật'],[['WAR-20260810-008','Không chạy motor','Pin 20V · 1','CHECKING','10/08/2026'],['WAR-20260809-021','Mất mã / không lên nguồn','Chưa xuất','RECEIVED','09/08/2026']]),
    history: table(['Ngày giờ','Loại chứng từ','Mã phiếu','SKU / đối tượng','Biến động'],[['10/08/2026 09:20','Phiếu nhập','IN-20260810-003','DCH-DRILL-DJZ10A-220V-V1','+10'],['10/08/2026 11:10','Phiếu xuất','OUT-20260810-005','DCH-DRILL-DJZ10A-220V-V1','-3'],['10/08/2026 14:00','Reversal','REV-20260810-001','DCH-DRILL-DJZ10A-220V-V1','+1']])
  };
  area.innerHTML = views[type] || views.tonkho;
}

const SCREEN_ROUTE = {
  'MAP-01': ROUTES.DASHBOARD,
  'IAM-01': ROUTES.MASTER_DATA,
  'IAM-02': ROUTES.MASTER_DATA,
  'MST-01': ROUTES.MASTER_DATA,
  'MST-02': ROUTES.MASTER_DATA,
  'AGY-01': ROUTES.MASTER_DATA,
  'AGY-02': ROUTES.MASTER_DATA,
  'DEF-01': ROUTES.MASTER_DATA,
  'DEF-02': ROUTES.MASTER_DATA,
  'IN-01': ROUTES.INBOUND,
  'IN-02': ROUTES.INBOUND,
  'IN-03': ROUTES.INBOUND,
  'PTW-00': ROUTES.PUTAWAY,
  'PTW-01': ROUTES.PUTAWAY,
  'OUT-REQ-01': ROUTES.OUTBOUND,
  'OUT-01': ROUTES.OUTBOUND,
  'OUT-03': ROUTES.OUTBOUND,
  'OUT-02': ROUTES.OUTBOUND,
  'LBL-01': ROUTES.OUTBOUND,
  'RFID-01': ROUTES.OUTBOUND,
  'WAR-01': ROUTES.WARRANTY,
  'WAR-02': ROUTES.WARRANTY,
  'WAR-03': ROUTES.WARRANTY,
  'COMP-01': ROUTES.WARRANTY,
  'INV-01': ROUTES.INVENTORY,
  'TRACE-01': ROUTES.SCAN,
  'REV-00': ROUTES.REVERSE,
  'REV-01': ROUTES.REVERSE,
  'RPT-01': ROUTES.REPORTS,
};

export function MvpSourceScreen({ screenId }) {
  const navigate = useNavigate();
  const html = screens[screenId] ? screens[screenId]() : '<div>Screen not found</div>';

  useEffect(() => {
    window.go = (id) => {
      const route = SCREEN_ROUTE[id] ?? ROUTES.DASHBOARD;
      navigate(`${route}?screen=${id}`);
    };
    window.demoInboundComplete = demoInboundComplete;
    window.showReport = showReport;
    if (screenId === 'RPT-01') window.setTimeout(() => showReport('tonkho'), 0);
  }, [navigate, screenId]);

  return <div className="hn-mvp-source-screen" data-mvp-screen={screenId} dangerouslySetInnerHTML={{ __html: html }} />;
}
