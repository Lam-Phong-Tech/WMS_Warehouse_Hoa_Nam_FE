# WWHN-176 QA2 Responsive / Accessibility / Smoke Matrix

Execution status: `READY_FOR_QA2_EXECUTION`  
Automated controlled-browser evidence: FE/CI  
Independent acceptance: QA2

## Required execution identity

QA2 must record:

- source SHA;
- workflow run/build version;
- artifact name;
- environment and URL;
- browser/version;
- viewport;
- role/context;
- timestamp;
- PASS/FAIL and defect link.

## Matrix

| ID | Scenario | Viewport | Automated assertion | Independent QA2 action |
| --- | --- | --- | --- | --- |
| QA2-01 | Login shell desktop | 1440x900 | Visible heading/form/button; no document overflow | Retest Chrome/Edge |
| QA2-02 | Login shell tablet | 768x1024 | Visible heading/form/button; no document overflow | Retest Chrome/Edge |
| QA2-03 | Login shell mobile | 375x812 | Visible heading/form/button; no document overflow | Retest Chrome/Edge |
| QA2-04 | Component catalog smoke | 1440x900 | Table, loading, empty, error, no-permission, validation, confirm states render | Compare UI states with baseline |
| QA2-05 | Keyboard modal flow | 1440x900 | “Mở modal” receives focus; Enter opens dialog; Escape closes | Verify focus indicator and focus return |
| QA2-06 | Shared component responsive | 768x1024 | Catalog usable without document overflow | Check touch/keyboard usability |
| QA2-07 | Shared component responsive | 375x812 | Catalog usable without document overflow | Check touch/keyboard usability |
| QA2-08 | Session/RBAC smoke | 1440x900 | Existing auth/RBAC suites pass | Retest role navigation/direct URL `/errors/403` |
| QA2-09 | Accessibility semantics | all | Controls queried by role/name; dialog semantics verified | Run manual keyboard and screen-reader spot check |

## Pass rule

WWHN-176 may be marked PASS only when:

1. exact SHA/build matches the artifact;
2. all required viewports pass;
3. keyboard focus is visible and modal focus behavior is usable;
4. no blocker or P1 remains;
5. QA2 comments the result directly on WWHN-176.

CI-generated evidence is supporting evidence, not QA2 self-signature.
