export { useLanguageStore, LANGUAGES, type Language } from "./language.store";
export { MESSAGES_VI, type MessageKey, type MessageTree } from "./messages";
// MESSAGES_EN CỐ Ý không re-export ở đây: nó nằm ở module nạp động
// (./messages.en). Re-export tĩnh sẽ kéo nó ngược vào đồ thị tải-ngay và xoá
// sạch lợi ích của việc tách.
export { ensureEnglishMessages } from "./english-messages";
export {
  useT,
  translate,
  tStatic,
  type MessageVars,
  type TranslateFn,
} from "./useT";
export { useNavLabel, navLabel, NAV_LABELS_EN } from "./nav-labels";
