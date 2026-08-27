/**
 * Barrel nhóm form legacy — sau Part 3 CHỈ còn 2 component scan (adapter antd,
 * giữ nguyên hành vi scan-focus theo SRS Annex D; hợp nhất tiếp ở Part 4).
 *
 * Lớp field nhập liệu canonical nằm ở `@/shared/ui` (UiFormText, UiFormSelect,
 * UiFormNumber, UiFormDate, UiFormCheckbox, UiFormRadioGroup, UiFormSwitch,
 * UiFormAutocomplete) — bộ FormInput/TextField/SelectField antd cũ đã xoá
 * (consumer cuối là 3 trang auth, đã migrate trong Part 3).
 */
export { ScanInput, type ScanInputProps } from "./ScanInput";
export { CameraScanModal } from "./CameraScanModal";
