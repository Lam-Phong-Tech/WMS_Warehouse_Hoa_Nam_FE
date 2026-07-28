/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { configure } from '@testing-library/react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { cleanupCreatedQueryClients } from '@/test/test-utils';

// Mock auth store để tránh persist middleware gây lỗi trong test
const mockAuthState = {
  token: null,
  user: null,
  contexts: [] as any[],
  currentContext: null as {
    scope_type?: string;
    org_unit_id?: number | null;
    department_id?: number | null;
    permission_codes?: string[];
  } | null,
  isAuthenticated: false,
  isBootstrapped: true,
  profile: null,
  permissionCodes: [] as string[],
  isSuperAdmin: false,
  isProfileLoaded: false,
};
const initialMockAuthState = { ...mockAuthState };
const mockAuthStore = Object.assign(
  <T,>(selector: (state: typeof mockAuthState) => T) =>
    selector(mockAuthState),
  {
    getState: () => ({
      ...mockAuthState,
      logout: () => {
        Object.assign(mockAuthState, initialMockAuthState);
      },
    }),
    setState: (next: Partial<typeof mockAuthState>) => {
      Object.assign(mockAuthState, next);
    },
    persist: { rehydrate: () => {} },
  },
);

vi.mock('@/shared/store/auth.store', () => ({
  useAuthStore: mockAuthStore,
}));

// vitest 4.x + vite 8: mock http để tránh axios instance truy cập config ở thời điểm module load
vi.mock('@/shared/api/http', () => {
  const createMockHttp = () => {
    const mock = function () {};
    mock.get = vi.fn();
    mock.getPage = vi.fn();
    mock.post = vi.fn();
    mock.put = vi.fn();
    mock.patch = vi.fn();
    mock.delete = vi.fn();
    mock.downloadBlob = vi.fn();
    return mock;
  };
  const http = createMockHttp();
  return { http, default: http };
});

// Mock axios để tránh lỗi 'Cannot read properties of undefined (reading 'config')'
vi.mock('axios', () => {
  const createMockInstance = () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  });
  const mockAxiosInstance = createMockInstance();
  return {
    default: {
      ...mockAxiosInstance,
      create: vi.fn(() => createMockInstance()),
      isAxiosError: vi.fn(() => false),
    },
    ...mockAxiosInstance,
    create: vi.fn(() => createMockInstance()),
    isAxiosError: vi.fn(() => false),
  };
});

// Mock @/shared/api/axios để tránh lỗi module load
vi.mock('@/shared/api/axios', () => {
  const createMockInstance = () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  });
  const api = createMockInstance();
  return { api, default: api };
});

dayjs.extend(customParseFormat);
configure({ asyncUtilTimeout: 10000 });

const mountedImperativeModals = new Set<{
  root: Root;
  container: HTMLElement;
}>();

