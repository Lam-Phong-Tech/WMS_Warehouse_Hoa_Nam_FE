import { useState, useTransition } from "react";
import { Autocomplete, InputAdornment, TextField } from "@mui/material";
import type {
  AutocompleteRenderInputParams,
  TextFieldProps,
} from "@mui/material";
import { SearchOutlined } from "@/shared/components/icons";
import { ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";

/**
 * Một dòng gợi ý của ô tìm kiếm.
 *
 * `label` vừa là thứ người dùng đọc vừa là chuỗi MUI đem đi lọc danh sách, nên
 * nhãn phải chứa CẢ mã lẫn tên (quy ước chung của app: "MÃ · Tên") thì gõ mã
 * hay gõ tên đều ra gợi ý. `value` là thứ ghi vào ô sau khi chọn — thường chỉ
 * là mã, vì bộ lọc phía sau so khớp trên chuỗi ngắn đó.
 */
export interface SearchSuggestion {
  value: string;
  label: string;
}

export interface SearchInputProps extends Omit<
  TextFieldProps,
  "onChange" | "value" | "variant"
> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Default: 260 */
  width?: number | string;
  /**
   * Có truyền (và không rỗng) thì ô mọc thêm dropdown gợi ý kiểu freeSolo: vẫn
   * gõ tự do được, gợi ý chỉ là lối tắt để không phải nhớ mã. Bỏ trống thì ô
   * giữ nguyên là TextField thường — 20+ chỗ đang dùng SearchInput không đổi.
   */
  suggestions?: ReadonlyArray<SearchSuggestion>;
}

/**
 * Trần độ dài của MỌI ô tìm kiếm. Từ khoá đi thẳng vào query string/API; không
 * có trần thì một chuỗi dán nhầm hàng chục nghìn ký tự cũng được gửi đi. 200
 * đủ cho mọi mã/tên nghiệp vụ của hệ (mã ≤ 100, tên ≤ 255 nhưng không ai tìm
 * bằng nguyên tên).
 */
const SEARCH_MAX_LENGTH = 200;

/**
 * Ô tìm kiếm chuẩn hoá (MUI): icon tìm kiếm, nút xoá khi có giá trị, aria-label
 * tự động lấy từ placeholder nếu không truyền riêng.
 * onChange nhận string thay vì ChangeEvent để dùng trực tiếp với state setter.
 */
