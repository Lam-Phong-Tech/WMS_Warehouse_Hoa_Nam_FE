import { ZH_SUPPLEMENT_AUTH } from "./messages.zh-supplement-auth";
import { ZH_SUPPLEMENT_IAM } from "./messages.zh-supplement-iam";
import { ZH_SUPPLEMENT_MISC } from "./messages.zh-supplement-misc";
import { ZH_SUPPLEMENT_PACKING } from "./messages.zh-supplement-packing";

/** Các khoá tiếng Trung bổ sung cho những màn chưa có bản dịch đầy đủ. */
export const ZH_SUPPLEMENT: Record<string, string> = {
  ...ZH_SUPPLEMENT_AUTH,
  ...ZH_SUPPLEMENT_IAM,
  ...ZH_SUPPLEMENT_MISC,
  ...ZH_SUPPLEMENT_PACKING,
};