function showImperativeModal(options: {
  title?: React.ReactNode;
  content?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  okButtonProps?: { danger?: boolean };
  onOk?: () => unknown;
  onCancel?: () => unknown;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const entry = { root, container };
  mountedImperativeModals.add(entry);
  const close = () => {
    mountedImperativeModals.delete(entry);
    root.unmount();
    container.remove();
  };
  const handleOk = () => {
    const result = options.onOk?.();
    if (result && typeof (result as Promise<unknown>).then === 'function')
      (result as Promise<unknown>).then(close).catch(() => {});
    else close();
  };
  const handleCancel = () => {
    options.onCancel?.();
    close();
  };
  root.render(
    React.createElement(
      'div',
      { className: 'ant-modal ant-modal-confirm', role: 'dialog' },
      options.title
        ? React.createElement(
            'div',
            { className: 'ant-modal-confirm-title' },
            options.title,
          )
        : null,
      options.content
        ? React.createElement(
            'div',
            { className: 'ant-modal-confirm-content' },
            options.content,
          )
        : null,
      React.createElement(
        'div',
        { className: 'ant-modal-confirm-btns' },
        React.createElement(
          'button',
          { className: 'ant-btn', type: 'button', onClick: handleCancel },
          options.cancelText ?? 'Hủy',
        ),
        React.createElement(
          'button',
          {
            className: 'ant-btn ant-btn-primary',
            type: 'button',
            onClick: handleOk,
          },
          options.okText ?? 'OK',
        ),
      ),
    ),
  );
  return { destroy: close, update: () => {} };
}

vi.mock('antd', () => {
  const createElementWithTag = (tag: string) => (props: any) => {
    const { children, ...rest } = props ?? {};
    const elementProps = { ...rest } as Record<string, unknown>;
    if (elementProps.className) {
      elementProps.className = String(elementProps.className);
    }
    if (elementProps.disabled) {
      elementProps.disabled = true;
    }
    if (elementProps.checked !== undefined) {
      elementProps.checked = Boolean(elementProps.checked);
    }
    if (elementProps.value !== undefined) {
      elementProps.value = String(elementProps.value);
    }
    if (elementProps.placeholder !== undefined) {
      elementProps.placeholder = String(elementProps.placeholder);
    }
    return React.createElement(tag, elementProps, children ?? null);
  };

  const createButton = (props: any) => {
    const { children, type, ...rest } = props ?? {};
    return React.createElement(
      'button',
      {
        ...rest,
        type: type === 'submit' ? 'submit' : 'button',
      },
      children ?? null,
    );
  };

  const createCheckbox = (props: any) => {
    const { children, checked, disabled, onChange, ...rest } = props ?? {};
    return React.createElement(
      'label',
      null,
      React.createElement('input', {
        ...rest,
        type: 'checkbox',
        checked: Boolean(checked),
        disabled: Boolean(disabled),
        onChange,
      }),
      children ? React.createElement('span', null, children) : null,
    );
  };

  const createInput = (props: any) => {
    const { value, defaultValue, ...rest } = props ?? {};
    return React.createElement('input', {
      ...rest,
      value: value ?? defaultValue ?? '',
    });
  };

  const createSelect = (props: any) => {
    const {
      children,
      value,
      defaultValue,
      options,
      onChange,
      onSelect,
      ...rest
    } = props ?? {};
    const normalizedOptions = Array.isArray(options) ? options : [];
    const selectedValue = value ?? defaultValue ?? '';
    const handleChange = (event: any) => {
      const nextValue = event?.target?.value ?? selectedValue;
      onChange?.(nextValue);
      onSelect?.(nextValue);
    };
    return React.createElement(
      'select',
      {
        ...rest,
        value: selectedValue,
        onChange: handleChange,
        onClick: handleChange,
      },
      normalizedOptions.map((option: any) => {
        const optionValue = option?.value ?? '';
        const optionLabel = option?.label ?? optionValue;
        return React.createElement(
          'option',
          { key: optionValue, value: optionValue },
          optionLabel,
        );
      }),
      children ?? null,
    );
  };

  const createOption = (props: any) => {
    const { children, value, ...rest } = props ?? {};
    return React.createElement(
      'option',
      { ...rest, value: value ?? '' },
      children ?? null,
    );
  };

  const renderWithChildren = (tag: string) => (props: any) => {
    const { children, ...rest } = props ?? {};
    const elementProps = { ...rest } as Record<string, unknown>;
    if (elementProps.className) {
      elementProps.className = String(elementProps.className);
    }
    return React.createElement(tag, elementProps, children ?? null);
  };

  // Statistic — render value + suffix (StatCard truyền value number/string)
  const createStatistic = (props: any) => {
    const { value, prefix, suffix, title, precision } = props ?? {};
    let formatted: React.ReactNode = value;
    if (typeof value === 'number') {
      const fixed =
        precision != null ? value.toFixed(precision) : String(value);
      const [intPart, decPart] = fixed.split('.');
      const intWithGroup = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      formatted = decPart != null ? `${intWithGroup},${decPart}` : intWithGroup;
    }
    return React.createElement(
      'div',
      { className: 'ant-statistic', 'data-testid': 'ant-statistic' },
      title != null
        ? React.createElement(
            'div',
            { className: 'ant-statistic-title' },
            title,
          )
        : null,
      React.createElement(
        'div',
        { className: 'ant-statistic-content' },
        prefix != null
          ? React.createElement(
              'span',
              { className: 'ant-statistic-content-prefix' },
              prefix,
            )
          : null,
        React.createElement(
          'span',
          { className: 'ant-statistic-content-value' },
          formatted,
        ),
        suffix != null
          ? React.createElement(
              'span',
              { className: 'ant-statistic-content-suffix' },
              suffix,
            )
          : null,
      ),
    );
  };

  // Form.Item — render label + children + help/message (test expect text label)
  const createFormItem = (props: any) => {
    const { label, children, help, validateStatus, message, name, ...rest } =
      props ?? {};
    return React.createElement(
      'div',
      {
        className: `ant-form-item${validateStatus ? ` ant-form-item-has-${validateStatus}` : ''}`,
        'data-name': name,
      },
      label != null
        ? React.createElement(
            'label',
            { className: 'ant-form-item-label', htmlFor: rest.htmlFor },
            label,
          )
        : null,
      React.createElement(
        'div',
        { className: 'ant-form-item-control' },
        children ?? null,
      ),
      (message ?? help) != null
        ? React.createElement(
            'div',
            { className: 'ant-form-item-explain', role: 'alert' },
            message ?? help,
          )
        : null,
    );
  };

  // DatePicker — render input có placeholder/format (test expect placeholder dd/mm/yyyy)
  const createDatePicker = (props: any) => {
    const { value, placeholder, format, onChange, ...rest } = props ?? {};
    const ph =
      placeholder ??
      (typeof format === 'string' ? format.toLowerCase() : 'dd/mm/yyyy');
    return React.createElement('input', {
      ...rest,
      type: 'text',
      placeholder: ph,
      value: value ?? '',
      onChange: (e: any) => onChange?.(e?.target?.value, e),
    });
  };

  const stub = (props: any) => (props?.children ? props.children : null);
  const voidStub = () => null;
  return {
    default: voidStub,
    ConfigProvider: Object.assign(voidStub, {
      config: {},
      theme: { config: {} },
    }),
    Button: createButton,
    Grid: Object.assign(stub, { useBreakpoint: () => ({}) }),
    Layout: Object.assign(stub, {
      Sider: stub,
      Content: stub,
      Header: stub,
      Footer: stub,
    }),
    theme: {
      useToken: () => ({ token: {} }),
      defaultAlgorithm: {},
      darkAlgorithm: {},
      config: {},
    },
    Menu: stub,
    Breadcrumb: stub,
    Avatar: stub,
    Dropdown: ({ menu, disabled, placement }: any) => {
      const [open, setOpen] = React.useState(false);
      const handleClick = () => {
        if (disabled) return;
        setOpen((prev) => !prev);
      };
      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handleClick,
            title: 'Thao tác',
            'data-placement': placement,
            'data-testid': 'action-dropdown-trigger',
          },
          open ? '▾' : '⋯',
        ),
        open && menu?.items
          ? React.createElement(
              'div',
              { role: 'menu' },
              menu.items.map((item: any, index: number) =>
                React.createElement(
                  'button',
                  {
                    key: item.key ?? index,
                    type: 'button',
                    role: 'menuitem',
                    onClick: item.onClick,
                    title: item.label,
                  },
                  item.label,
                ),
              ),
            )
          : null,
      );
    },
    Space: renderWithChildren('div'),
    Typography: Object.assign(stub, {
      Text: renderWithChildren('span'),
      Title: renderWithChildren('h1'),
      Paragraph: renderWithChildren('p'),
    }),
    Tooltip: ({ children }: any) =>
      React.createElement(React.Fragment, null, children ?? null),
    Table: Object.assign(
      ({ columns, dataSource, rowSelection, locale, ...rest }: any) => {
        const rows = Array.isArray(dataSource) ? dataSource : [];
        const getValue = (record: any, dataIndex?: string) => {
          if (!dataIndex) return undefined;
          if (typeof dataIndex === 'string') {
            const parts = dataIndex.split('.');
            let current: any = record;
            for (const part of parts) {
              if (current == null) return undefined;
              current = current[part];
            }
            return current;
          }
          return undefined;
        };
        const emptyText = locale?.emptyText ?? 'Không có dữ liệu';
        return React.createElement(
          'div',
          { role: 'table', ...rest },
          rows.length === 0
            ? React.createElement(
                'div',
                { role: 'empty' },
                typeof emptyText === 'string'
                  ? emptyText
                  : React.createElement(React.Fragment, null, emptyText),
              )
            : rows.map((record: any, rowIndex: number) => {
                const rowKey = record?.id ?? rowIndex;
                return React.createElement(
                  'div',
                  { key: rowKey, role: 'row' },
                  rowSelection
                    ? React.createElement('div', { key: 'selection' }, '✓')
                    : null,
                  (columns ?? []).map((column: any, columnIndex: number) => {
                    const value = getValue(record, column?.dataIndex);
                    const content =
                      typeof column?.render === 'function'
                        ? column.render(value, record, rowIndex)
                        : value;
                    return React.createElement(
                      'div',
                      { key: column?.key ?? column?.dataIndex ?? columnIndex },
                      content ?? null,
                    );
                  }),
                );
              }),
        );
      },
      {
        Column: stub,
        ColumnGroup: stub,
        Summary: stub,
      },
    ),
    Modal: Object.assign(
      ({ open, title, children, footer }: any) => {
        if (!open) return null;
        return React.createElement(
          'div',
          { className: 'ant-modal', role: 'dialog' },
          title
            ? React.createElement(
                'div',
                { className: 'ant-modal-title' },
                title,
              )
            : null,
          React.createElement(
            'div',
            { className: 'ant-modal-body' },
            children ?? null,
          ),
          footer !== null
            ? React.createElement(
                'div',
                { className: 'ant-modal-footer' },
                footer ?? null,
              )
            : null,
        );
      },
      {
        confirm: showImperativeModal,
        info: showImperativeModal,
        success: showImperativeModal,
        error: showImperativeModal,
        warning: showImperativeModal,
        destroyAll: () => {},
      },
    ),
    Form: Object.assign(stub, {
      Item: createFormItem,
      List: stub,
      Provider: stub,
      useForm: () => [{}],
      useWatch: () => undefined,
    }),
    Input: Object.assign(createInput, {
      Password: createInput,
      TextArea: createElementWithTag('textarea'),
      Search: createInput,
      Group: stub,
    }),
    Select: Object.assign(createSelect, {
      Option: createOption,
      OptGroup: stub,
    }),
    DatePicker: Object.assign(createDatePicker, { RangePicker: stub }),
    Spin: stub,
    Tag: ({ children, color, ...rest }: any) =>
      React.createElement(
        'span',
        { className: `ant-tag${color ? ` ant-tag-${color}` : ''}`, ...rest },
        children ?? null,
      ),
    Badge: stub,
    Empty: Object.assign(
      ({ description, children }: any) =>
        React.createElement(
          'div',
          null,
          description ? React.createElement('div', null, description) : null,
          children ?? null,
        ),
      {
        PRESENTED_IMAGE_SIMPLE: 'simple',
        PRESENTED_IMAGE_DEFAULT: 'default',
      },
    ),
    Alert: ({ message, description, children }: any) =>
      React.createElement(
        'div',
        null,
        message ? React.createElement('div', null, message) : null,
        description ? React.createElement('div', null, description) : null,
        children ?? null,
      ),
    Skeleton: ({ children }: any) =>
      React.createElement('div', null, children ?? 'Loading...'),
    Card: Object.assign(
      ({ title, children, ...rest }: any) =>
        React.createElement(
          'div',
          rest,
          title ? React.createElement('div', null, title) : null,
          children ?? null,
        ),
      { Grid: stub, Meta: stub },
    ),
    Row: stub,
    Col: stub,
    Divider: stub,
    Tabs: Object.assign(stub, { TabPane: stub }),
    Descriptions: Object.assign(stub, { Item: stub }),
    List: Object.assign(stub, { Item: Object.assign(stub, { Meta: stub }) }),
    Checkbox: Object.assign(createCheckbox, { Group: stub }),
    Radio: Object.assign(stub, { Group: stub, Button: stub }),
    Switch: createElementWithTag('input'),
    Slider: stub,
    Upload: Object.assign(stub, { Dragger: stub, LIST_IGNORE: 'LIST_IGNORE' }),
    Rate: stub,
    Progress: stub,
    Timeline: stub,
    Collapse: Object.assign(stub, { Panel: stub }),
    Carousel: stub,
    Calendar: stub,
    Image: stub,
    QRCode: stub,
    Watermark: stub,
    Segmented: ({ options, value, onChange }: any) =>
      React.createElement(
        'div',
        null,
        (options ?? []).map((option: any) =>
          React.createElement(
            'button',
            {
              key: option.value,
              type: 'button',
              onClick: () => onChange?.(option.value),
              'data-active': value === option.value,
            },
            option.label ?? option.value,
          ),
        ),
      ),
    FloatButton: stub,
    Result: stub,
    Steps: Object.assign(stub, { Step: stub }),
    AutoComplete: stub,
    Cascader: stub,
    ColorPicker: stub,
    InputNumber: stub,
    Mentions: stub,
    TimePicker: stub,
    Transfer: stub,
    TreeSelect: stub,
    Tree: Object.assign(
      ({ treeData, children, onSelect, selectedKeys, ...rest }: any) => {
        const nodes = Array.isArray(treeData) ? treeData : [];
        const renderNode = (node: any, depth = 0) => {
          const key =
            node?.key ??
            node?.id ??
            `${depth}-${node?.title ?? node?.name ?? 'node'}`;
          const label =
            node?.title ?? node?.label ?? node?.name ?? node?.key ?? 'node';
          const isSelected = Array.isArray(selectedKeys)
            ? selectedKeys.includes(key)
            : false;
          return React.createElement(
            'div',
            { key, style: { marginLeft: depth * 12 } },
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => onSelect?.([key], node),
                'data-selected': isSelected ? 'true' : 'false',
              },
              label,
            ),
            Array.isArray(node?.children) && node.children.length > 0
              ? React.createElement(
                  'div',
                  null,
                  node.children.map((child: any) =>
                    renderNode(child, depth + 1),
                  ),
                )
              : null,
          );
        };
        return React.createElement(
          'div',
          { className: 'ant-tree', role: 'tree', ...rest },
          children ?? null,
          nodes.map((node: any) => renderNode(node)),
        );
      },
      {
        TreeNode: stub,
      },
    ),
    _ActionDropdown: stub,
    Affix: stub,
    Anchor: stub,
    BackTop: stub,
    Drawer: ({
      open,
      title,
      children,
      placement = 'right',
      size,
      afterOpenChange,
      destroyOnClose,
      footer,
      extra,
    }: any) => {
      React.useEffect(() => {
        afterOpenChange?.(Boolean(open));
      }, [open, afterOpenChange]);

      if (!open && destroyOnClose) return null;
      const width = typeof size === 'number' ? `${size}px` : (size ?? '520px');
      const drawerStyle =
        placement === 'left' || placement === 'right'
          ? { width, maxWidth: '100%' }
          : { width: '100%' };
      return React.createElement(
        'div',
        { className: 'ant-drawer', style: drawerStyle },
        React.createElement(
          'div',
          { className: 'ant-drawer-title' },
          title ?? null,
        ),
        extra
          ? React.createElement('div', { className: 'ant-drawer-extra' }, extra)
          : null,
        React.createElement(
          'div',
          { className: 'ant-drawer-body' },
          children ?? null,
        ),
        footer
          ? React.createElement(
              'div',
              { className: 'ant-drawer-footer' },
              footer,
            )
          : null,
      );
    },
    Pagination: stub,
    Popconfirm: stub,
    Statistic: createStatistic,
    config: { getPrefixCls: () => 'ant', prefixCls: 'ant' },
    version: '5.x',
    App: Object.assign(stub, {
      useApp: () => ({
        message: {},
        notification: {},
        modal: {
          confirm: showImperativeModal,
        },
      }),
    }),
    Flex: stub,
    message: {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      loading: () => {},
      destroy: () => {},
    },
    notification: {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      open: () => {},
      destroy: () => {},
    },
  };
});

