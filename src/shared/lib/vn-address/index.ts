/**
 * Địa chỉ Việt Nam sau sáp nhập (Tỉnh/Thành → Phường/Xã → địa chỉ cụ thể).
 * Import: `import { formatAddress } from "@/shared/lib/vn-address"`.
 * Ô nhập: `UiAddressField` ở `@/shared/ui/forms`.
 */
export {
  EMPTY_STRUCTURED_ADDRESS,
  formatAddress,
  isAddressEmpty,
  joinAddressParts,
  normalizeVietnamese,
  parseAddress,
  serializeAddress,
  type ParsedAddress,
  type StructuredAddress,
} from "./vn-address.format";
export {
  fetchProvinces,
  fetchWards,
  peekProvinces,
  peekWards,
  preloadVnWards,
  stripDivisionPrefix,
  VN_ADDRESS_DATA_VERSION,
  type VnProvince,
  type VnWard,
} from "./vn-address.api";
export {
  useVnProvinces,
  useVnWards,
  type VnCatalogState,
} from "./use-vn-address";
