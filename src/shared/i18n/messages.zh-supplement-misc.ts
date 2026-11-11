/** Bổ sung tiếng Trung cho các màn nhỏ: audit, tồn kho, nhập liệu, bảo hành. */
export const ZH_SUPPLEMENT_MISC: Record<string, string> = {
  "audit.actionObject": "操作 / 对象",
  "audit.changeContent": "变更内容",
  "audit.changeField": "字段",
  "audit.errorCode": "错误代码",
  "audit.eventSummary": "事件摘要",
  "audit.exportHint": "选择本页日志以导出 Excel。",
  "audit.filterReset": "清除筛选",
  "audit.noChanges": "此事件不包含变更前后数据。",
  "audit.notRecorded": "未记录",
  "audit.pageDescription": "查看操作人、受影响对象和处理结果。",
  "audit.pageTitle": "系统审计日志",
  "audit.readOnly": "只读",
  "audit.readOnlyNotice": "审计日志为只读，无法编辑或删除。",
  "audit.requestId": "请求 ID",
  "audit.resultUnknown": "未知",
  "audit.searchHint": "搜索描述、对象类型或内部 ID",
  "audit.technicalDetails": "技术详情",

  "common.pieces": "件",

  "inventory.balance.reconcileFilterAria": "筛选对账状态",
  "inventory.balance.reconcileFilterPlaceholder": "对账：全部",

  "reports.inventoryFlow.outboundSearchPlaceholder":
    "出库单号、请求单号、收件人...",

  "reports.importQuality.cannotReconcile": "无法对账",
  "reports.importQuality.viewRecords": "查看 {count} 条记录",

  "outbound.edit.title": "编辑出库单信息",
  "outbound.edit.action": "编辑信息",
  "outbound.edit.save": "保存信息",
  "outbound.edit.saved": "出库单信息已更新。",
  "outbound.edit.saveError": "无法保存出库单信息。",
  "outbound.edit.onlyDraft": "仅草稿状态的出库单可以编辑信息。",
  "outbound.edit.staleNotice":
    "单据已被他人更新。请重新加载最新数据以继续；未保存的更改将被放弃。",
  "outbound.edit.reload": "重新加载数据",
  "outbound.edit.linesLocked":
    "SKU 和数量已从出库请求锁定；如需更改货物，请取消单据并重新创建。",
  "outbound.edit.linesTitle": "货物明细（只读）",
  "outbound.edit.colSku": "SKU",
  "outbound.edit.colName": "产品名称",
  "outbound.edit.colQty": "数量",
  "outbound.edit.saving": "正在保存...",
  "outbound.edit.fieldNote": "备注",
  "outbound.edit.errRecipient": "请输入收件人 / 收货地点。",
  "outbound.edit.errPhone": "电话号码必须正好 10 位，并以 0 开头。",
  "outbound.edit.errRequestDate": "请求日期无效或位于未来。",

  "outbound.intake.attachmentsHint":
    "JPG/PNG/WEBP 图片或 PDF，每个文件 ≤ 15MB。文件在创建单据后上传；如果批次创建多个单据，附件会附加到第一个单据。",
  "outbound.intake.attachmentsCreated":
    "出库单已创建。部分附件未能上传——请重试或移除失败文件。关闭窗口将放弃未上传的文件。",
  "outbound.intake.attachmentsRetry": "重新上传附件",
  "outbound.intake.attachmentsUploading": "正在上传附件...",
  "outbound.intake.attachmentsNeedDocument":
    "无法确定刚刚创建的单据以附加附件。",

  "warranty.list.overdueFilterAria": "筛选逾期的保修案例",
  "warranty.list.overdueFilterOnly": "案例：逾期",
  "warranty.list.overdueFilterPlaceholder": "案例：全部",
};