vi.mock('rc-util', () => {
  const stub = () => null;
  return {
    default: stub,
    get: stub,
    set: stub,
    warning: () => {},
    warningOnce: () => {},
    canUseDom: () => false,
    dom: { canUseDom: () => false },
    KeyCode: { ENTER: 13, TAB: 9 },
    getContainer: (c: any) => (typeof c === 'function' ? c() : c),
    isBrowser: () => false,
    isCSSSupport: () => false,
    supportRef: () => false,
    composeRef: () => {},
    fillRef: () => {},
    useRef: () => {},
    useComposeRef: () => {},
    contains: () => false,
    getScrollBarSize: () => 0,
    setStyle: () => {},
    removeStyle: () => {},
    detectFlexGapSupported: () => false,
    requestAnimationFrame: (cb: any) => setTimeout(cb, 16),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    raf: { default: (cb: any) => setTimeout(cb, 16) },
    _supportsPassive: false,
  };
});

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
    loading: () => {},
    dismiss: () => {},
    custom: () => {},
  },
}));

vi.mock('@ant-design/icons', () => {
  const stub = () => null;
  const icons: Record<string, any> = {};
  'AimOutlined ApartmentOutlined AppstoreOutlined ArrowRightOutlined AuditOutlined BankOutlined BarChartOutlined BellOutlined CarOutlined CheckCircleOutlined CheckOutlined CloseCircleOutlined CloseOutlined ClusterOutlined CopyOutlined DeleteOutlined DownOutlined DownloadOutlined EditOutlined EnvironmentOutlined ExclamationCircleFilled ExpandAltOutlined ExportOutlined EyeOutlined FileExcelOutlined FilePdfOutlined FileSearchOutlined FileTextOutlined FundOutlined HomeOutlined IdcardOutlined ImportOutlined InboxOutlined KeyOutlined LockOutlined LogoutOutlined MailOutlined MenuFoldOutlined MenuUnfoldOutlined NodeIndexOutlined PlayCircleOutlined PlusOutlined ProfileOutlined ReloadOutlined RollbackOutlined SafetyCertificateOutlined SaveOutlined SearchOutlined SendOutlined SettingOutlined ShopOutlined ShoppingCartOutlined ShrinkOutlined SolutionOutlined StockOutlined StopOutlined SwapOutlined SyncOutlined TeamOutlined UndoOutlined UnorderedListOutlined UploadOutlined UserAddOutlined UserOutlined UserSwitchOutlined ZoomInOutlined ZoomOutOutlined'
    .split(' ')
    .forEach((n) => (icons[n] = stub));
  return { default: stub, ...icons };
});

