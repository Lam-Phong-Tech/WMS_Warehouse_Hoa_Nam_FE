import { describe, it, expect } from 'vitest';
import { getBreadcrumb, getOpenKeys, getSelectedKey } from '@/app/layouts/menu';
import { ROUTES } from '@/shared/constants/routes';

// P2: active menu/breadcrumb phải khớp đúng mục cha khi vào sub-route sâu
// (vd. chi tiết/edit dưới 1 route danh sách), không chỉ khi path khớp chính xác.
describe('getSelectedKey — exact route và sub-route', () => {
  it('highlight đúng mục cha khi path là sub-route (vd /org-units/123/edit)', () => {
    expect(getSelectedKey(`${ROUTES.ORG_UNITS}/123/edit`)).toBe(
      ROUTES.ORG_UNITS,
    );
  });

  it('path khớp chính xác vẫn trả về đúng key', () => {
    expect(getSelectedKey(ROUTES.EMPLOYEES)).toBe(ROUTES.EMPLOYEES);
  });

  it('path không khớp mục nào → trả nguyên pathname', () => {
    expect(getSelectedKey('/khong-ton-tai')).toBe('/khong-ton-tai');
  });

  it('sub-route sâu của warehouse → highlight đúng mục con', () => {
    expect(getSelectedKey(`${ROUTES.STOCK_RECEIPTS}/123`)).toBe(
      ROUTES.STOCK_RECEIPTS,
    );
  });

  it('sub-route của business module → highlight đúng mục con', () => {
    expect(getSelectedKey(`${ROUTES.CUSTOMERS}/456/orders`)).toBe(
      ROUTES.CUSTOMERS,
    );
  });

  it('không khớp nhầm do tiền tố chuỗi (/warehouse vs /warehouses/1)', () => {
    expect(getSelectedKey(`${ROUTES.WAREHOUSES}/1`)).toBe(ROUTES.WAREHOUSES);
  });
});

describe('getOpenKeys — exact route và sub-route', () => {
  it('mở đúng submenu cha khi vào sub-route sâu', () => {
    expect(getOpenKeys(`${ROUTES.EMPLOYEES}/456/history`)).toEqual(['org']);
  });

  it('path không thuộc submenu nào → không mở gì', () => {
    expect(getOpenKeys('/khong-ton-tai')).toEqual([]);
  });

  it('mở đúng submenu warehouse cho sub-route kho', () => {
    expect(getOpenKeys(`${ROUTES.STOCK_ISSUES}/789`)).toEqual(['warehouse']);
  });

  it('mở đúng submenu business cho sub-route khách hàng', () => {
    expect(getOpenKeys(`${ROUTES.SALES_ORDERS}/100`)).toEqual(['business']);
  });
});

describe('getBreadcrumb — exact route và sub-route', () => {
  it('sinh breadcrumb 2 cấp (nhóm > mục) cho sub-route sâu', () => {
    expect(getBreadcrumb(`${ROUTES.DEPARTMENTS}/789`)).toEqual([
      { label: 'Module 1 · Tổ chức' },
      { label: 'Phòng ban', path: ROUTES.DEPARTMENTS },
    ]);
  });

  it('path không khớp mục nào → breadcrumb rỗng', () => {
    expect(getBreadcrumb('/khong-ton-tai')).toEqual([]);
  });

  it('breadcrumb cho exact route /employees', () => {
    expect(getBreadcrumb(ROUTES.EMPLOYEES)).toEqual([
      { label: 'Module 1 · Tổ chức' },
      { label: 'Nhân viên', path: ROUTES.EMPLOYEES },
    ]);
  });

  it('breadcrumb cho sub-route warehouse', () => {
    expect(getBreadcrumb(`${ROUTES.WAREHOUSES}/1`)).toEqual([
      { label: 'Module 2 · Kho' },
      { label: 'Kho hàng', path: ROUTES.WAREHOUSES },
    ]);
  });

  it('breadcrumb cho sub-route business', () => {
    expect(getBreadcrumb(`${ROUTES.PRODUCTS}/abc`)).toEqual([
      { label: 'Module 3 · Kinh doanh' },
      { label: 'Sản phẩm', path: ROUTES.PRODUCTS },
    ]);
  });
});
