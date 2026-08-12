/**
 * Canonical service surface for the inbound module.
 *
 * The implementation is temporarily re-exported from the historical `receiving`
 * path so existing contract tests and compatibility imports keep working while
 * all active inbound code imports through this module-local boundary.
 */
export {
  cancelInboundDocument,
  createInboundDocument,
  fetchInboundDetail,
  fetchInboundDocument,
  fetchInboundDocuments,
  fetchInboundLines,
  postInboundReceipt,
  registerInboundBox,
  reverseInboundDocument,
  scanInboundDocument,
  updateInboundDocument,
} from "@/modules/receiving/services/receivingService";

export type {
  InboundBoxRegistration,
  InboundListResult,
} from "@/modules/receiving/services/receivingService";