export function SearchInput({
  value = "",
  onChange,
  placeholder,
  width = 260,
  sx,
  slotProps,
  suggestions,
  ...rest
}: SearchInputProps) {
  const t = useT();
  const resolvedPlaceholder =
    placeholder ?? t("shared.table.searchPlaceholder");
  // `aria-label` được gắn cho THẺ INPUT bên dưới (slotProps.htmlInput). Phải
  // tách nó khỏi `rest`, nếu không nó rơi xuống cả div bọc của TextField và ô
  // tìm kiếm có HAI phần tử mang cùng tên trợ năng — trình đọc màn hình đọc
  // lặp, còn `getByLabelText` trong test thì báo "Found multiple elements".
  const { "aria-label": ariaLabelProp, ...rootProps } = rest as typeof rest & {
    "aria-label"?: string;
  };
  const ariaLabel = ariaLabelProp ?? resolvedPlaceholder;
  const hasSuggestions = Boolean(suggestions && suggestions.length > 0);
  // `id` phải do Autocomplete cấp cho ô nhập (nó còn dùng chính id đó cho
  // aria-controls/aria-activedescendant của dropdown), nên ở chế độ gợi ý thì
  // tách riêng, phần còn lại mới rót xuống TextField.
  const { id: fieldId, ...fieldProps } = rootProps;

  /**
   * CHỮ HIỆN NGAY, BỘ LỌC CHẠY SAU.
   *
   * ĐO ĐƯỢC 07/09/2026 (CPU x4, đúng cách Chrome đo INP): gõ MỘT ký tự vào ô lọc
   * màn Truy vết mất **520 ms** mới ra khung hình kế tiếp. Không phải do việc
   * lọc — ô này do trang mẹ giữ giá trị, nên mỗi phím gõ dựng lại toàn bộ
   * component báo cáo (~1.500 dòng, vài nghìn node, hàng trăm `sx` của MUI) ở
   * mức ưu tiên GẤP, và trình duyệt không vẽ được gì cho tới khi dựng xong.
   *
   * Tách theo đúng độ khẩn của hai việc:
   *   · `draft` — chữ trong ô. GẤP, chỉ vẽ lại chính ô nhập.
   *   · `onChange` của trang mẹ — chạy trong `startTransition`, React được phép
   *     cắt nhỏ và nhường luồng chính cho phím gõ tiếp theo.
   *
   * VẪN LÀ CONTROLLED: khi trang mẹ đổi `value` từ bên ngoài (đặt lại bộ lọc,
   * nút xoá, chọn gợi ý), khối `if` dưới đây đồng bộ ô ngay TRONG lúc render —
   * đúng khuôn mẫu "điều chỉnh state khi props đổi" của React, không dùng effect
   * nên không có nhịp nháy giá trị cũ.
   */
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [, startTransition] = useTransition();
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const commit = (next: string) => {
    setDraft(next);
    startTransition(() => onChange?.(next));
  };

  /**
   * Một thân ô duy nhất cho cả hai chế độ. Khi có gợi ý, `params` là của
   * Autocomplete: phải giữ `ref`/`className`/`onMouseDown` của nó thì dropdown
   * mới neo đúng ô, còn `value`/`onChange` do Autocomplete quản nên TextField
   * KHÔNG được tự điều khiển nữa (điều khiển hai lần thì con trỏ nhảy).
   */
  const renderField = (params?: AutocompleteRenderInputParams) => (
    <TextField
      {...params}
      {...(params
        ? {}
        : {
            value: draft,
            onChange: (event: { target: { value: string } }) =>
              commit(event.target.value),
          })}
      placeholder={resolvedPlaceholder}
      autoComplete="off"
      // width cố định qua maxWidth (không phải width tuyệt đối) để control vẫn
      // co được dưới 576px theo baseline responsive chung.
      //
      // CHIỀU CAO: cố ý KHÔNG ghi đè padding dọc — để nguyên `C.input.paddingY`
      // của theme thì ô cao đúng 38px (CONTROL.height), bằng UiSelect,
      // UiTextField và UiVuexyDateField đứng cạnh nó trong mọi thanh lọc.
      // Trước đây chỗ này ép padding 6px để khớp antd Select (~35px); từ khi
      // toolbar chuyển hết sang MUI (Part 4) thì không còn antd Select nào
      // trong `src/` nữa, nên phép bù đó chỉ còn làm ô tìm kiếm THẤP hơn 2px so
      // với các control bên cạnh (thấy rõ ở thanh lọc 8 màn Báo cáo).
      //
      // Chế độ gợi ý: bề rộng đã do gốc Autocomplete giữ, TextField chỉ lấp đầy.
      sx={
        params
          ? { width: "100%" }
          : {
              width: "100%",
              maxWidth: width,
              ...sx,
            }
      }
      slotProps={{
        ...slotProps,
        htmlInput: {
          ...params?.slotProps.htmlInput,
          "aria-label": ariaLabel,
          maxLength: SEARCH_MAX_LENGTH,
          ...(slotProps?.htmlInput as object),
        },
        input: {
          ...params?.slotProps.input,
          startAdornment: (
            <InputAdornment position="start">
              <SearchOutlined style={{ fontSize: 15 }} />
            </InputAdornment>
          ),
          endAdornment: draft ? (
            <InputAdornment position="end">
              <ActionIconButton
                kind="clear"
                label={t("shared.table.clearSearch")}
                edge="end"
                onClick={() => commit("")}
              />
            </InputAdornment>
          ) : undefined,
          ...(slotProps?.input as object),
        },
      }}
      {...(params ? fieldProps : rootProps)}
    />
  );

  if (!hasSuggestions) return renderField();

  return (
    <Autocomplete
      freeSolo
      // Nút xoá và mũi tên của Autocomplete bị tắt để ô có gợi ý trông giống
      // hệt ô tìm kiếm thường: vẫn đúng một nút xoá (ActionIconButton) ở cuối.
      disableClearable
      forcePopupIcon={false}
      size="small"
      options={(suggestions ?? []) as SearchSuggestion[]}
      // Ô do CHA giữ giá trị: gõ tay hay chọn gợi ý đều chảy về `onChange`.
      inputValue={draft}
      onInputChange={(_event, next, reason) => {
        // "reset" là sự kiện MUI tự bắn lúc chọn xong (mang nhãn "MÃ · Tên").
        // Chuyển tiếp nó sẽ ghi cả nhãn vào ô lọc và không khớp gì cả — giá trị
        // thật đã được `onChange` bên dưới ghi rồi.
        if (reason === "reset") return;
        commit(next);
      }}
      onChange={(_event, picked) => {
        commit(typeof picked === "string" ? picked : picked.value);
      }}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : option.label
      }
      id={fieldId}
      sx={{ width: "100%", maxWidth: width, ...sx }}
      renderInput={renderField}
    />
  );
}
