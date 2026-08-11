/**
 * Compatibility entry point only.
 *
 * The canonical inbound implementation lives in modules/inbound and enforces
 * DRAFT -> SCANNING -> POSTED/CANCELLED with exact full-post. Keeping this
 * re-export prevents stale imports from re-introducing the retired partial /
 * close-remainder workflow.
 */
export { default } from "@/modules/inbound/pages/InboundPage";