vi.mock('@/modules/auth/utils/permission', () => ({
  usePermissionState: () => {
    const authState = mockAuthStore.getState();
    return {
      isSuperAdmin: authState.isSuperAdmin,
      permissionCodes: authState.permissionCodes,
      currentScopeType:
        (authState.currentContext?.scope_type as string | undefined) ??
        'he_thong',
      currentOrgUnitId: authState.currentContext?.org_unit_id ?? null,
      currentDepartmentId: authState.currentContext?.department_id ?? null,
    };
  },
  hasPermission: (
    code: string,
    state?: { permissionCodes?: string[]; isSuperAdmin?: boolean },
  ) => {
    const permissionCodes = state?.permissionCodes ?? [];
    return Boolean(state?.isSuperAdmin || permissionCodes.includes(code));
  },
  useCan: () => true,
}));

vi.mock('@/app/router/access', () => ({
  ROUTE_PERMISSIONS: {
    '/org-units': 'ORG_VIEW',
    '/departments': 'DEPT_VIEW',
    '/employees': 'EMP_VIEW',
    '/positions': 'POS_VIEW',
    '/roles': 'ROLE_VIEW',
    '/org-chart': 'ORG_VIEW',
    '/employee-status': 'EMP_VIEW',
    '/employee-assignments': 'EMP_ASSIGNMENT_VIEW',
    '/user-role-scopes': ['ROLE_ASSIGN', 'SCOPE_CONFIG'],
    '/tasks': 'TASK_VIEW',
    '/warehouse': 'WAREHOUSE_VIEW',
    '/warehouses': 'WAREHOUSE_VIEW',
    '/stock-receipts': 'STOCK_RECEIPT_VIEW',
    '/stock-issues': 'STOCK_ISSUE_VIEW',
    '/stock-transfers': 'STOCK_TRANSFER_VIEW',
    '/inventory-balance': 'INVENTORY_VIEW',
    '/stock-movements': 'STOCK_MOVEMENT_VIEW',
    '/business': 'BUSINESS_VIEW',
    '/products': 'PRODUCT_VIEW',
    '/price-lists': 'PRICE_LIST_VIEW',
    '/customers': 'CUSTOMER_VIEW',
    '/sales-orders': 'SALES_ORDER_VIEW',
    '/sales-channels': 'SALES_CHANNEL_VIEW',
    '/audit-logs': 'AUDIT_LOG_VIEW',
  },
}));

