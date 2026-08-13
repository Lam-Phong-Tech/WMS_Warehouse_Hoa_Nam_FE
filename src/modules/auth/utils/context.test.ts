import { describe, expect, it } from "vitest";
import {
  getContextKey,
  getScopeName,
  getScopeTypeLabel,
} from "@/modules/auth/utils/context";
import type { AuthContext } from "@/modules/auth/types/auth.types";

const branchCtx: AuthContext = {
  role_id: 2,
  role_name: "Quản Lý",
  scope_type: "chi_nhanh",
  org_unit_id: 3,
  org_unit_name: "Chi Nhánh Hà Nội",
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: null,
};

const systemCtx: AuthContext = {
  role_id: 1,
  role_name: "Super Admin",
  scope_type: "he_thong",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: null,
};

describe("context helpers", () => {
  it("getScopeName lấy tên đơn vị cụ thể", () => {
    expect(getScopeName(branchCtx)).toBe("Chi Nhánh Hà Nội");
  });

  it('getScopeName fallback "Toàn hệ thống" khi scope hệ thống', () => {
    expect(getScopeName(systemCtx)).toBe("Toàn hệ thống");
  });

  it("getScopeTypeLabel dịch scope_type sang tiếng Việt", () => {
    expect(getScopeTypeLabel(branchCtx)).toBe("Chi nhánh");
  });

  it("getContextKey sinh khoá duy nhất cho từng bối cảnh", () => {
    expect(getContextKey(branchCtx)).toBe("2:chi_nhanh::3::");
    expect(getContextKey(systemCtx)).toBe("1:he_thong::::");
    expect(getContextKey(branchCtx)).not.toBe(getContextKey(systemCtx));
  });
});
