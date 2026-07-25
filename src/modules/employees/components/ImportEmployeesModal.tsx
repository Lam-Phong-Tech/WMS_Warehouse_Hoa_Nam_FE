import { useState } from 'react';
import { Alert, Button, Modal, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { useImportEmployeesExcel } from '@/modules/employees/hooks/use-employees';

const { Dragger } = Upload;

const ACCEPTED_IMPORT_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const resultWrapperStyle: React.CSSProperties = { marginTop: 16 };
const errorListStyle: React.CSSProperties = {
  paddingLeft: 16,
  margin: '4px 0 0 0',
};

export interface ImportEmployeesModalProps {
  open: boolean;
  onCancel: () => void;
  /** Gọi sau khi import xong (kể cả khi có lỗi từng dòng) để đóng modal/refetch nếu cần. */
  onDone?: () => void;
}

/**
 * Import danh sách nhân sự từ file Excel.
 * API thật: POST /employees/import-excel (multipart, field `file`) — xác nhận qua
 * Swagger, response `{ created, errors[] }` với `errors` là lỗi theo từng dòng
 * (import từng phần, không chặn dòng hợp lệ khác). Nút tải file mẫu
 * (GET /employees/import-template) nằm riêng ở toolbar `EmployeesPage`, không
 * lặp lại trong modal này.
 */
export function ImportEmployeesModal({
  open,
  onCancel,
  onDone,
}: ImportEmployeesModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [result, setResult] = useState<{
    created: number;
    errors: string[];
  } | null>(null);
  const importMutation = useImportEmployeesExcel();

  const handleAfterClose = () => {
    setFileList([]);
    setResult(null);
  };

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      // `accept` chỉ là gợi ý ở dialog chọn file, không chặn được kéo-thả file
      // sai định dạng hoặc file đổi đuôi thủ công — phải tự kiểm tra MIME/size thật.
      if (!ACCEPTED_IMPORT_TYPES.includes(file.type)) {
        toast.error('Chỉ chấp nhận file Excel (.xlsx, .xls)');
        return Upload.LIST_IGNORE;
      }
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        toast.error('File Excel phải ≤ 5MB');
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      setResult(null);
      return false; // không tự upload — submit thủ công qua nút "Import"
    },
    onRemove: () => {
      setFileList([]);
      setResult(null);
    },
  };

  const handleImport = () => {
    const file = fileList[0]?.originFileObj ?? (fileList[0] as unknown as File);
    if (!file) return;
    importMutation.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        if (data.errors.length === 0) {
          toast.success(`Import thành công ${data.created} nhân sự`);
        } else {
          toast.warning(
            `Import xong: ${data.created} nhân sự thành công, ${data.errors.length} dòng lỗi`,
          );
        }
        onDone?.();
      },
      onError: (err) => {
        toast.error('Import thất bại: ' + getApiErrorMessage(err));
      },
    });
  };

  return (
    <Modal
      open={open}
      title="Import nhân sự từ Excel"
      onCancel={onCancel}
      afterClose={handleAfterClose}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Đóng
        </Button>,
        <Button
          key="import"
          type="primary"
          disabled={fileList.length === 0}
          loading={importMutation.isPending}
          onClick={handleImport}
        >
          Import
        </Button>,
      ]}
    >
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Kéo thả hoặc bấm để chọn file Excel (.xlsx, .xls)
        </p>
      </Dragger>

      {result && (
        <div style={resultWrapperStyle}>
          <Alert
            type={result.errors.length === 0 ? 'success' : 'warning'}
            showIcon
            message={`Đã import ${result.created} nhân sự thành công${
              result.errors.length > 0
                ? `, ${result.errors.length} dòng lỗi`
                : ''
            }`}
            description={
              result.errors.length > 0 ? (
                <ul style={errorListStyle}>
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        </div>
      )}
    </Modal>
  );
}
