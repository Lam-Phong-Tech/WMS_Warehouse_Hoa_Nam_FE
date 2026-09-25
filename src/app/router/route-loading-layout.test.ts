import { it } from "vitest";
import assert from "node:assert/strict";
import { ROUTES } from "@/shared/constants/routes";
import { routeLoadingLayout } from "./route-loading-layout";

const reports = [
  ROUTES.REPORTS_INVENTORY_FLOW,
  ROUTES.REPORTS_OUTBOUND_FLOW,
  ROUTES.REPORTS_TRACEABILITY,
  ROUTES.REPORTS_IMPORT_QUALITY,
  ROUTES.REPORTS_PACKING_LABEL,
  ROUTES.REPORTS_WARRANTY,
  ROUTES.REPORTS_RECIPIENT,
  ROUTES.REPORTS_PENDING_EVIDENCE,
];
for (const route of reports) {
  it(`${route}: chart placeholders are available before the module loads`, () => {
    assert.equal(routeLoadingLayout(route), "report");
  });
}
it("reconciliation selects the six-card layout", () => {
  assert.equal(routeLoadingLayout(ROUTES.REPORTS_STOCK_RECONCILE), "reconcile");
  assert.equal(routeLoadingLayout(ROUTES.INVENTORY), "reconcile");
});
it("overview selects the five-card layout", () => {
  assert.equal(routeLoadingLayout(ROUTES.DASHBOARD), "overview");
});
it("both history presentations and trailing slashes use the same skeleton", () => {
  assert.equal(routeLoadingLayout(`${ROUTES.REPORTS_PENDING_EVIDENCE}?screen=RPT-08`), "report");
  assert.equal(routeLoadingLayout(`${ROUTES.REPORTS_PENDING_EVIDENCE}/`), "report");
});
it("ordinary pages have a safe lightweight list skeleton", () => {
  assert.equal(routeLoadingLayout(ROUTES.INBOUND), "list");
  assert.equal(routeLoadingLayout(ROUTES.OUTBOUND), "list");
  assert.equal(routeLoadingLayout(ROUTES.AGENCIES), "list");
  assert.equal(routeLoadingLayout("/reports/not-a-real-route"), "list");
});
it("auth and profile skeletons do not invent chart or KPI areas", () => {
  assert.equal(routeLoadingLayout(ROUTES.LOGIN), "auth");
  assert.equal(routeLoadingLayout(ROUTES.FORGOT_PASSWORD), "auth");
  assert.equal(routeLoadingLayout(ROUTES.PROFILE), "detail");
});
