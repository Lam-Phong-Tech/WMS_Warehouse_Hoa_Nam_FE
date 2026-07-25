import { useState } from 'react';
import { Button, Card, Form, Input, Space, Typography } from 'antd';
import { toast } from 'sonner';
import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import axios from 'axios';
import {
  extractFieldErrors,
  getApiErrorMessage,
  getErrorRequestId,
  getMutationErrorMessage,
  isConflictError,
  isNoPermissionError,
} from '@/shared/api/api-error';
import { ApiErrorAlert } from '@/shared/components/feedback/ApiErrorAlert';

const { Title, Paragraph, Text } = Typography;

/**
 * Demo page showcasing standardized API error handling.
 *
 * This page demonstrates:
 * - 401 Unauthorized → redirect to login
 * - 403 Forbidden → no-permission state
 * - 422 Validation Error → field-level error display
 * - 409 Conflict → business rule conflict
 * - Generic errors → user-friendly messages
 */
export function ApiErrorDemoPage() {
  const [form] = Form.useForm();

  const [testResults, setTestResults] = useState<
    Array<{
      type: string;
      message: string;
      timestamp: Date;
      httpStatus?: number;
      requestId?: string;
      rawResponse?: unknown;
    }>
  >([]);
  // Lỗi 403 gần nhất - render qua ApiErrorAlert để chứng minh UI thật (không chỉ toast).
  const [lastPermissionError, setLastPermissionError] = useState<unknown>(null);

  const addResult = (type: string, message: string, error?: unknown) => {
    const httpStatus = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    const requestId = getErrorRequestId(error);
    const rawResponse = axios.isAxiosError(error)
      ? error.response?.data
      : undefined;
    setTestResults((prev) => [
      ...prev,
      {
        type,
        message,
        timestamp: new Date(),
        httpStatus,
        requestId,
        rawResponse,
      },
    ]);
  };

  // Demo 1: 401 Unauthorized — gọi /auth/me với token không hợp lệ.
  // Dùng axios trần (không qua `api`/`http`) vì request interceptor trong axios.ts
  // luôn tự gắn đè token thật đang có trong memoryStorage lên mọi request, nên gọi
  // qua `http.get` với header Authorization giả sẽ bị ghi đè và không tạo được 401 thật.
  const test401 = async () => {
    try {
      await axios.get(`${import.meta.env.VITE_API_URL}${API_ENDPOINTS.ME}`, {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer invalid-token-for-demo',
        },
      });
      addResult('401', 'Unexpected success - user is authenticated');
    } catch (error) {
      const msg = getApiErrorMessage(error);
      addResult('401', msg, error);
      toast.error(msg);
    }
  };

  // Demo 2: 403 Forbidden — gọi webhook M2→M3 mà không kèm header X-Webhook-Secret.
  // Endpoint này xác thực bằng secret riêng (không phải Bearer token), nên trả 403
  // FORBIDDEN ổn định theo contract thật của BE (đã verify trên staging), không phụ
  // thuộc việc tài khoản demo có quyền gì hay không.
  const test403 = async () => {
    try {
      await http.post(API_ENDPOINTS.WEBHOOKS_M2_ORDER_PROCESSING, {
        order_no: 'SO-DEMO-0001',
      });
      addResult('403', 'Unexpected success - webhook secret not enforced');
    } catch (error) {
      const msg = getMutationErrorMessage(error);
      addResult('403', msg, error);

      if (isNoPermissionError(error)) {
        setLastPermissionError(error);
        toast.error('🔒 No Permission', {
          description: msg,
          duration: 5000,
        });
      } else {
        toast.error(msg);
      }
    }
  };

  // Demo 3: 422 Validation Error (submit form with invalid data)
  const test422 = async (values: {
    name?: string;
    email?: string;
    tax_code?: string;
  }) => {
    try {
      // Try to create an org unit with invalid data
      await http.post(API_ENDPOINTS.ORG_UNITS, {
        name: values.name || '',
        email: values.email || 'invalid-email',
        tax_code: values.tax_code || 'invalid',
        unit_type: 'invalid-type',
      });
      addResult('422', 'Unexpected success - validation passed');
    } catch (error) {
      const msg = getApiErrorMessage(error);
      addResult('422', msg, error);

      // Extract field-level errors
      const fieldErrors = extractFieldErrors(error);
      if (fieldErrors) {
        toast.error('Validation Failed', {
          description: `Field errors: ${JSON.stringify(fieldErrors, null, 2)}`,
          duration: 5000,
        });
      } else {
        toast.error(msg);
      }
    }
  };

  // Demo 4: 409 Conflict — lấy code phòng ban đầu tiên đang tồn tại rồi tạo mới
  // với đúng code đó. Contract POST /departments trả 409 DUPLICATE_RESOURCE khi
  // trùng mã (đã verify trên staging), khác với /org_units trả 422 cho cùng lỗi
  // trùng mã — nên không thể tái dùng ORG_UNITS cho case này.
  const test409 = async () => {
    try {
      const departments = await http.get<
        Array<{ code: string; org_unit_id: number }>
      >(API_ENDPOINTS.DEPARTMENTS, { params: { per_page: 1 } });
      const existing = departments[0];
      if (!existing) {
        addResult('409', 'Không có phòng ban nào để test trùng mã.');
        return;
      }

      await http.post(API_ENDPOINTS.DEPARTMENTS, {
        code: existing.code,
        name: 'Demo Duplicate Department',
        org_unit_id: existing.org_unit_id,
        department_type: 'phong_ban',
      });
      addResult('409', 'Unexpected success - no conflict');
    } catch (error) {
      const msg = getApiErrorMessage(error);
      addResult('409', msg, error);

      if (isConflictError(error)) {
        toast.error('⚠️ Conflict', {
          description: msg,
          duration: 5000,
        });
      } else {
        toast.error(msg);
      }
    }
  };

  // Demo 5: Network Error
  const testNetworkError = async () => {
    try {
      // Use an invalid URL to simulate network error
      await http.get('http://invalid-url-that-will-fail.com/api/test');
      addResult('Network', 'Unexpected success');
    } catch (error) {
      const msg = getApiErrorMessage(error);
      addResult('Network', msg, error);
      toast.error('Network Error', {
        description: msg,
        duration: 5000,
      });
    }
  };

  // Demo 6: Timeout Error
  const testTimeout = async () => {
    try {
      // Request with very short timeout
      await http.get(API_ENDPOINTS.ORG_UNITS, {
        timeout: 1, // 1ms timeout
      });
      addResult('Timeout', 'Unexpected success');
    } catch (error) {
      const msg = getApiErrorMessage(error);
      addResult('Timeout', msg, error);
      toast.error('Timeout', {
        description: msg,
        duration: 5000,
      });
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>API Error Handling Demo</Title>
      <Paragraph>
        This page demonstrates the standardized API client error handling
        system. Each button triggers a different error scenario to show how the
        system handles various HTTP status codes and error types.
      </Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Error Testing Section */}
        <Card title="Error Scenario Testing" size="small">
          <Space wrap>
            <Button onClick={test401} danger>
              Test 401 Unauthorized
            </Button>
            <Button onClick={test403} danger>
              Test 403 Forbidden
            </Button>
            <Button onClick={test409} danger>
              Test 409 Conflict
            </Button>
            <Button onClick={testNetworkError} danger>
              Test Network Error
            </Button>
            <Button onClick={testTimeout} danger>
              Test Timeout
            </Button>
          </Space>

          <div style={{ marginTop: 16 }}>
            <Title level={5}>Test 422 Validation Error (with form):</Title>
            <Form
              form={form}
              layout="inline"
              onFinish={(values) => test422(values)}
            >
              <Form.Item name="name" label="Name">
                <Input placeholder="Leave empty to fail" />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input placeholder="Enter invalid email" />
              </Form.Item>
              <Form.Item name="tax_code" label="Tax Code">
                <Input placeholder="Enter invalid tax code" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" danger>
                  Submit Invalid Data
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Card>

        {/* 403 UI State - chứng minh render thật qua ApiErrorAlert, không chỉ toast */}
        {Boolean(lastPermissionError) && (
          <Card title="403 - No Permission State (UI thật)" size="small">
            <ApiErrorAlert error={lastPermissionError} onRetry={test403} />
          </Card>
        )}

        {/* Test Results Section */}
        <Card
          title="Test Results"
          size="small"
          extra={
            <Button onClick={clearResults} size="small">
              Clear
            </Button>
          }
        >
          {testResults.length === 0 ? (
            <Paragraph type="secondary">
              No tests run yet. Click a button above to test error handling.
            </Paragraph>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {testResults.map((result, index) => (
                <Card
                  key={index}
                  size="small"
                  type="inner"
                  style={{
                    borderLeft:
                      result.type === '401'
                        ? '3px solid #ff4d4f'
                        : result.type === '403'
                          ? '3px solid #faad14'
                          : result.type === '422'
                            ? '3px solid #1890ff'
                            : result.type === '409'
                              ? '3px solid #722ed1'
                              : '3px solid #d9d9d9',
                  }}
                >
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: '100%' }}
                  >
                    <Space wrap>
                      <Text strong>{result.type}:</Text>
                      {result.httpStatus !== undefined && (
                        <Text code>HTTP {result.httpStatus}</Text>
                      )}
                      <Text>{result.message}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {result.timestamp.toLocaleTimeString()}
                      </Text>
                    </Space>
                    {result.requestId && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        request_id: {result.requestId}
                      </Text>
                    )}
                    {Boolean(result.rawResponse) && (
                      <pre
                        style={{
                          fontSize: 11,
                          background: '#f5f5f5',
                          padding: 8,
                          borderRadius: 4,
                          maxHeight: 160,
                          overflow: 'auto',
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(result.rawResponse, null, 2)}
                      </pre>
                    )}
                  </Space>
                </Card>
              ))}
            </Space>
          )}
        </Card>

        {/* Documentation Section */}
        <Card title="Error Handling Documentation" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Title level={5}>401 Unauthorized</Title>
              <Paragraph>
                Token is invalid or expired. The interceptor automatically logs
                out the user and redirects to the login page.
              </Paragraph>
            </div>

            <div>
              <Title level={5}>403 Forbidden</Title>
              <Paragraph>
                User lacks permission to access the resource. The UI should
                display a "no-permission" state with a friendly message.
              </Paragraph>
              <Text code>isNoPermissionError()</Text> - Check if error is 403
            </div>

            <div>
              <Title level={5}>422 Validation Error</Title>
              <Paragraph>
                Request data failed validation. The response includes
                field-level errors that can be displayed inline in forms.
              </Paragraph>
              <Text code>extractFieldErrors()</Text> - Extract field errors
              <br />
              <Text code>isValidationError()</Text> - Check if error is 422
            </div>

            <div>
              <Title level={5}>409 Conflict</Title>
              <Paragraph>
                Business rule conflict (e.g., duplicate entry, state transition
                not allowed).
              </Paragraph>
              <Text code>isConflictError()</Text> - Check if error is 409
            </div>

            <div>
              <Title level={5}>Generic Errors</Title>
              <Paragraph>
                Network errors, timeouts, and other unexpected errors are
                handled with user-friendly messages.
              </Paragraph>
              <Text code>getApiErrorMessage()</Text> - Get user-friendly error
              message
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
