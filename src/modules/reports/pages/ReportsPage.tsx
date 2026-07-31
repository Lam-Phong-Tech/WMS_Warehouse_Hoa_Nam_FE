/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Button, DatePicker, Input, Select, Space, Table, Tabs, Tag } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { fetchWarrantyCases } from "@/modules/warranty/services/warrantyService";
import type { WarrantyCase } from "@/modules/warranty/types";
import { fetchReportsHub, fetchXntReport, downloadXntReportExcel } from "../services/reportsService";
import type { ReportItem, XntReportRow } from "../types";

type WarrantyReportRow = {
  id: string;
  model: string;
  defect: string;
  total: number;
  processing: number;
  returned: number;
  tempOnly: number;
};

function warrantyRow(row: WarrantyCase): WarrantyReportRow {
  const status = row.status;
  const returned = ["RETURNED", "RETURNED_TO_CUSTOMER", "CLOSED"].includes(status);
  return {
    id: row.id,
    model: row.sku,
    defect: row.defect_code,
    total: 1,
    processing: status && !returned ? 1 : 0,
    returned: returned ? 1 : 0,
    tempOnly: status === "TEMP_ONLY" ? 1 : 0,
  };
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("hub");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [xntRows, setXntRows] = useState<XntReportRow[]>([]);
  const [warrantyRows, setWarrantyRows] = useState<WarrantyReportRow[]>([]);
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  const [scope, setScope] = useState<"warehouse" | "system">("system");
  const [loading, setLoading] = useState(false);

  // Fetch reports hub list from backend (replaces old mock data)
  useEffect(() => {
    fetchReportsHub().then(setReports).catch(() => setReports([]));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (activeTab !== "xnt") return;
    let cancelled = false;
    setLoading(true);
    fetchXntReport({
      from: period[0].format("YYYY-MM-DD"),
      to: period[1].format("YYYY-MM-DD"),
      scope,
    })
      .then((data) => {
        if (!cancelled) setXntRows(data);
      })
      .catch(() => {
        if (!cancelled) setXntRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, period, scope]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (activeTab !== "warranty") return;
    let cancelled = false;
    setLoading(true);
    fetchWarrantyCases()
      .then((rows) => {
        if (!cancelled) setWarrantyRows(rows.map(warrantyRow));
      })
      .catch(() => {
        if (!cancelled) setWarrantyRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  /** Handle XNT Excel export download */
  const handleExportXnt = async () => {
    setLoading(true);
    try {
      const blob = await downloadXntReportExcel({
        from: period[0].format("YYYY-MM-DD"),
        to: period[1].format("YYYY-MM-DD"),
        scope,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xnt-report-${period[0].format("YYYYMMDD")}-${period[1].format("YYYYMMDD")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // Error handled by shared API error bridge
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "hub",
            label: "Trung tâm báo cáo",
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search placeholder="Tìm báo cáo..." style={{ width: 285 }} />
                </Space>
                <Table
                  dataSource={reports}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Mã", dataIndex: "code", key: "code" },
                    { title: "Tên báo cáo", dataIndex: "title", key: "title" },
                    { title: "Mô tả", dataIndex: "description", key: "description" },
                  ]}
                />
              </>
            ),
          },
          {
            key: "xnt",
            label: "Báo cáo XNT",
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <DatePicker
                    value={period[0]}
                    onChange={(value) => value && setPeriod([value, period[1]])}
                  />
                  <DatePicker
                    value={period[1]}
                    onChange={(value) => value && setPeriod([period[0], value])}
                  />
                  <Select
                    placeholder="Phạm vi"
                    style={{ width: 150 }}
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: "system", label: "Toàn hệ thống" },
                      { value: "warehouse", label: "Kho" },
                    ]}
                  />
                  <Button type="primary" onClick={handleExportXnt} loading={loading}>
                    Xuất XLSX
                  </Button>
                </Space>
                <Table
                  dataSource={xntRows}
                  rowKey={(row) => row.sku}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "SKU", dataIndex: "sku", key: "sku" },
                    { title: "Đầu kỳ", dataIndex: "opening", key: "opening" },
                    { title: "Nhập", dataIndex: "receipt", key: "receipt" },
                    { title: "Xuất", dataIndex: "issue", key: "issue" },
                    { title: "Điều chỉnh tăng", dataIndex: "adjustIn", key: "adjustIn" },
                    { title: "Điều chỉnh giảm", dataIndex: "adjustOut", key: "adjustOut" },
                    { title: "Hoàn đảo ròng", dataIndex: "reversalNet", key: "reversalNet" },
                    { title: "Cuối kỳ", dataIndex: "closing", key: "closing" },
                    {
                      title: "Đối soát",
                      dataIndex: "reconcile",
                      key: "reconcile",
                      render: (value: string) => (
                        <Tag color={value === "PASS" ? "success" : "warning"}>
                          {value}
                        </Tag>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "warranty",
            label: "Bảo hành theo lỗi",
            children: (
              <Table
                dataSource={warrantyRows}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: "Model/SKU", dataIndex: "model", key: "model" },
                  { title: "Lỗi/bệnh", dataIndex: "defect", key: "defect" },
                  { title: "Số case", dataIndex: "total", key: "total" },
                  { title: "Đang xử lý", dataIndex: "processing", key: "processing" },
                  { title: "Đã trả", dataIndex: "returned", key: "returned" },
                  { title: "TEMP_ONLY", dataIndex: "tempOnly", key: "tempOnly" },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}