vi.mock('@/shared/hooks/usePermission', () => {
  const resolveCan = (context: {
    module?: string;
    action?: string;
    permissionCode?: string;
  }) => {
    const state = mockAuthStore.getState() as {
      isSuperAdmin: boolean;
      permissionCodes: string[];
      currentContext: { scope_type?: string } | null;
    };
    const { isSuperAdmin, permissionCodes, currentContext } = state;
    // Simple permission check without importing types
    const code =
      context.permissionCode ??
      (context.action && context.module
        ? `${context.action.toUpperCase()}_${context.module.toUpperCase()}`
        : (context.module ?? '').toUpperCase());
    const hasCodePermission = isSuperAdmin || permissionCodes.includes(code);
    // Simple scope check - just check if super admin
    const scopePassed = isSuperAdmin || !!currentContext?.scope_type;
    return hasCodePermission && scopePassed;
  };
  return {
    usePermission: (context: {
      module?: string;
      action?: string;
      permissionCode?: string;
      mode?: 'hide' | 'disable';
    }) => {
      const can = resolveCan(context);
      const mode = context.mode ?? 'hide';
      return {
        can,
        mode,
        isHidden: mode === 'hide' && !can,
        isDisabled: mode === 'disable' && !can,
        permissionCode: context.permissionCode ?? '',
      };
    },
    useCanAll: (codes: string[]) => {
      const { isSuperAdmin, permissionCodes } = mockAuthStore.getState();
      return codes.every((c) => isSuperAdmin || permissionCodes.includes(c));
    },
    useCanAny: (codes: string[]) => {
      const { isSuperAdmin, permissionCodes } = mockAuthStore.getState();
      return codes.some((c) => isSuperAdmin || permissionCodes.includes(c));
    },
  };
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  try {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: {
        ...window.location,
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
        href: window.location.href,
      },
    });
  } catch {
    /* safe */
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// KHÔNG dùng afterEach / vi.afterEach trong setup file vì vitest 4 chạy setup file trong global context.
// Mỗi test file tự import cleanupTestState trong afterEach của riêng nó.

export function cleanupTestState() {
  if (mountedImperativeModals.size === 0) return;
  for (const { root, container } of mountedImperativeModals) {
    root.unmount();
    container.remove();
  }
  mountedImperativeModals.clear();
  cleanupCreatedQueryClients();
}
