# SRS/FRD - HỆ THỐNG QUẢN LÝ KHO & WEB APP XEM SẢN PHẨM

**Hoa Nam Tools**

**DOCUMENT ID: HN-SRS-FRD-001 \| VERSION 1.4**

**FINAL APPROVAL CANDIDATE / BASELINE EFFECTIVE ON WWHN-334 DONE**

Ngày cập nhật: 23/07/2026

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  BA GATE STATEMENT: SRS/FRD v1.4 đã hoàn tất nội dung BA-controlled P0/P1 ở mức đặc tả và đủ điều kiện đề nghị formal approval. Task WWHN-334 được chuyển DONE khi PM/PO phê duyệt attachment v1.4 và baseline bundle; ngày transition là ngày hiệu lực. Detailed UI/UX/Figma, physical ERD/Data Dictionary, Tech-approved OpenAPI, Test Master, test execution, UAT, migration dry-run và cutover là downstream artifacts; chúng chặn các readiness gate tương ứng nhưng không chặn SRS/FRD Done.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 0. DOCUMENT CONTROL

## 0.1. Thông tin tài liệu

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Trường**                  **Giá trị**
  --------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Document ID                 HN-SRS-FRD-001

  Version                     1.4

  Title                       Software Requirements Specification / Functional Requirements Document - Hoa Nam WM & PV

  Author/Owner                Business Analyst - Nguyễn Đình Hùng

  Updated date                23/07/2026

  Current status              FINAL APPROVAL CANDIDATE / BASELINE EFFECTIVE ON WWHN-334 DONE

  Formal approval mechanism   PM/PO Nguyễn Quang Đức phê duyệt SRS baseline bằng việc transition WWHN-334 sang DONE với attachment HN_SRS_FRD_v1_4.docx và HN_OpenAPI_v1_0.yaml là bản hiện hành. WWHN-33 và detailed Figma là downstream, không phải điều kiện SRS Done.

  Effective date              Ngày transition WWHN-334 sang DONE; không ghi ngày hiệu lực hồi tố trước formal approval.

  Source documents            Hợp đồng 07072026/HOANAM-A4I ngày 21/07/2026, trang 1-2; BRD Hoa Nam v3.11; Tóm tắt yêu cầu đối tác; BRD Decision Record tại WWHN-333; SRS approval tại WWHN-334; Import Template evidence comment 12634.

  Supersedes                  SRS/FRD v1.4 thay thế v1.0, v1.1, v1.2 và v1.3. BRD v3.7, v3.9 và v3.10 bị SUPERSEDED bởi BRD v3.11.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.2. Approval matrix và phạm vi phê duyệt

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Role**                **Name**           **Scope approval**                                                                                              **Status**                                                                         **Effective date / Evidence**
  ----------------------- ------------------ --------------------------------------------------------------------------------------------------------------- ---------------------------------------------------------------------------------- --------------------------------------------------
  BA Owner                Nguyễn Đình Hùng   Nội dung requirement, rule, AC, test-design definitions và traceability                                         COMPLETED / READY FOR FORMAL APPROVAL                                              SRS/FRD v1.4 - 23/07/2026

  PM/PO                   Nguyễn Quang Đức   Phạm vi, ưu tiên, internal MVP/release baseline và chấp nhận SRS Done                                           APPROVES SRS BASELINE BY WWHN-334 JIRA TRANSITION                                  WWHN-334 transition history + attachment v1.4

  Client representative   Vũ Tuấn Cương      Căn cứ phạm vi kinh doanh tổng quát theo hợp đồng; không phê duyệt từng quyết định kiến trúc/release chi tiết   CONTRACT SCOPE EVIDENCE ONLY - DETAILED MVP APPROVAL NOT REQUIRED                  HĐ 07072026/HOANAM-A4I, trang 1-2; comment 12625

  Tech Lead               Nguyễn Quang Đức   Phê duyệt quyết định implementation trong SRS; physical ERD/OpenAPI triển khai downstream                       INTERNAL SOLUTION DECISIONS EFFECTIVE ON WWHN-334 DONE; TECH BASELINE DOWNSTREAM   WWHN-334; WWHN-31 sau BA Done

  QA Lead                 Đặng Thị Soi       Review testability của AC/TC definition; xây Test Master và execution sau BA baseline                           CONSULTED FOR TESTABILITY; WWHN-33 PLANNED AFTER BA DONE                           WWHN-33 blocks Ready for QA/Beta, not SRS Done
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Contract evidence:** [[WWHN-333 comment 12625]{.underline}](https://tan0110.atlassian.net/browse/WWHN-333?focusedCommentId=12625) \| **Formal SRS approval task:** [[WWHN-334]{.underline}](https://tan0110.atlassian.net/browse/WWHN-334)

## 0.3. P0 Closure Matrix

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **P0**   **Vấn đề**                       **Cách đóng trong v1.4**                                                                                                                                                                                       **Closure status**                                **Evidence/Gate**
  -------- -------------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------- -------------------------------------------
  P0-01    Formal approval/effective date   WWHN-334 DONE là formal SRS approval; effective date là ngày transition, attachment v1.4 là bản hiện hành.                                                                                                     CONDITIONAL CLOSED ON PM/PO TRANSITION            WWHN-334

  P0-02    Contract/Appendix                Đã ghi HĐ 07072026/HOANAM-A4I ngày 21/07/2026, không phụ lục, phạm vi trang 1-2; phân biệt contract scope, internal MVP phasing và roadmap.                                                                    CLOSED                                            Comment 12625 + Contract Coverage Matrix

  P0-03    Baseline bundle/source version   Source Registry dùng BRD v3.11; BRD v3.7/v3.9/v3.10 và SRS v1.0-v1.3 được đánh dấu SUPERSEDED; bỏ Handoff không tồn tại.                                                                                       CLOSED                                            Source/Supersession Register

  P0-04    Core decisions                   Platform/carrier/partial/inventory authority là internal solution decisions; nguồn BRD tại WWHN-333, SRS adoption/effectiveness tại WWHN-334; approver PM/PO/Tech Lead và affected-artifact list đầy đủ.       CONDITIONAL CLOSED ON WWHN-334 TRANSITION         Decision Record

  P0-05    Functional coverage              Đã có REQ/AC/TC cho identity/user/role, agency, defect, product masters, inventory query/trace, reports, export, App PV masters và import batch/item condition.                                                CLOSED IN v1.4                                    REQ-SRS-026..034

  P0-06    Technical baseline               Nhúng BA logical ERD, full logical Data Dictionary, endpoint/permission map, Screen/Field Specification và phát hành HN_OpenAPI_v1_0.yaml. Physical/Tech approval thực hiện tại WWHN-31/WWHN-40 sau BA Done.   CLOSED FOR BA HANDOFF / DOWNSTREAM DEV GATE       HN_OpenAPI_v1_0.yaml; WWHN-31; WWHN-40

  P0-07    Traceability integrity           34 REQ/AC/TC + 16 NFR/TC-NFR; BR ID cụ thể và evidence task rõ. WWHN-33 được triển khai sau BA Done; tài liệu không công bố test execution đã hoàn tất.                                                        CLOSED AT DOCUMENT LEVEL / EXECUTION DOWNSTREAM   Traceability Master + WWHN-33

  P0-08    Reversal/correction guard        Đã bổ sung allowed state, downstream dependency, partial reversal, lock, permission, reason, correction chain, report effect, API và TC.                                                                       CLOSED IN v1.4                                    BR-REV-01..12; TC-SRS-013 + TC-REV-02..07
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.4. Baseline Index

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Artifact**                 **ID/Version**                     **Status**                                                      **Acceptance role**
  ---------------------------- ---------------------------------- --------------------------------------------------------------- --------------------------------
  SRS/FRD                      HN-SRS-FRD-001 v1.4                FINAL APPROVAL CANDIDATE; BASELINE EFFECTIVE ON WWHN-334 DONE   PM/PO

  BRD                          HN-BRD-WM-PV v3.11                 CONTROLLING BUSINESS SOURCE; v3.7/v3.9/v3.10 SUPERSEDED         PM/PO; contract scope evidence

  Contract                     07072026/HOANAM-A4I - 21/07/2026   AVAILABLE; NO APPENDIX; PAGES 1-2; GENERAL CONTRACT SCOPE       Contract parties / evidence

  Logical ERD                  Embedded in SRS v1.4               BA LOGICAL BASELINE COMPLETE; PHYSICAL BASELINE WWHN-31         Tech Lead downstream

  Data Dictionary              Embedded in SRS v1.4               BA FIELD BASELINE COMPLETE; PHYSICAL TYPE/DDL WWHN-31           Tech Lead downstream

  OpenAPI                      HN_OpenAPI_v1_0.yaml               BA MACHINE-READABLE BASELINE ISSUED; TECH APPROVAL WWHN-31      Tech Lead downstream

  Screen/Field Specification   Embedded v1.4 §8.3/§13.6           BA INPUT COMPLETE; DETAILED FIGMA PLANNED AFTER BA DONE         UI/UX/PM/FE downstream

  Permission mapping           Embedded + WWHN-40                 BA MAPPING COMPLETE; IMPLEMENTATION REVIEW DOWNSTREAM           Tech Lead/QA downstream

  Test Design / Test Master    WWHN-33                            PLANNED AFTER BA DONE; BLOCKS READY FOR QA/BETA, NOT SRS DONE   QA Lead downstream

  Contract Coverage Matrix     HN-CCM-WM-PV v1.4 embedded         GENERAL CONTRACT SCOPE + INTERNAL MVP PHASING + ROADMAP TRACE   PM/PO
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.5. Jira gate model - BA Done khác Ready for Dev/QA

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Checkpoint**                                       **Current conclusion**   **Meaning**
  ---------------------------------------------------- ------------------------ --------------------------------------------------------------------------------------------------------------------------------
  Đính kèm v1.4 vào WWHN-334 và transition IN REVIEW   YES                      Tài liệu đã hoàn tất BA-controlled P0/P1 ở mức đặc tả.

  Transition SRS/FRD task sang DONE                    CONDITIONAL              PM/PO approve baseline và attachment bundle tại WWHN-334; không còn TBD logic lõi.

  BA artifact baseline có hiệu lực                     ON WWHN-334 DONE         Attachment v1.4 là bản hiện hành; timestamp transition là effective date/formal approval evidence.

  Core flow Ready for Dev                              NO - DOWNSTREAM GATE     Cần WWHN-31 hoàn tất physical ERD/Data Dictionary/Tech-approved OpenAPI và WWHN-40 endpoint permission.

  Ready for FE detailed implementation                 NO - UI GATE             Detailed UI/UX/Figma được khởi tạo sau BA baseline; BA Screen/Field Specification là đầu vào nhưng không thay detailed design.

  Ready for QA execution/Beta                          NO - QA GATE             WWHN-33 Test Master/test data/environment và execution phải hoàn tất theo release gate; WWHN-33 không chặn SRS Done.

  Tuyên bố test/UAT đã pass                            NO                       SRS chỉ chứa BA-level AC/TC design definitions; actual QA/UAT/cutover evidence thuộc downstream/release tickets.
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.6. Downstream Artifact Register

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **ID**        **Artifact**                                                                     **Owner**            **Status**                                                    **Jira/Evidence**                               **Blocks**
  ------------- -------------------------------------------------------------------------------- -------------------- ------------------------------------------------------------- ----------------------------------------------- ---------------------------------------
  DS-TECH-001   Architecture, physical ERD, physical Data Dictionary, Tech-approved OpenAPI v1   Tech Lead            BA MACHINE-READABLE BASELINE ISSUED / TECH APPROVAL PENDING   WWHN-31 + HN_OpenAPI_v1_0.yaml                  Ready for Dev/contract tests

  DS-TEST-001   Detailed Test Design/Scenario Master, test data và execution evidence            QA Lead              PLANNED AFTER BA DONE                                         WWHN-33                                         Ready for QA/Beta; not SRS Done

  DS-PERM-001   Endpoint Permission Mapping implementation/review                                Tech Lead/QA         PLANNED AFTER BA DONE / LINKED                                WWHN-40                                         Security implementation/Ready for Dev

  DS-UX-001     Detailed UI/UX flow, Wireframe/Figma, prototype và FE handoff                    UI/UX + PM/PO + FE   PLANNED AFTER BA DONE                                         SRS v1.4 §8.3/§13.6; UI/UX Jira to be created   FE detailed implementation

  DS-EVD-001    Actual Jira/Test/UAT/Cutover evidence links                                      DEV/QA/Business      PENDING DOWNSTREAM EXECUTION                                  WWHN-33 + release tickets                       Beta/Go-live evidence
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 1. PURPOSE, SCOPE AND SOURCE

## 1.1. Mục tiêu

-   Quản lý một kho tổng Hoa Nam: identity/role, master data, SKU, item/serial, container, nhập, xuất, tồn, kiểm kê, bảo hành, truy vết và báo cáo.

-   Cung cấp Web App responsive để người xem tra cứu sản phẩm đã publish, lọc/gợi ý theo ngành nghề và xem available_qty của kho tổng.

-   Chuẩn hóa flow scan bằng Physical_Code: ITEM bắt buộc dùng chip; CARTON/BOX/TRAY dùng carrier linh hoạt.

-   Bảo đảm mọi action đổi tồn có idempotency, transaction boundary, concurrency guard, audit, authoritative ledger và reconciliation.

-   Tách BA Done khỏi các readiness gate downstream để đúng trình tự dự án: BA baseline trước, sau đó Tech/FE/QA triển khai artifact chi tiết.

## 1.2. Phạm vi MVP

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **In scope MVP/Beta**                                                 **Outside MVP/Beta / downstream roadmap where applicable**
  --------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------
  01 kho tổng; Agency là nơi nhận, không có tồn đại lý                  Multi-warehouse/agency stock

  Identity/User/Role và backend permission                              SSO/enterprise IAM ngoài phạm vi

  SKU PRODUCT/COMPONENT; product master; item/serial; carton/box/tray   Giá vốn, kế toán, công nợ, order/payment

  Inbound/Outbound, partial post, reversal/correction                   Approval workflow cho nhập/xuất

  Inventory query/trace, stocktake, reconciliation, reports/export      Hardware driver/gateway/protocol chuyên sâu - downstream phase; không bị coi là loại bỏ khỏi nghĩa vụ hợp đồng nếu chưa có CR.

  Warranty basic, defect catalog và TEMP_ONLY                           Chi phí/SLA/phân công sửa chữa

  Web App responsive read-only; industry/tag/recommendation master      Native app, map, cart/order/order tracking/payment - không thuộc MVP/Beta; tiếp tục được quản lý tại roadmap/phase nếu hợp đồng yêu cầu.
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 1.3. Source Registry

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Source ID**   **Nguồn**                                                 **Nội dung sử dụng**                                                        **Evidence status**
  --------------- --------------------------------------------------------- --------------------------------------------------------------------------- ------------------------------------------
  SRC-001         Tóm tắt yêu cầu đối tác                                   Kho, scan, chip cho máy, kiểm kê, bảo hành, App xem sản phẩm                SOURCE FILE AVAILABLE

  SRC-002         BRD Hoa Nam v3.11                                         Business scope, feature, data/state/rule, AC/TC và internal MVP decisions   CONTROLLING BUSINESS SOURCE; WWHN-333

  SRC-003         Hợp đồng 07072026/HOANAM-A4I ngày 21/07/2026, trang 1-2   Phạm vi kinh doanh tổng quát của phần mềm phục vụ quản lý kho Hoa Nam       AVAILABLE - NO APPENDIX

  SRC-004         WWHN-333 BRD Decision & Approval Record                   BRD platform/carrier/partial/inventory authority và source baseline         BRD EVIDENCE ONLY; NOT SRS APPROVAL TASK

  SRC-005         SRS/FRD v1.0-v1.3                                         Nguồn lịch sử để truy vết thay đổi                                          SUPERSEDED BY v1.4

  REMOVED         Handoff Hoa Nam v3.10                                     Không có artifact độc lập nên không tiếp tục dùng làm source                REMOVED FROM BASELINE
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 1.4. Nguyên tắc Contract Coverage

-   Hợp đồng chứng minh hai bên có thỏa thuận triển khai phần mềm quản lý kho, ứng dụng đại lý và các hạng mục tổng thể; tài liệu không tuyên bố từng REQ/AC/TC được mô tả nguyên văn trong hợp đồng.

-   BRD v3.11, BRD Decision Record tại WWHN-333 và SRS/FRD v1.4 là nguồn mô tả giải pháp chi tiết. Phạm vi MVP/Beta là internal delivery/release baseline do PM/PO và Tech Lead phê duyệt tại WWHN-334; khách hàng không phải phê duyệt từng quyết định kiến trúc hoặc release scope chi tiết.

-   Các capability hợp đồng chưa nằm trong MVP/Beta, gồm native app, bản đồ, đặt hàng/theo dõi đơn và tích hợp phần cứng RFID chuyên sâu, tiếp tục được quản lý tại roadmap/phase downstream và không được coi là bị loại bỏ vĩnh viễn. Chỉ khi thay đổi vĩnh viễn phạm vi thương mại, giá, tiến độ hoặc tiêu chí nghiệm thu cuối hợp đồng mới cần Change Request/phụ lục theo quy trình.

-   Chuỗi traceability chuẩn: Contract Scope -\> BRD/Decision/Business Rule -\> SRS Requirement -\> Acceptance Criteria -\> Test Case -\> Jira/Test Evidence.

## 1.5. Contract Coverage Matrix

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Coverage ID**   **Contract/Delivery item**                                                                          **Reference**                                 **REQ/AC/TC coverage**                                    **Status**
  ----------------- --------------------------------------------------------------------------------------------------- --------------------------------------------- --------------------------------------------------------- ------------------------------------------------------------------
  CTR-WM-001        Phần mềm phục vụ quản lý kho Hoa Nam                                                                HĐ 07072026/HOANAM-A4I, trang 1-2             REQ-SRS-001..016, 021..024, 026..032, 034                 GENERAL CONTRACT SCOPE; DETAIL BY BRD/SRS

  SOL-BRD-001       Giải pháp Web App, chip/carrier, partial, inventory authority, reversal                             BRD v3.11 + WWHN-333; SRS approval WWHN-334   REQ-SRS-003..020, 023..025, 030..033                      INTERNAL MVP/RELEASE BASELINE; PM/TECH APPROVAL

  DELIV-TECH-001    Physical ERD/Data Dictionary/Tech-approved OpenAPI/Permission implementation                        WWHN-31 + WWHN-40                             REQ-SRS-025, NFR security/transaction                     DOWNSTREAM PROJECT DELIVERABLE; BLOCKS READY FOR DEV

  DELIV-QA-001      Test Master/Test Data/Execution/UAT evidence                                                        WWHN-33 + release tickets                     REQ-SRS-022, TC-SRS-001..034, TC-NFR-001..016             DOWNSTREAM AFTER BA DONE; BLOCKS QA/BETA/GO-LIVE AS APPLICABLE

  CR-POLICY-001     Permanent removal/addition affecting commercial scope, price, timeline or final acceptance          Formal CR/Appendix when triggered             Future commercial changes only                            CR REQUIRED WHEN COMMERCIAL OBLIGATION CHANGES

  ROADMAP-CTR-001   Native app, map, order/order tracking and deep RFID hardware integration not included in MVP/Beta   Contract pages 1-2 + internal release plan    No current MVP REQ; managed as downstream roadmap/phase   RETAINED CONTRACTUAL ROADMAP; NOT PERMANENTLY REMOVED WITHOUT CR
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 1.6. Supersession Register

  ---------------------------------------------------------------------------------------------------------------------------------------------
  **Old source/statement**                                  **New controlling source/decision**                         **Status**
  --------------------------------------------------------- ----------------------------------------------------------- -----------------------
  BRD v3.7                                                  BRD v3.11                                                   SUPERSEDED

  BRD v3.9                                                  BRD v3.11                                                   SUPERSEDED

  BRD v3.10                                                 BRD v3.11                                                   SUPERSEDED

  SRS/FRD v1.0-v1.3                                         SRS/FRD v1.4                                                SUPERSEDED

  Handoff v3.10 reference                                   Removed; use BRD v3.11 + WWHN-333 and SRS v1.4 + WWHN-334   REMOVED / NO ARTIFACT

  App local/platform unclear                                DR-PLAT-001 - Web App responsive                            SUPERSEDED FOR MVP

  Chip mandatory for all item/carton/box/tray               DR-CARRIER-001                                              SUPERSEDED

  Inbound/Outbound only DRAFT/SCANNING/POSTED/CANCELLED     DEC-PARTIAL-001                                             SUPERSEDED

  Balance/Movement/subledger without authority definition   DEC-INV-001                                                 SUPERSEDED
  ---------------------------------------------------------------------------------------------------------------------------------------------

# 2. DECISION RECORDS AND GOVERNANCE

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **CLIENT CONTRACT SCOPE VS INTERNAL RELEASE DECISION: Khách hàng cung cấp căn cứ phạm vi kinh doanh tổng quát qua hợp đồng. Web App responsive cho MVP/Beta, carrier, partial flow, inventory authority, location boundary và trình tự downstream là quyết định delivery/implementation nội bộ. PM/PO và Tech Lead phê duyệt SRS adoption qua WWHN-334 DONE. Native app, map, order/order tracking và hardware integration chuyên sâu chưa nằm trong MVP nhưng tiếp tục ở roadmap/phase; không tuyên bố loại bỏ vĩnh viễn nếu chưa có CR.**
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Decision ID**          **Decision**                                                                                                                                                                                 **Rationale**                                                                                     **Approver**        **Decision date**    **Evidence**                                                          **Affected artifacts**
  ------------------------ -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------- ------------------- -------------------- --------------------------------------------------------------------- -----------------------------------------------------------
  DR-PLAT-001              MVP/Beta App PV = Web App responsive read-only; native/offline/order/map remain downstream roadmap.                                                                                          Giảm rủi ro release, cung cấp kênh tra cứu sớm và không loại bỏ nghĩa vụ roadmap.                 PM/PO + Tech Lead   WWHN-334 DONE date   BRD source WWHN-333; SRS adoption WWHN-334 DONE                       BRD, SRS, Roadmap, Screen Baseline, OpenAPI PV, TC-PV

  DR-CARRIER-001           ITEM bắt buộc chip; CARTON/BOX/TRAY carrier QR/BARCODE/RFID/NFC/MANUAL.                                                                                                                      Carrier-agnostic, không khóa vendor/chi phí container.                                            PM/PO + Tech Lead   WWHN-334 DONE date   BRD source WWHN-333; SRS adoption WWHN-334 DONE                       BRD, SRS, ERD, DD, OpenAPI scan, TC-CODE

  DEC-INV-001              Inventory_Movement authoritative ledger; Balance projection; item/container subledger; atomic transaction.                                                                                   Audit, reconciliation, idempotency và rollback.                                                   Tech Lead + PM/PO   WWHN-334 DONE date   BRD source WWHN-333; SRS adoption WWHN-334; physical detail WWHN-31   ERD, DD, Posting APIs, Reports, Reconciliation TC

  DEC-PARTIAL-001          Partial receipt/issue, multi-post, close remainder; no over-receipt MVP.                                                                                                                     Khớp vận hành và không ép post toàn bộ.                                                           PM/PO + Tech Lead   WWHN-334 DONE date   BRD source WWHN-333; SRS adoption WWHN-334 DONE                       Inbound/Outbound states, APIs, AC/TC, reports

  DEC-BA-GATE-001          SRS Done cần BA content complete + PM/PO baseline approval tại WWHN-334. Detailed Figma, WWHN-31/WWHN-40, WWHN-33 và execution evidence là downstream gates.                                 Loại circular dependency; requirement baseline phải ổn định trước UI/Tech/Test detailed design.   PM/PO + Tech Lead   WWHN-334 DONE date   WWHN-334; downstream WWHN-31/WWHN-40/WWHN-33                          Baseline Index, DoD, downstream register, release tickets

  DR-LOC-001               MVP không quản lý bin/rack/zone hierarchy. Tray mapping và location_hint là vị trí tương đối, nullable, không tạo stock bucket và không tham gia công thức tồn.                              Giữ phạm vi đơn giản, tránh double count khi chưa khảo sát layout.                                PM/PO + Tech Lead   WWHN-334 DONE date   SRS v1.4; approval by WWHN-334                                        ERD, DD, UI, report, API

  DR-UX-001                Embedded Screen Map/Field Specification là BA input đủ để khởi tạo UI/UX. Detailed Figma/prototype thực hiện sau BA Done và chặn FE detailed implementation, không chặn SRS Done.            Tách UX requirement khỏi detailed visual design và loại circular dependency.                      PM/PO + Tech Lead   WWHN-334 DONE date   SRS v1.4 §8.3/§13.6; WWHN-334                                         Screen baseline, UI/UX downstream, FE readiness

  DR-PRIV-001              Warranty PII được minimize, masked theo role, export riêng quyền, không ghi raw PII vào application log, retention 5 năm sau đóng case rồi anonymize/purge nếu không legal hold.             Đóng privacy contract cho tên, SĐT, ảnh và mô tả máy.                                             PM/PO + Tech Lead   WWHN-334 DONE date   SRS v1.4 §13.8; WWHN-334                                              DD, API, UI, export, audit

  DEC-CONTRACT-PHASE-001   MVP/Beta scope là internal delivery phasing. Native app, map, order/order tracking và deep RFID integration chưa nằm trong MVP nhưng giữ tại roadmap/phase; permanent removal requires CR.   Phân biệt release scope với nghĩa vụ thương mại tổng thể.                                         PM/PO + Tech Lead   WWHN-334 DONE date   Contract pages 1-2; WWHN-333; WWHN-334                                Contract Coverage, Roadmap, Scope, DoD
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 3. ACTORS, IDENTITY AND ACTION-LEVEL PERMISSION

  ------------------------------------------------------------------------------------------
  **Actor**            **Responsibility**
  -------------------- ---------------------------------------------------------------------
  Admin hệ thống       Quản lý user/role/permission, master data, cấu hình hệ thống.

  Quản lý kho          Inventory control, post, stocktake adjustment, reversal, reports.

  Nhân viên kho        Create/scan inbound/outbound, count, putaway; post only if granted.

  Nhân viên bảo hành   Receive/update/return warranty cases.

  Ban lãnh đạo         Read-only reports.

  Người xem App PV     Read-only published product and available quantity.
  ------------------------------------------------------------------------------------------

  ------------------------------------------------------------------------------------------------------------------------------------------------------
  **Action**                 **Admin**   **QL kho**   **NV kho**   **NV bảo hành**   **Lãnh đạo**   **App PV**       **Permission key**
  -------------------------- ----------- ------------ ------------ ----------------- -------------- ---------------- -----------------------------------
  User/role manage           A           D            D            D                 D              D                iam.user.manage / iam.role.manage

  SKU/master create/update   A           A            V            V                 V              Published only   sku.manage / master.manage

  Agency/defect manage       A           A            V\*          V\*               V              D                agency.manage / defect.manage

  Inbound create             A           A            A            D                 D              D                inbound.create

  Post Receipt               A           A            A\*          D                 D              D                inbound.post

  Close inbound remainder    A           A            D            D                 D              D                inbound.close_remainder

  Outbound create            A           A            A            D                 D              D                outbound.create

  Post Issue                 A           A            A\*          D                 D              D                outbound.post

  Close outbound remainder   A           A            D            D                 D              D                outbound.close_remainder

  Inventory query/trace      A           A            V            V\*               V              D                inventory.view / inventory.trace

  Stocktake create/count     A           A            A            D                 D              D                stocktake.count

  Apply Adjustment           A           A            D            D                 D              D                stocktake.apply

  Reversal Post              A           A\*          D            D                 D              D                inventory.reversal.post

  Warranty manage            A           A            A\*          A                 D              D                warranty.manage

  Publish PV                 A           A            D            D                 V              D                pv.publish

  Reports/export             A           A            V\*          D                 V              D                report.view / report.export
  ------------------------------------------------------------------------------------------------------------------------------------------------------

*A = Allow; V = View; D = Deny; A\*/V\* = chỉ khi được gán quyền. Backend phải enforce permission và data scope, không chỉ ẩn nút UI.*

# 4. FUNCTIONAL REQUIREMENTS

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **REQ ID**    **Coverage/Source**    **Requirement**                                                               **Priority**   **Acceptance Criteria**                                                                 **Output**                   **TC ID**    **BR/Decision**
  ------------- ---------------------- ----------------------------------------------------------------------------- -------------- --------------------------------------------------------------------------------------- ---------------------------- ------------ --------------------------------------
  REQ-SRS-001   SRC-002 / CTR-WM-001   Quản lý 01 kho tổng; Agency không phải warehouse.                             Must           AC-SRS-001: không có agency balance/stocktake/movement.                                 Warehouse/Agency/Inventory   TC-SRS-001   BR-SCOPE-01..05

  REQ-SRS-002   SRC-001/SRC-002        Quản lý SKU PRODUCT và COMPONENT, serial/quantity mode.                       Must           AC-SRS-002: SKU unique; serial mode khóa sau khi có stock.                              SKU API/UI/Data              TC-SRS-002   BR-SKU-01..10; BR-COMP-01

  REQ-SRS-003   DR-CARRIER-001         ITEM bắt buộc chip và có Physical_Code duy nhất.                              Must           AC-SRS-003: item thiếu chip mapping bị chặn post.                                       Item/Physical_Code           TC-SRS-003   BR-CODE-01..07; BR-CARRIER-01

  REQ-SRS-004   DR-CARRIER-001         CARTON/BOX/TRAY carrier cấu hình linh hoạt.                                   Must           AC-SRS-004: QR/BARCODE/RFID/NFC/MANUAL hợp lệ.                                          Container/Physical_Code      TC-SRS-004   BR-CARRIER-01; BR-CON-01..08

  REQ-SRS-005   SRC-001/SRC-002        Scan batch phân loại ITEM/CARTON/BOX/TRAY/UNKNOWN.                            Must           AC-SRS-005: phát hiện duplicate/unknown; scan không tự đổi tồn.                         Scan API/UI                  TC-SRS-005   BR-SCAN-01..02; BR-SCAN-ADD-01..04

  REQ-SRS-006   SRC-002                Tạo inbound DRAFT/SCANNING, chưa tăng tồn.                                    Must           AC-SRS-006: draft/scan không sinh movement.                                             Inbound API/UI               TC-SRS-006   BR-IN-01; BR-INOUT-01..02

  REQ-SRS-007   DEC-PARTIAL-001        Partial Receipt và multi-post; close remainder có reason.                     Must           AC-SRS-007: posted/remaining đúng; không over-receipt.                                  Post Receipt/Data/Report     TC-SRS-007   BR-PARTIAL-IN-01..03

  REQ-SRS-008   DEC-INV-001            Post Receipt idempotent, atomic và audit.                                     Must           AC-SRS-008: retry không double stock/movement; failure rollback all.                    API/DB transaction           TC-SRS-008   BR-IN-02; BR-IDEMP-01..03; BR-TXN-01

  REQ-SRS-009   SRC-002                Putaway cập nhật tray mapping, không đổi tồn.                                 Must           AC-SRS-009: không Inventory_Movement và available_qty không đổi.                        Putaway UI/API               TC-SRS-009   BR-PTW-01..02

  REQ-SRS-010   SRC-002                Tạo outbound DRAFT/SCANNING, chưa giảm tồn.                                   Must           AC-SRS-010: draft/scan không có stock effect.                                           Outbound API/UI              TC-SRS-010   BR-OUT-01; BR-INOUT-01..02

  REQ-SRS-011   DEC-PARTIAL-001        Partial Issue và multi-post; close remainder có reason.                       Must           AC-SRS-011: không vượt remaining/available.                                             Post Issue/Data/Report       TC-SRS-011   BR-PARTIAL-OUT-01..03

  REQ-SRS-012   DEC-INV-001            Post Issue idempotent/concurrent, không âm kho.                               Must           AC-SRS-012: một request commit; request xung đột không trừ lần hai.                     API/locking                  TC-SRS-012   BR-OUT-02..05; BR-CONC-01..03

  REQ-SRS-013   SRC-002/DEC-INV-001    Reversal/correction append-only cho Receipt/Issue.                            Must           AC-SRS-013: giữ movement gốc; guard dependency; partial; chain; report net.             Reversal API/Data            TC-SRS-013   BR-REV-01..12

  REQ-SRS-014   SRC-001/SRC-002        Stocktake snapshot, count, variance và movement warning.                      Must           AC-SRS-014: expected_at_count đúng theo cutoff.                                         Stocktake API/UI/Data        TC-SRS-014   BR-COUNT-01..10

  REQ-SRS-015   DEC-INV-001            Apply Adjustment idempotent, atomic và stale guarded.                         Must           AC-SRS-015: chỉ approved line; retry một lần; stale version bị chặn.                    Stocktake API/DB             TC-SRS-015   BR-COUNT-11..13; BR-IDEMP-01

  REQ-SRS-016   SRC-001/SRC-002        Warranty basic và TEMP_ONLY khi mất mã.                                       Must           AC-SRS-016: temp code; no link/movement; one active case/item.                          Warranty API/UI              TC-SRS-016   BR-WAR-01..13

  REQ-SRS-017   DR-PLAT-001            Web App responsive list/detail/search/filter.                                 Must           AC-SRS-017: desktop/tablet/mobile; active/published only.                               PV UI/API                    TC-SRS-017   BR-PV-01..08; NFR-SRS-006

  REQ-SRS-018   SRC-001/SRC-002        PV hiển thị available_qty kho tổng, read-only.                                Must           AC-SRS-018: không lộ item/container/movement/cost; không stock effect.                  PV API/read model            TC-SRS-018   BR-PV-02..03; BR-PV-09..14

  REQ-SRS-019   SRC-001/SRC-002        PV gợi ý sản phẩm theo ngành nghề bằng rule.                                  Must           AC-SRS-019: priority cấu hình; chỉ active/published; có empty state.                    Recommendation API/UI        TC-SRS-019   BR-PV-05..08

  REQ-SRS-020   SRC-002                Admin/QL kho publish/unpublish sản phẩm.                                      Must           AC-SRS-020: inactive không được publish; audit thay đổi.                                PV Admin API/UI              TC-SRS-020   BR-PV-01; BR-PV-MST-01..03

  REQ-SRS-021   SRC-002                Migration/opening balance dry-run, commit, reconcile, rollback reference.     Must           AC-SRS-021: dry-run không đổi dữ liệu; failed reconciliation chặn go-live.              Import API/Data              TC-SRS-021   BR-MIG-01..06

  REQ-SRS-022   SRC-002                UAT/cutover/rollback/handover package.                                        Must           AC-SRS-022: script, actual, evidence, defect, waiver và Go/No-Go.                       Operational package          TC-SRS-022   BR-UAT-01..05

  REQ-SRS-023   DEC-INV-001            Movement authoritative; Balance projection; subledger reconcile.              Must           AC-SRS-023: ba lớp khớp sau posting; divergence tạo incident.                           Data/ADR                     TC-SRS-023   BR-INV-01; BR-RECON-01..04

  REQ-SRS-024   SRC-002/WWHN-40        HTTP/error/idempotency/security contract.                                     Must           AC-SRS-024: 400/401/403/404/409/412/422/428/500; endpoint permission.                   API/Security                 TC-SRS-024   BR-API-ERR-01..09; BR-SEC-01..05

  REQ-SRS-025   DEC-BA-GATE-001        Technical artifacts và approval được quản lý theo readiness gate.             Must           AC-SRS-025: BA draft embedded; WWHN-31/33/40 linked; không công bố Ready sai.           Baseline Index               TC-SRS-025   BR-BASE-01..06

  REQ-SRS-026   SRC-002                Quản lý identity, user, role, permission và scope assignment.                 Must           AC-SRS-026: unique account; inactive deny; least privilege; backend enforcement.        IAM API/UI/Data              TC-SRS-026   BR-IAM-01..08

  REQ-SRS-027   SRC-002                Quản lý Agency master: tạo/sửa/ngừng hoạt động; chỉ là nơi nhận.              Must           AC-SRS-027: inactive không chọn cho phiếu mới; không sinh warehouse/stock.              Agency API/UI/Data           TC-SRS-027   BR-AGY-01; BR-SCOPE-02..04

  REQ-SRS-028   SRC-002                Quản lý Defect Catalog dùng cho warranty/report.                              Must           AC-SRS-028: defect_code unique; inactive không chọn mới; lịch sử giữ nguyên.            Defect API/UI/Data           TC-SRS-028   BR-DEF-01..04

  REQ-SRS-029   SRC-002                Quản lý category/brand/model/power/package/version phục vụ SKU và PV.         Must           AC-SRS-029: master unique/active; SKU reference hợp lệ; không sửa code đã dùng.         Product Master API/UI        TC-SRS-029   BR-MST-01..07; BR-SKU-05..10

  REQ-SRS-030   SRC-001/SRC-002        Inventory query và trace theo SKU/item/carton/box/tray/code.                  Must           AC-SRS-030: hiển thị balance + subledger + movement chain; không double count.          Inventory Query/Trace        TC-SRS-030   BR-TRACE-01..06; BR-CON-04

  REQ-SRS-031   SRC-002                Báo cáo tồn hiện tại, XNT, lịch sử nhập/xuất, stocktake và warranty defect.   Must           AC-SRS-031: công thức và filter đúng; reversal hiển thị net và trace.                   Reports API/UI               TC-SRS-031   BR-RPT-01..07

  REQ-SRS-032   SRC-002                Export Excel/PDF cho báo cáo được cấp quyền.                                  Should         AC-SRS-032: export dùng cùng filter; audit; dữ liệu đúng scope.                         Report Export                TC-SRS-032   BR-EXP-01..05

  REQ-SRS-033   SRC-001/SRC-002        Quản lý PV Industry, Tag, Product Mapping và Recommendation Rule.             Must           AC-SRS-033: mapping many-to-many; priority unique trong scope; inactive bị loại.        PV Master API/UI             TC-SRS-033   BR-PV-MST-01..06

  REQ-SRS-034   SRC-002                Quản lý Import Batch và Item Condition tách khỏi SKU.                         Must           AC-SRS-034: nhiều batch dùng cùng SKU; condition không tạo SKU mới; trace được nguồn.   Import/Condition Data        TC-SRS-034   BR-BATCH-01..05; BR-SKU-06..08
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 5. CORE FLOW SPECIFICATION AND BUSINESS RULES

## 5.1. Inbound / Partial Receipt

-   Create DRAFT -\> scan/enter data -\> SCANNING. Không có stock effect.

-   Post confirmed subset với Idempotency-Key và If-Match. Mỗi lần post thành công tạo Posting_Event + RECEIPT_POSTED movement và cập nhật balance/subledger trong cùng transaction.

-   remaining_qty \> 0 thì line/document = PARTIALLY_POSTED; đủ thì POSTED; close remainder cần permission + reason và không đổi tồn.

-   Không over-receipt trong MVP. Retry cùng key/cùng payload trả kết quả cũ; cùng key/payload khác trả 409.

## 5.2. Outbound / Partial Issue

-   Create DRAFT -\> SCANNING; chỉ Post Issue mới giảm tồn.

-   Validate item status, box quantity, remaining_qty và available_qty tại thời điểm commit.

-   Lock theo SKU/item/box và optimistic version của balance. Một request commit; request cạnh tranh trả 409/412/422 phù hợp.

-   PARTIALLY_POSTED/POSTED/CLOSED giống inbound; close remainder không đổi tồn.

## 5.3. Stocktake

-   Tạo session và Stocktake_Snapshot tại stocktake_started_at trong cùng transaction.

-   Count serial list hoặc quantity-only; scan/count không đổi tồn. Mỗi count có count_cutoff_at.

-   expected_at_count = snapshot_qty + net_movement_after_snapshot_to_cutoff; variance_to_apply = actual_qty - expected_at_count.

-   QL kho ack movement warning, approve/waive theo line. Apply approved lines atomically với Idempotency-Key + If-Match/session_version.

## 5.4. Warranty

-   Case có item code: item hợp lệ ở ISSUED hoặc RETURNED_TO_CUSTOMER, không có active case khác; chuyển IN_WARRANTY.

-   Không có định danh tin cậy: tạo TEMP_ONLY, sinh temporary_item_code, item_code null, sales_trace_status=NOT_TRACEABLE.

-   Warranty không tăng/giảm sellable stock; chỉ IN_STOCK tính available.

## 5.5. Reversal / Correction Guard

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Rule ID**   **Rule / Guard**
  ------------- -------------------------------------------------------------------------------------------------------------------------------------------------------
  BR-REV-01     Mọi sửa sai sau Post dùng append-only reversal/correction; không UPDATE/DELETE movement gốc.

  BR-REV-02     Bắt buộc inventory.reversal.post, reason_code, reason_text, actor, audit, Idempotency-Key và If-Match.

  BR-REV-03     Reverse Receipt chỉ áp dụng cho reversible_qty chưa có downstream Issue/Warranty/Adjustment/Reversal phụ thuộc.

  BR-REV-04     Nếu có downstream dependency, phải đảo dependency theo thứ tự ngược hoặc tạo correction chain được phê duyệt; API trả 409 nếu gọi sai thứ tự.

  BR-REV-05     Cho phép partial reversal; tổng qty các reversal đã POSTED không vượt qty movement gốc.

  BR-REV-06     Reverse Issue chỉ cộng tồn khi hàng vật lý đã quay lại kho và return_condition = SELLABLE.

  BR-REV-07     Hàng quay lại DEFECTIVE/NON_SELLABLE không cộng available_qty; cập nhật condition/status phù hợp và vẫn ghi movement/audit.

  BR-REV-08     Không reverse trực tiếp một reversal POSTED. Sửa tiếp bằng correction mới tham chiếu movement gần nhất trong correction_chain_id.

  BR-REV-09     Một movement/reversible scope bị khóa trong transaction; concurrent reversal chỉ một request thành công.

  BR-REV-10     Warranty active, stocktake variance đang Apply hoặc posting transaction chưa hoàn tất là guard chặn reversal trực tiếp.

  BR-REV-11     Report hiển thị movement gốc, reversal/correction và net effect; không ẩn hoặc sửa lịch sử.

  BR-REV-12     Retry cùng Idempotency-Key/payload trả kết quả cũ; cùng key khác payload trả 409; failure rollback reversal document/line/movement/balance/subledger.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

  --------------------------------------------------------------------------------------------------------------------------------------------
  **TC ID**   **Scenario**                                      **Expected result**
  ----------- ------------------------------------------------- ------------------------------------------------------------------------------
  TC-REV-02   Reverse Receipt khi item đã được Issue            409 DOWNSTREAM_DEPENDENCY_EXISTS; không đổi tồn.

  TC-REV-03   Partial Reverse Receipt 3/10 rồi reverse thêm 8   Lần hai bị chặn vì vượt reversible_qty còn 7.

  TC-REV-04   Reverse Issue hàng quay lại SELLABLE              Tạo ISSUE_REVERSED, item IN_STOCK, available +N đúng một lần.

  TC-REV-05   Reverse Issue hàng quay lại DEFECTIVE             Không cộng available; condition DEFECTIVE/NON_SELLABLE; report trace đầy đủ.

  TC-REV-06   Hai request reversal đồng thời cùng movement      Một request commit; request còn lại 409/412; không duplicate movement.

  TC-REV-07   Sửa một reversal đã POSTED                        Không edit/reverse trực tiếp; tạo correction mới trong chain.
  --------------------------------------------------------------------------------------------------------------------------------------------

## 5.6. Identity, Master Data, Reports và Export

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Rule group**    **Summary**
  ----------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  BR-IAM-01..08     Account unique; inactive deny; password/token policy do Tech baseline chốt; role/permission least privilege; backend enforcement; permission change audit; no self-escalation; scope assignment explicit.

  BR-AGY-01         Agency là nơi nhận, không phải warehouse; inactive không chọn cho document mới.

  BR-DEF-01..04     Defect code unique; inactive không chọn mới; history không bị đổi; free-text note vẫn cho phép.

  BR-MST-01..07     Brand/category/model/power/package/version active/unique; code đã được tham chiếu không đổi; deactivate thay vì xóa.

  BR-TRACE-01..06   Query phải phân biệt balance, item/serial, container mapping và movement; không double count; scope/permission enforced.

  BR-RPT-01..07     XNT = opening + receipt - issue + adjust + reversal; reversal hiển thị gross và net; filter/period/timezone nhất quán.

  BR-EXP-01..05     Export dùng cùng filter/scope với màn hình; audit; tên file có timestamp; PII bị giới hạn; file lỗi không được công bố hoàn tất.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 6. STATE MODEL

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Object**           **States**                                                                     **Key transition / stock effect**
  -------------------- ------------------------------------------------------------------------------ ---------------------------------------------------------------
  Inbound              DRAFT, SCANNING, PARTIALLY_POSTED, POSTED, CLOSED, CANCELLED                   Post subset +N; close remainder 0; cancel chỉ trước post đầu.

  Outbound             DRAFT, SCANNING, PARTIALLY_POSTED, POSTED, CLOSED, CANCELLED                   Post subset -N; close remainder 0; cancel chỉ trước post đầu.

  Item                 NEW, IN_STOCK, ISSUED, IN_WARRANTY, RETURNED_TO_CUSTOMER, LOST, ADJUSTED_OUT   Chỉ IN_STOCK tính available.

  Carton               EMPTY, IN_STOCK, PARTIAL, ISSUED, CLOSED                                       Container state; không có stock bucket riêng.

  Box                  RECEIVED_PENDING_PUTAWAY, STORED, PARTIAL, EMPTY, CLOSED                       Quantity subledger; tray mapping không movement.

  Stocktake            DRAFT, COUNTING, REVIEWING, APPLIED, CANCELLED                                 Chỉ Apply Adjustment đổi tồn.

  Stocktake Variance   PENDING, APPROVED, WAIVED, APPLIED                                             Chỉ APPROVED được Apply; WAIVED cần reason.

  Warranty             RECEIVED, CHECKING, REPAIRING, COMPLETED, RETURNED, CANCELLED                  Không có sellable stock movement.

  Reversal             DRAFT, CONFIRMED, POSTED, CANCELLED                                            POSTED tạo reverse movement; original remains.

  Correction chain     OPEN, RESOLVED                                                                 Append-only chain; không edit movement đã post.

  User/Agency/Master   ACTIVE, INACTIVE                                                               Inactive giữ lịch sử; không dùng cho transaction mới.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 7. DATA MODEL AND DATA DICTIONARY

## 7.1. DEC-INV-001 Source of Truth

  --------------------------------------------------------------------------------------------------------------------------------
  **Layer**                       **Authority**             **Rule**
  ------------------------------- ------------------------- ----------------------------------------------------------------------
  Inventory_Movement              Authoritative ledger      Append-only; movement_key/idempotency_key unique.

  Inventory_Balance               Projection                Updated in same transaction with ledger; optimistic version.

  Item_Instance                   Serial subledger          State/count reconcile to balance.

  Container_Item / Box quantity   Quantity subledger        Quantity/mapping reconcile to balance; no double count.

  Reversal/Correction chain       Audit correction ledger   References original movement; net effect reported, history retained.
  --------------------------------------------------------------------------------------------------------------------------------

## 7.2. Logical ERD - BA baseline

*Các sơ đồ dưới đây là logical ERD ở mức BA. Physical data type, index, partition và migration DDL được Tech Lead hoàn thiện/approve tại WWHN-31 mà không thay đổi business semantics đã chốt.*

![Logical ERD core inventory, posting, stocktake and reversal for Hoa Nam WMS.](./media/image1.png "Logical ERD core inventory, posting, stocktake and reversal for Hoa Nam WMS."){width="7.2in" height="2.7905883639545057in"}

Hình 1 - Logical ERD core inventory, posting, stocktake và reversal

![Logical ERD identity, agency, warranty and App PV master data for Hoa Nam WMS.](./media/image2.png "Logical ERD identity, agency, warranty and App PV master data for Hoa Nam WMS."){width="7.2in" height="3.155003280839895in"}

Hình 2 - Logical ERD identity, agency, warranty và App PV masters

## 7.3. Relationship/cardinality baseline

  ----------------------------------------------------------------------------------------------------------
  **Relationship**                        **Cardinality**   **Rule**
  --------------------------------------- ----------------- ------------------------------------------------
  Warehouse - Inventory_Balance           1-N               MVP chỉ có 01 warehouse vận hành.

  SKU - Item_Instance                     1-N               Áp dụng serial tracked.

  SKU - Inventory_Balance                 1-N               Theo warehouse + stock_status.

  SKU - Inventory_Movement                1-N               Mọi movement gắn SKU.

  Physical_Code - Item/Container          1-0..1            Một physical code định danh một target active.

  Container - Container_Item              1-N               Carton/Box/Tray mapping; không stock độc lập.

  Inbound_Document - Inbound_Line         1-N               Line có expected/posted/remaining.

  Outbound_Document - Outbound_Line       1-N               Line có planned/issued/remaining.

  Posting source - Inventory_Movement     1-N               Mỗi partial post có thể sinh nhiều movement.

  Stocktake_Session - Snapshot/Variance   1-N               Snapshot immutable; variance line-based.

  Reversal_Document - Reversal_Line       1-N               Line tham chiếu original_movement_id.

  Agency - Outbound_Document              1-N               Agency chỉ là nơi nhận.

  Item_Instance - Warranty_Case           0..1-N            TEMP_ONLY không có item_id.

  Defect_Catalog - Warranty_Case          1-N               Defect inactive vẫn giữ lịch sử.

  SKU - PV_Product_Profile                1-0..1            Chỉ published profile hiển thị.

  PV_Profile - Industry/Tag               N-N               Qua mapping tables.

  User - Role - Permission                N-N               Qua User_Role và Role_Permission.
  ----------------------------------------------------------------------------------------------------------

## 7.4. Field-level Data Dictionary - BA baseline

*Type dưới đây là logical type. Tech có thể ánh xạ sang PostgreSQL/ORM cụ thể tại WWHN-31, nhưng không được đổi requiredness, uniqueness, authority hoặc stock semantics nếu chưa có Change Decision.*

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Entity**                              **Field**                                                **Logical type**           **Required**         **Rule / Index / Meaning**
  --------------------------------------- -------------------------------------------------------- -------------------------- -------------------- ------------------------------------------------------------------------------------------
  Warehouse                               warehouse_id                                             UUID                       Y                    PK

  Warehouse                               warehouse_code                                           VARCHAR(30)                Y                    UQ; MVP một active warehouse

  Warehouse                               warehouse_name                                           VARCHAR(200)               Y                    

  Warehouse                               status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  Warehouse                               created_at/updated_at                                    TIMESTAMPTZ                Y                    audit timestamps

  User                                    user_id                                                  UUID                       Y                    PK

  User                                    username                                                 VARCHAR(100)               Y                    UQ, normalized

  User                                    display_name                                             VARCHAR(200)               Y                    

  User                                    email/phone                                              VARCHAR                    N                    PII; access controlled

  User                                    status                                                   ENUM                       Y                    ACTIVE/INACTIVE/LOCKED

  User                                    version                                                  INT                        Y                    optimistic locking

  Role / Permission                       role_id / permission_id                                  UUID                       Y                    PK

  Role / Permission                       role_code / permission_key                               VARCHAR(100)               Y                    UQ

  Role / Permission                       name                                                     VARCHAR(200)               Y                    

  Role / Permission                       status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  Role / Permission                       scope_type                                               ENUM                       N                    SYSTEM/WAREHOUSE/FUNCTION

  User_Role / Role_Permission             user_id, role_id                                         UUID                       Y                    composite UQ

  User_Role / Role_Permission             permission_id                                            UUID                       Y                    role-permission composite UQ

  User_Role / Role_Permission             scope_ref                                                VARCHAR/UUID               N                    explicit scope

  User_Role / Role_Permission             effective_from/to                                        TIMESTAMPTZ                N                    optional validity

  Agency                                  agency_id                                                UUID                       Y                    PK

  Agency                                  agency_code                                              VARCHAR(50)                Y                    UQ

  Agency                                  agency_name                                              VARCHAR(200)               Y                    

  Agency                                  phone/address                                            VARCHAR                    N                    PII/business contact

  Agency                                  status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  Agency                                  version                                                  INT                        Y                    optimistic locking

  SKU                                     sku_id                                                   UUID                       Y                    PK

  SKU                                     sku_code                                                 VARCHAR(100)               Y                    UQ; immutable after stock

  SKU                                     sku_name                                                 VARCHAR(255)               Y                    

  SKU                                     sku_type                                                 ENUM                       Y                    PRODUCT/COMPONENT

  SKU                                     unit                                                     VARCHAR(30)                Y                    

  SKU                                     is_serial_tracked                                        BOOLEAN                    Y                    immutable after stock

  SKU                                     brand_id/category_id/model_id                            UUID                       N                    FK masters

  SKU                                     power_or_voltage                                         VARCHAR(50)                N                    

  SKU                                     package_variant                                          VARCHAR(50)                N                    

  SKU                                     version_code                                             VARCHAR(30)                Y                    default V1

  SKU                                     published_to_app                                         BOOLEAN                    Y                    default false

  SKU                                     status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  Product_Master                          master_id                                                UUID                       Y                    PK

  Product_Master                          master_type                                              ENUM                       Y                    BRAND/CATEGORY/MODEL/PACKAGE/POWER

  Product_Master                          code                                                     VARCHAR(80)                Y                    UQ within type

  Product_Master                          name                                                     VARCHAR(200)               Y                    

  Product_Master                          status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  Defect_Catalog                          defect_id                                                UUID                       Y                    PK

  Defect_Catalog                          defect_code                                              VARCHAR(50)                Y                    UQ

  Defect_Catalog                          defect_name                                              VARCHAR(200)               Y                    

  Defect_Catalog                          description                                              TEXT                       N                    

  Defect_Catalog                          status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  Physical_Code                           physical_code_id                                         UUID                       Y                    PK

  Physical_Code                           code_value                                               VARCHAR(100)               Y                    UQ

  Physical_Code                           code_type                                                ENUM                       Y                    ITEM/CARTON/COMPONENT_SERIAL/BOX/TRAY/TEMP_WARRANTY

  Physical_Code                           carrier_type                                             ENUM                       Y                    ITEM requires RFID/NFC chip; others flexible

  Physical_Code                           hardware_uid                                             VARCHAR(150)               N                    UQ when populated

  Physical_Code                           status                                                   ENUM                       Y                    ACTIVE/LOST/REPLACED/INACTIVE

  Item_Instance                           item_id                                                  UUID                       Y                    PK

  Item_Instance                           sku_id                                                   UUID                       Y                    FK SKU

  Item_Instance                           physical_code_id                                         UUID                       Y for PRODUCT        UQ active mapping

  Item_Instance                           serial_number                                            VARCHAR(100)               N                    UQ when populated

  Item_Instance                           container_id                                             UUID                       N                    FK Container

  Item_Instance                           status                                                   ENUM                       Y                    NEW/IN_STOCK/ISSUED/IN_WARRANTY/RETURNED_TO_CUSTOMER/LOST/ADJUSTED_OUT

  Item_Instance                           item_condition                                           ENUM                       Y                    NORMAL/DEMO/DEFECTIVE/WARRANTY_RETURN/NON_SELLABLE

  Item_Instance                           import_batch_id                                          UUID                       N                    FK Import_Batch

  Item_Instance                           version                                                  INT                        Y                    optimistic locking

  Container                               container_id                                             UUID                       Y                    PK

  Container                               container_code                                           VARCHAR(100)               Y                    UQ

  Container                               container_type                                           ENUM                       Y                    CARTON/BOX/TRAY

  Container                               physical_code_id                                         UUID                       Y                    FK/UQ active mapping

  Container                               primary_sku_id                                           UUID                       N                    required for CARTON/BOX; null for mixed tray

  Container                               parent_container_id                                      UUID                       N                    BOX -\> TRAY

  Container                               status                                                   ENUM                       Y                    type-specific state

  Container                               version                                                  INT                        Y                    optimistic locking

  Container_Item                          container_item_id                                        UUID                       Y                    PK

  Container_Item                          container_id                                             UUID                       Y                    FK

  Container_Item                          item_id                                                  UUID                       N                    for serial item

  Container_Item                          sku_id                                                   UUID                       N                    for quantity-only

  Container_Item                          quantity                                                 DECIMAL(18,3)              N                    \>0 for quantity-only

  Container_Item                          status                                                   ENUM                       Y                    ACTIVE/REMOVED

  Container_Item                          UQ rule                                                  \-                         Y                    no duplicate active item; one SKU per carton/box

  Inventory_Balance                       warehouse_id                                             UUID                       Y                    FK

  Inventory_Balance                       sku_id                                                   UUID                       Y                    FK

  Inventory_Balance                       stock_status                                             ENUM                       Y                    AVAILABLE/NON_SELLABLE/etc.

  Inventory_Balance                       available_qty                                            DECIMAL(18,3)              Y                    projection

  Inventory_Balance                       version                                                  INT                        Y                    optimistic locking

  Inventory_Balance                       updated_at                                               TIMESTAMPTZ                Y                    

  Inventory_Balance                       Composite UQ                                             \-                         Y                    warehouse_id + sku_id + stock_status

  Inventory_Movement                      movement_id                                              UUID                       Y                    PK

  Inventory_Movement                      movement_key                                             VARCHAR(128)               Y                    UQ

  Inventory_Movement                      movement_type                                            ENUM                       Y                    OPENING/RECEIPT_POSTED/ISSUE_POSTED/ADJUST_IN/ADJUST_OUT/RECEIPT_REVERSED/ISSUE_REVERSED

  Inventory_Movement                      warehouse_id/sku_id                                      UUID                       Y                    FK

  Inventory_Movement                      qty_delta                                                DECIMAL(18,3)              Y                    signed

  Inventory_Movement                      source_type/source_id/source_line_id                     VARCHAR/UUID               Y                    trace source

  Inventory_Movement                      original_movement_id                                     UUID                       N                    for reversal/correction

  Inventory_Movement                      correction_chain_id                                      UUID                       N                    chain

  Inventory_Movement                      idempotency_key                                          VARCHAR(128)               Y for stock action   UQ within operation scope

  Inventory_Movement                      posted_at                                                TIMESTAMPTZ                Y                    authoritative time

  Inventory_Movement                      created_by/request_id                                    UUID/VARCHAR               Y                    audit

  Inbound_Document / Line                 inbound_id / line_id                                     UUID                       Y                    PK

  Inbound_Document / Line                 document_no                                              VARCHAR(50)                Y                    UQ

  Inbound_Document / Line                 status / line_status                                     ENUM                       Y                    partial states

  Inbound_Document / Line                 source_reference                                         VARCHAR(200)               N                    supplier/import ref

  Inbound_Document / Line                 sku_id                                                   UUID                       Y on line            FK

  Inbound_Document / Line                 expected_qty                                             DECIMAL(18,3)              Y                    \>=0

  Inbound_Document / Line                 posted_qty                                               DECIMAL(18,3)              Y                    \>=0

  Inbound_Document / Line                 remaining_qty                                            DECIMAL(18,3)              Y                    derived/validated

  Inbound_Document / Line                 cancelled_remainder_qty                                  DECIMAL(18,3)              Y                    default 0

  Inbound_Document / Line                 version                                                  INT                        Y                    If-Match

  Outbound_Document / Line                outbound_id / line_id                                    UUID                       Y                    PK

  Outbound_Document / Line                document_no                                              VARCHAR(50)                Y                    UQ

  Outbound_Document / Line                agency_id                                                UUID                       N                    recipient only

  Outbound_Document / Line                receiver_name                                            VARCHAR(200)               N                    other recipient

  Outbound_Document / Line                status / line_status                                     ENUM                       Y                    partial states

  Outbound_Document / Line                sku_id                                                   UUID                       Y on line            FK

  Outbound_Document / Line                planned_qty/issued_qty/remaining_qty                     DECIMAL(18,3)              Y                    validated

  Outbound_Document / Line                cancelled_remainder_qty                                  DECIMAL(18,3)              Y                    default 0

  Outbound_Document / Line                version                                                  INT                        Y                    If-Match

  Posting_Event                           posting_event_id                                         UUID                       Y                    PK

  Posting_Event                           document_type/document_id                                ENUM/UUID                  Y                    source

  Posting_Event                           idempotency_key                                          VARCHAR(128)               Y                    UQ in action scope

  Posting_Event                           payload_hash                                             VARCHAR(128)               Y                    same-key payload guard

  Posting_Event                           result_reference                                         JSONB                      Y                    replay response

  Posting_Event                           posted_at/posted_by/request_id                           TIMESTAMPTZ/UUID/VARCHAR   Y                    audit

  Stocktake_Session                       session_id                                               UUID                       Y                    PK

  Stocktake_Session                       scope_type/scope_ref                                     ENUM/UUID                  Y/N                  WHOLE/SKU/GROUP

  Stocktake_Session                       stocktake_started_at                                     TIMESTAMPTZ                Y                    snapshot time

  Stocktake_Session                       status                                                   ENUM                       Y                    DRAFT/COUNTING/REVIEWING/APPLIED/CANCELLED

  Stocktake_Session                       session_version                                          INT                        Y                    If-Match

  Stocktake_Session                       created_by/applied_by                                    UUID                       Y/N                  audit

  Stocktake_Snapshot / Count / Variance   snapshot_id/count_id/variance_id                         UUID                       Y                    PK

  Stocktake_Snapshot / Count / Variance   session_id                                               UUID                       Y                    FK

  Stocktake_Snapshot / Count / Variance   sku_id/item_id/container_id                              UUID                       N                    scope grain

  Stocktake_Snapshot / Count / Variance   snapshot_qty/actual_qty/expected_at_count/variance_qty   DECIMAL(18,3)              Y as applicable      formula controlled

  Stocktake_Snapshot / Count / Variance   count_cutoff_at                                          TIMESTAMPTZ                N                    on count confirm

  Stocktake_Snapshot / Count / Variance   line_status                                              ENUM                       Y on variance        PENDING/APPROVED/WAIVED/APPLIED

  Stocktake_Snapshot / Count / Variance   waive_reason/acknowledged_movement_ids                   TEXT/JSONB                 N                    required by rule

  Reversal_Document / Line                reversal_id / reversal_line_id                           UUID                       Y                    PK

  Reversal_Document / Line                reversal_type                                            ENUM                       Y                    RECEIPT/ISSUE/CORRECTION

  Reversal_Document / Line                original_document_id                                     UUID                       Y                    source

  Reversal_Document / Line                original_movement_id                                     UUID                       Y on line            FK

  Reversal_Document / Line                qty_to_reverse                                           DECIMAL(18,3)              Y                    \<= reversible_qty

  Reversal_Document / Line                return_condition                                         ENUM                       N                    SELLABLE/DEFECTIVE/NON_SELLABLE

  Reversal_Document / Line                reason_code/reason_text                                  VARCHAR/TEXT               Y                    

  Reversal_Document / Line                status                                                   ENUM                       Y                    DRAFT/CONFIRMED/POSTED/CANCELLED

  Reversal_Document / Line                correction_chain_id                                      UUID                       Y                    chain root

  Reversal_Document / Line                idempotency_key/payload_hash                             VARCHAR                    Y                    replay guard

  Reversal_Document / Line                version                                                  INT                        Y                    If-Match

  Warranty_Case                           case_id                                                  UUID                       Y                    PK

  Warranty_Case                           warranty_case_code                                       VARCHAR(50)                Y                    UQ

  Warranty_Case                           item_id/item_code                                        UUID/VARCHAR               N                    null for TEMP_ONLY

  Warranty_Case                           temporary_item_code                                      VARCHAR(100)               Y if TEMP_ONLY       UQ

  Warranty_Case                           identification_status                                    ENUM                       Y                    IDENTIFIED/TEMP_ONLY

  Warranty_Case                           customer_name/customer_phone                             VARCHAR                    Y                    PII

  Warranty_Case                           defect_id/reported_defect/confirmed_defect               UUID/TEXT                  Y/N                  

  Warranty_Case                           missing_code_reason/manual_product_description           TEXT                       Y if TEMP_ONLY       

  Warranty_Case                           status                                                   ENUM                       Y                    warranty states

  Warranty_Case                           received_date/returned_date                              TIMESTAMPTZ                Y/N                  

  Warranty_Case                           version                                                  INT                        Y                    optimistic lock

  PV_Product_Profile                      profile_id                                               UUID                       Y                    PK

  PV_Product_Profile                      sku_id                                                   UUID                       Y                    UQ FK

  PV_Product_Profile                      display_name/description/specification                   VARCHAR/TEXT/JSONB         Y/N                  public content

  PV_Product_Profile                      published                                                BOOLEAN                    Y                    default false

  PV_Product_Profile                      featured/sort_order                                      BOOLEAN/INT                Y                    

  PV_Product_Profile                      last_inventory_sync_at                                   TIMESTAMPTZ                N                    when cache used

  PV_Product_Profile                      version                                                  INT                        Y                    If-Match

  PV_Industry / Tag / Mapping             industry_id/tag_id                                       UUID                       Y                    PK

  PV_Industry / Tag / Mapping             code                                                     VARCHAR(80)                Y                    UQ

  PV_Industry / Tag / Mapping             name                                                     VARCHAR(200)               Y                    

  PV_Industry / Tag / Mapping             status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  PV_Industry / Tag / Mapping             profile_id + industry_id/tag_id                          UUID                       Y                    composite UQ

  PV_Industry / Tag / Mapping             priority                                                 INT                        N                    recommendation order

  PV_Recommendation_Rule                  rule_id                                                  UUID                       Y                    PK

  PV_Recommendation_Rule                  industry_id                                              UUID                       Y                    FK

  PV_Recommendation_Rule                  category_id/tag_id/sku_id                                UUID                       N                    selector/priority

  PV_Recommendation_Rule                  priority                                                 INT                        Y                    unique within rule scope

  PV_Recommendation_Rule                  status                                                   ENUM                       Y                    ACTIVE/INACTIVE

  Import_Batch                            import_batch_id                                          UUID                       Y                    PK

  Import_Batch                            import_batch_code                                        VARCHAR(80)                Y                    UQ

  Import_Batch                            source_file/checksum                                     VARCHAR                    Y                    trace source

  Import_Batch                            status                                                   ENUM                       Y                    DRAFT/DRY_RUN_VALIDATED/COMMITTED/FAILED/ROLLED_BACK

  Import_Batch                            valid/invalid/duplicate_count                            INT                        Y                    

  Import_Batch                            reconciliation_status                                    ENUM                       Y                    PENDING/PASS/FAIL

  Import_Batch                            committed_at/rollback_reference                          TIMESTAMPTZ/VARCHAR        N                    

  Audit_Log / Reconciliation_Incident     audit_id/incident_id                                     UUID                       Y                    PK

  Audit_Log / Reconciliation_Incident     actor_id/action/object_type/object_id                    UUID/VARCHAR               Y                    audit

  Audit_Log / Reconciliation_Incident     reason/request_id                                        TEXT/VARCHAR               N/Y                  

  Audit_Log / Reconciliation_Incident     before_data/after_data                                   JSONB                      N                    permission controlled

  Audit_Log / Reconciliation_Incident     divergence_type/status/resolution_ref                    ENUM/VARCHAR               N                    for incident

  Audit_Log / Reconciliation_Incident     created_at/resolved_at                                   TIMESTAMPTZ                Y/N                  retention applies
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 7.5. Reconciliation Controls

  ----------------------------------------------------------------------------------------------------------------------------------------------------
  **Check**             **Expected**
  --------------------- ------------------------------------------------------------------------------------------------------------------------------
  Ledger to Balance     Opening + Receipt - Issue + Adjust In - Adjust Out + Reversal = Balance

  Serial subledger      Balance available = count eligible Item_Instance status IN_STOCK and sellable condition

  Quantity subledger    Balance available = sum available quantity by box/subledger

  Container integrity   Container mapping does not create additional inventory bucket

  Divergence            Create Reconciliation_Incident, block readiness/sign-off; resolve with audited reversal/adjustment, never direct ledger edit
  ----------------------------------------------------------------------------------------------------------------------------------------------------

# 8. API, ERROR, PERMISSION AND UI BASELINE

## 8.1. Endpoint Catalog và action contract

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Group**   **Endpoints**                                                     **Permission**                                        **Request/Behavior**                                  **Primary errors**
  ----------- ----------------------------------------------------------------- ----------------------------------------------------- ----------------------------------------------------- ---------------------
  IAM         GET/POST /users; GET/POST /roles; PUT /roles/{id}/permissions     iam.user.\* / iam.role.\*                             User/Role payload; If-Match on update                 403/409/412/422

  Master      /agencies; /defects; /product-masters; /skus                      agency/defect/master/sku.\*                           Unique, active/inactive, immutable code after use     403/409/412/422

  Scan        POST /scan-batches/classify                                       scan.classify                                         scan_source + up to 500 code_value; no stock effect   403/409/422

  Inbound     /inbound-documents; /post-receipt; /close-remainder; /reversals   inbound.create/post/close; inventory.reversal.post    Idempotency-Key + If-Match on stock actions           403/409/412/422/428

  Outbound    /outbound-documents; /post-issue; /close-remainder; /reversals    outbound.create/post/close; inventory.reversal.post   Lock/available/remaining/dependency guard             403/409/412/422/428

  Inventory   GET /inventory; GET /inventory/trace/{code}                       inventory.view / inventory.trace                      Balance + subledger + movement chain                  403/404

  Stocktake   /stocktake-sessions; /counts; /variances; /apply-adjustment       stocktake.count/apply                                 Snapshot, cutoff, ack, Idempotency-Key, If-Match      403/409/412/422/428

  Warranty    /warranty-cases; /status; /return                                 warranty.manage                                       TEMP_ONLY conditional fields; one active case         403/409/412/422

  PV          GET /pv/products; /industries; /recommendations; PATCH /publish   pv.product.view / pv.publish                          Read-only inventory; publish uses If-Match            403/404/412/422

  Reports     GET /reports/\*; POST /reports/export                             report.view / report.export                           Same filters/scope; export audited                    403/422
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 8.2. HTTP/Error Contract

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **HTTP**   **Error code examples**                                                                       **Use**
  ---------- --------------------------------------------------------------------------------------------- ---------------------------------------------------------
  400        INVALID_JSON / INVALID_QUERY / INVALID_PATH                                                   Malformed request.

  401        AUTH_REQUIRED / TOKEN_EXPIRED                                                                 Authentication.

  403        PERMISSION_DENIED / DATA_SCOPE_DENIED                                                         Action/scope denial.

  404        RESOURCE_NOT_FOUND                                                                            Missing or masked resource.

  409        STATE_CONFLICT / IDEMPOTENCY_CONFLICT / CONCURRENCY_CONFLICT / DOWNSTREAM_DEPENDENCY_EXISTS   State/duplicate/concurrent/dependency guard.

  412        STALE_VERSION                                                                                 If-Match/session version stale.

  422        VALIDATION_ERROR / BUSINESS_RULE_VIOLATION / INSUFFICIENT_STOCK                               Field/business validation.

  428        PRECONDITION_REQUIRED                                                                         Missing If-Match/Idempotency-Key where required.

  500        INTERNAL_ERROR                                                                                Unexpected; return request_id; transaction rolled back.
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 8.3. Screen / UX Baseline (BA-level)

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Screen ID**   **Screen**                        **Key controls/actions**                                               **Actors**          **Critical UX rule**
  --------------- --------------------------------- ---------------------------------------------------------------------- ------------------- ------------------------------------------------
  SCR-IAM-01      User list/detail                  Search, status, role/scope assignment, deactivate                      Admin               No self-escalation; audit permission change

  SCR-MST-01      SKU & Product Master              Brand/category/model/power/package/version, serial mode                Admin/QL kho        Immutable code/mode after stock

  SCR-AGY-01      Agency master                     Create/edit/deactivate; recipient info                                 Admin/QL kho        No warehouse/balance fields

  SCR-DEF-01      Defect catalog                    Code/name/status                                                       Admin/QL kho        Inactive not selectable for new case

  SCR-IN-01       Inbound list/detail               DRAFT/SCANNING/partial progress; scan; post subset; close remainder    QL/NV kho           Buttons by permission; idempotency feedback

  SCR-OUT-01      Outbound list/detail              Agency recipient; scan carton/item/box; post subset; close remainder   QL/NV kho           Available/remaining visible; concurrency error

  SCR-REV-01      Reversal/Correction               Original movement, reversible qty, dependencies, reason, condition     QL kho              Guard summary before confirm; chain history

  SCR-INV-01      Inventory query                   Filter SKU/type/status; balance; container hint                        QL/NV/Lãnh đạo      No double count

  SCR-TRACE-01    Physical trace                    Search code; item/container/current status/movement chain              Authorized users    Masked by scope

  SCR-STK-01      Stocktake session/count/review    Snapshot, actual, movement warning, approve/waive/apply                QL/NV kho           If-Match; ack warning

  SCR-WAR-01      Warranty receive/process/return   Identified/TEMP_ONLY; customer; defect; status                         Warranty staff      Conditional required fields; one active case

  SCR-RPT-01      Reports                           Inventory, XNT, history, stocktake, warranty defect                    QL/Lãnh đạo         Filter/period/timezone; export by permission

  SCR-PV-01       PV product list                   Search/filter industry/category/stock; card available_qty              PV viewer           Responsive 360/768/1280+

  SCR-PV-02       PV product detail                 Images/spec/compatible accessories/industries/available_qty            PV viewer           Read-only; no internal data

  SCR-PV-ADM-01   PV publish/master                 Publish, tag, industry mapping, recommendation priority                Admin/QL kho        Inactive SKU cannot publish

  SCR-DEMO-01     Demo scanner component            Generate one/many code values in supported flows                       Operational users   Same validation as real/manual scan
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

*Detailed UI/UX/Figma is a downstream artifact initiated after the BA baseline is approved. The embedded Screen Map and Field Specification provide sufficient BA input for UI/UX initiation. Detailed Figma approval does not block SRS/FRD Done but blocks FE detailed implementation.*

## 8.4. OpenAPI Draft và Endpoint Permission Mapping

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Artifact**                           **Reference**          **Content**                                                                                                                                                        **Status**
  -------------------------------------- ---------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------ -----------------------------------------------------
  Machine-readable OpenAPI BA baseline   HN_OpenAPI_v1_0.yaml   OpenAPI 3.1.0; operationId; request/response/error schemas; path/query/header parameters; pagination; bearer security; x-permission; examples; x-contract-tests.   ISSUED WITH SRS v1.4; TECH APPROVAL PENDING WWHN-31

  Physical OpenAPI/Schema                WWHN-31                Tech refines physical schema/index/protocol and approves implementation contract after BA Done without changing approved business semantics.                       PLANNED AFTER BA DONE

  Permission implementation/review       WWHN-40                Map x-permission to backend middleware/policy and QA negative tests.                                                                                               PLANNED AFTER BA DONE / LINKED
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 9. NON-FUNCTIONAL REQUIREMENTS

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **NFR ID**    **Requirement**                                                  **Measure / TC**
  ------------- ---------------------------------------------------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  NFR-SRS-001   All stock-changing actions idempotent.                           Retry 3 times cùng key/payload = một movement/balance change; TC-NFR-001.

  NFR-SRS-002   Atomic transaction cho document/movement/balance/subledger.      Injected failure rollback all; TC-NFR-002.

  NFR-SRS-003   Concurrency prevents negative stock and duplicate reversal.      Parallel requests: one success; others conflict/insufficient; TC-NFR-003.

  NFR-SRS-004   Audit post/reversal/close remainder/permission/master changes.   Actor/time/reason/request_id/before-after where allowed; TC-NFR-004.

  NFR-SRS-005   Security enforced by backend permission and scope.               403/404 policy; negative endpoint tests; TC-NFR-005.

  NFR-SRS-006   Responsive/browser/device matrix.                                Desktop \>=1280px; tablet \>=768px; mobile \>=360px; Chrome/Edge latest 2 versions, Chrome Android latest 2, Safari iOS latest 2; TC-NFR-006.

  NFR-SRS-007   Scan throughput và feedback latency.                             Batch \<=500 mã; batch P95 \<=5 giây; single-scan UI feedback P95 \<=500ms và end-to-end classify P95 \<=1.5 giây trong test environment; TC-NFR-007.

  NFR-SRS-008   Observability.                                                   X-Request-Id echo/log; stock action log includes idempotency/result; TC-NFR-008.

  NFR-SRS-009   Read/list API latency.                                           P95 \<=2 giây, P99 \<=4 giây với page_size\<=50 và approved dataset; TC-NFR-009.

  NFR-SRS-010   Stock action latency và concurrency.                             P95 \<=3 giây; tối thiểu 20 concurrent stock actions và 50 concurrent read users; không âm kho/double movement; TC-NFR-010.

  NFR-SRS-011   Availability và backup.                                          Availability \>=99.5% theo tháng, loại trừ planned maintenance đã thông báo; daily backup; restore test mỗi quý hoặc trước go-live; TC-NFR-011.

  NFR-SRS-012   Recovery Point Objective.                                        RPO \<=24 giờ; TC-NFR-012.

  NFR-SRS-013   Recovery Time Objective.                                         RTO \<=8 giờ cho dịch vụ core sau sự cố được phân loại; TC-NFR-013.

  NFR-SRS-014   Retention audit/movement.                                        Giữ tối thiểu 5 năm hoặc lâu hơn nếu hợp đồng/pháp luật yêu cầu; không hard-delete ledger; TC-NFR-014.

  NFR-SRS-015   Privacy, masking và warranty PII retention.                      Full PII chỉ cho warranty.pii.view; masked by default; export PII cần warranty.pii.export; không raw PII trong app log; retention 5 năm sau đóng case rồi anonymize/purge; TC-NFR-015.

  NFR-SRS-016   Export safety và cache staleness.                                Export private/audited/scope-correct; App PV inventory cache max staleness \<=60 giây, hiển thị data_as_of; TC-NFR-016.

  NFR-SRS-017   Migration/import capacity.                                       Dry-run tối thiểu 10,000 rows/file; error file đầy đủ row/field/code/message; no commit khi critical error \>0; TC-NFR-017.

  NFR-SRS-018   Retention/purge execution.                                       Audit/movement \>=5 years; warranty PII purge/anonymize job có report, retry và legal-hold exclusion; TC-NFR-018.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 10. TRACEABILITY MASTER

## 10.1. Functional Traceability

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Source/Coverage**    **REQ**       **BR/Decision**                        **AC**       **API/UI/Data**              **TC**       **Evidence Location**
  ---------------------- ------------- -------------------------------------- ------------ ---------------------------- ------------ --------------------------------------------------------------------------------------------------------------------------------------------------------------------
  SRC-002 / CTR-WM-001   REQ-SRS-001   BR-SCOPE-01..05                        AC-SRS-001   Warehouse/Agency/Inventory   TC-SRS-001   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-001/SRC-002        REQ-SRS-002   BR-SKU-01..10; BR-COMP-01              AC-SRS-002   SKU API/UI/Data              TC-SRS-002   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  DR-CARRIER-001         REQ-SRS-003   BR-CODE-01..07; BR-CARRIER-01          AC-SRS-003   Item/Physical_Code           TC-SRS-003   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  DR-CARRIER-001         REQ-SRS-004   BR-CARRIER-01; BR-CON-01..08           AC-SRS-004   Container/Physical_Code      TC-SRS-004   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-001/SRC-002        REQ-SRS-005   BR-SCAN-01..02; BR-SCAN-ADD-01..04     AC-SRS-005   Scan API/UI                  TC-SRS-005   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-002                REQ-SRS-006   BR-IN-01; BR-INOUT-01..02              AC-SRS-006   Inbound API/UI               TC-SRS-006   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  DEC-PARTIAL-001        REQ-SRS-007   BR-PARTIAL-IN-01..03                   AC-SRS-007   Post Receipt/Data/Report     TC-SRS-007   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  DEC-INV-001            REQ-SRS-008   BR-IN-02; BR-IDEMP-01..03; BR-TXN-01   AC-SRS-008   API/DB transaction           TC-SRS-008   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-002                REQ-SRS-009   BR-PTW-01..02                          AC-SRS-009   Putaway UI/API               TC-SRS-009   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-002                REQ-SRS-010   BR-OUT-01; BR-INOUT-01..02             AC-SRS-010   Outbound API/UI              TC-SRS-010   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  DEC-PARTIAL-001        REQ-SRS-011   BR-PARTIAL-OUT-01..03                  AC-SRS-011   Post Issue/Data/Report       TC-SRS-011   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  DEC-INV-001            REQ-SRS-012   BR-OUT-02..05; BR-CONC-01..03          AC-SRS-012   API/locking                  TC-SRS-012   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-002/DEC-INV-001    REQ-SRS-013   BR-REV-01..12                          AC-SRS-013   Reversal API/Data            TC-SRS-013   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-001/SRC-002        REQ-SRS-014   BR-COUNT-01..10                        AC-SRS-014   Stocktake API/UI/Data        TC-SRS-014   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  DEC-INV-001            REQ-SRS-015   BR-COUNT-11..13; BR-IDEMP-01           AC-SRS-015   Stocktake API/DB             TC-SRS-015   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-001/SRC-002        REQ-SRS-016   BR-WAR-01..13                          AC-SRS-016   Warranty API/UI              TC-SRS-016   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  DR-PLAT-001            REQ-SRS-017   BR-PV-01..08; NFR-SRS-006              AC-SRS-017   PV UI/API                    TC-SRS-017   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-001/SRC-002        REQ-SRS-018   BR-PV-02..03; BR-PV-09..14             AC-SRS-018   PV API/read model            TC-SRS-018   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-001/SRC-002        REQ-SRS-019   BR-PV-05..08                           AC-SRS-019   Recommendation API/UI        TC-SRS-019   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-002                REQ-SRS-020   BR-PV-01; BR-PV-MST-01..03             AC-SRS-020   PV Admin API/UI              TC-SRS-020   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-002                REQ-SRS-021   BR-MIG-01..06                          AC-SRS-021   Import API/Data              TC-SRS-021   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-002                REQ-SRS-022   BR-UAT-01..05                          AC-SRS-022   Operational package          TC-SRS-022   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  DEC-INV-001            REQ-SRS-023   BR-INV-01; BR-RECON-01..04             AC-SRS-023   Data/ADR                     TC-SRS-023   WWHN-33 Test Master/execution planned after BA Done; actual evidence pending.

  SRC-002/WWHN-40        REQ-SRS-024   BR-API-ERR-01..09; BR-SEC-01..05       AC-SRS-024   API/Security                 TC-SRS-024   WWHN-31/WWHN-40; approval/evidence pending downstream.

  DEC-BA-GATE-001        REQ-SRS-025   BR-BASE-01..06                         AC-SRS-025   Baseline Index               TC-SRS-025   WWHN-31/WWHN-40; approval/evidence pending downstream.

  SRC-002                REQ-SRS-026   BR-IAM-01..08                          AC-SRS-026   IAM API/UI/Data              TC-SRS-026   WWHN-40 for permission implementation; WWHN-33 for QA evidence.

  SRC-002                REQ-SRS-027   BR-AGY-01; BR-SCOPE-02..04             AC-SRS-027   Agency API/UI/Data           TC-SRS-027   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-002                REQ-SRS-028   BR-DEF-01..04                          AC-SRS-028   Defect API/UI/Data           TC-SRS-028   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-002                REQ-SRS-029   BR-MST-01..07; BR-SKU-05..10           AC-SRS-029   Product Master API/UI        TC-SRS-029   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-001/SRC-002        REQ-SRS-030   BR-TRACE-01..06; BR-CON-04             AC-SRS-030   Inventory Query/Trace        TC-SRS-030   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-002                REQ-SRS-031   BR-RPT-01..07                          AC-SRS-031   Reports API/UI               TC-SRS-031   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-002                REQ-SRS-032   BR-EXP-01..05                          AC-SRS-032   Report Export                TC-SRS-032   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-001/SRC-002        REQ-SRS-033   BR-PV-MST-01..06                       AC-SRS-033   PV Master API/UI             TC-SRS-033   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.

  SRC-002                REQ-SRS-034   BR-BATCH-01..05; BR-SKU-06..08         AC-SRS-034   Import/Condition Data        TC-SRS-034   Contract scope: comment 12625/pages 1-2 + WWHN-333 BRD baseline; SRS approval/effective evidence at WWHN-334; WWHN-33 Test Master/execution planned after BA Done.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 10.2. NFR Traceability

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Source**                               **NFR**       **Rule**    **TC**       **Measure**                                                                  **Evidence**
  ---------------------------------------- ------------- ----------- ------------ ---------------------------------------------------------------------------- ---------------------------------------------------------------------------------------
  DEC-INV-001 / SRS v1.4                   NFR-SRS-001   BR-NFR-01   TC-NFR-001   Retry 3 times cùng key/payload = một movement/balance change                 WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  DEC-INV-001 / SRS v1.4                   NFR-SRS-002   BR-NFR-02   TC-NFR-002   Injected failure rollback all                                                WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  DEC-INV-001 / SRS v1.4                   NFR-SRS-003   BR-NFR-03   TC-NFR-003   Parallel requests: one success                                               WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  DEC-INV-001 / SRS v1.4                   NFR-SRS-004   BR-NFR-04   TC-NFR-004   Actor/time/reason/request_id/before-after where allowed                      WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-005   BR-NFR-05   TC-NFR-005   403/404 policy                                                               WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-006   BR-NFR-06   TC-NFR-006   Desktop \>=1280px                                                            WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-007   BR-NFR-07   TC-NFR-007   Tối thiểu 500 mã/lần, xử lý \<=5 giây trong môi trường test chuẩn            WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  DEC-INV-001 / SRS v1.4                   NFR-SRS-008   BR-NFR-08   TC-NFR-008   X-Request-Id echo/log                                                        WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-009   BR-NFR-09   TC-NFR-009   P95 \<=2 giây cho inventory/product/report list theo dataset test approved   WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-010   BR-NFR-10   TC-NFR-010   P95 \<=3 giây, không tính thời gian thiết bị scan                            WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-011   BR-NFR-11   TC-NFR-011   Backup dữ liệu hằng ngày                                                     WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-012   BR-NFR-12   TC-NFR-012   RPO \<=24 giờ                                                                WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-013   BR-NFR-13   TC-NFR-013   RTO \<=8 giờ cho dịch vụ core sau sự cố được phân loại                       WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-014   BR-NFR-14   TC-NFR-014   Giữ tối thiểu 5 năm hoặc lâu hơn nếu hợp đồng/pháp luật yêu cầu              WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-015   BR-NFR-15   TC-NFR-015   Minimize customer name/phone                                                 WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.

  SRS v1.4 baseline / WWHN-31 or WWHN-40   NFR-SRS-016   BR-NFR-16   TC-NFR-016   Export đúng scope                                                            WWHN-33 execution evidence pending; technical setup WWHN-31/WWHN-40 where applicable.
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **TRACEABILITY INTEGRITY RESULT: 34 functional requirements (33 Must, 1 Should), 34 mapped ACs, 34 mapped functional TCs, 16 NFRs và 16 TC-NFR; 0 orphan requirement/TC/NFR và 0 duplicate ID ở mức tài liệu. BA test-design definitions đã hoàn tất. Actual Test Master/execution evidence được tạo tại WWHN-33 sau BA Done; tài liệu không tuyên bố test passed trước khi thực thi.**
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 11. TECHNICAL BASELINE AND READINESS GATE

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Gate**                       **Current**                                                      **Ready/Done condition**
  ------------------------------ ---------------------------------------------------------------- -----------------------------------------------------------------------------------------------------------------------------------
  BA requirement content         COMPLETE                                                         REQ/AC/TC, rules, P0 closure, contract/source mapping complete.

  Formal SRS baseline approval   ON WWHN-334 DONE                                                 PM/PO transition is formal approval evidence; transition date is effective date.

  Contract coverage              COMPLETE AT GENERAL SCOPE + PHASING CONTROL                      Contract pages 1-2; BRD/SRS detail; non-MVP contractual capabilities retained in roadmap unless CR.

  Logical ERD/Data Dictionary    BA LOGICAL BASELINE COMPLETE                                     Physical baseline/index/DDL approval at WWHN-31 after BA Done.

  OpenAPI                        BA MACHINE-READABLE BASELINE ISSUED / TECH APPROVAL DOWNSTREAM   HN_OpenAPI_v1_0.yaml; Tech approval at WWHN-31 before API implementation/contract execution.

  Permission                     BA MAPPING COMPLETE                                              Implementation/review at WWHN-40 after BA Done.

  UX                             BA SCREEN/FIELD REQUIREMENTS COMPLETE                            Detailed UI/UX/Figma starts after BA baseline and blocks FE detailed implementation, not SRS Done.

  QA testability/execution       BA TEST-DESIGN DEFINITIONS COMPLETE / WWHN-33 DOWNSTREAM         QA may review testability during SRS review; detailed Test Master/test data/execution at WWHN-33 after BA Done.

  Core flow Ready for Dev        NO UNTIL WWHN-31 + WWHN-40                                       BA Done is prerequisite, not equivalent to Ready for Dev.

  Ready for QA/Beta              NO UNTIL WWHN-33 + EXECUTION GATES                               WWHN-33 blocks QA/Beta readiness, not BA artifact Done.

  SRS/FRD Jira Done              CONDITIONAL ON WWHN-334 PM/PO APPROVAL                           BA content complete, no core TBD, source/version controlled, attachment v1.4 current; downstream artifacts are not prerequisites.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  KẾT LUẬN SRS GATE: Tài liệu v1.4 đủ nội dung để formal approval. WWHN-334 được transition DONE khi PM/PO chấp nhận attachment v1.4 và baseline bundle; transition date là ngày hiệu lực. WWHN-31/WWHN-40, detailed UI/UX/Figma và WWHN-33 được kích hoạt sau BA Done và chặn Ready for Dev/FE/QA/Beta theo phạm vi, không chặn SRS Done.
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 12. CHANGE LOG

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Version**   **Date**     **Change**                                                                                                                                                                                                                                                                                                                     **Author**
  ------------- ------------ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ ------------
  1.0           22/07/2026   Initial SRS/FRD from BRD v3.10; decisions and normalized traceability.                                                                                                                                                                                                                                                         BA

  1.1           22/07/2026   Prepared formal review edition; external closure register and readiness distinction.                                                                                                                                                                                                                                           BA

  1.2           23/07/2026   Closed BA-controlled P0: contract reference, source supersession, conditional approval/effective date, internal decision governance, 34 REQ/AC/TC, logical ERD, field-level dictionary, OpenAPI draft, screen/permission baseline, NFR metrics, NFR traceability, reversal/correction guards and downstream Jira gate model.   BA

  1.3           23/07/2026   Closed document-level P1: GWT core AC, stock-action test design, complete DD supplement, machine-readable OpenAPI draft, field-spec candidate, quantified NFR, privacy, Physical Code lifecycle, report contract, location decision, migration/dry-run criteria and SRS DoD separation.                                        BA

  1.4           23/07/2026   Final approval candidate: formal SRS task corrected to WWHN-334; BRD v3.11 controlling source; WWHN-33 and detailed Figma moved downstream after BA Done; contract/MVP phasing and roadmap clarified; HN_OpenAPI_v1_0.yaml completed; effective date set to WWHN-334 DONE date.                                                BA
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 13. P1 IMPLEMENTATION READINESS BASELINE

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **P1 CONTROL STATEMENT: Các khoảng trống đặc tả ở mức BA đã được đóng trong v1.4. Tech approval, detailed UI/UX/Figma, Test Master, test execution, UAT và migration/cutover evidence vẫn có owner và downstream gate rõ; chúng không bị tuyên bố đã hoàn tất và không tạo circular dependency với SRS Done.**
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.1. P1 Closure Matrix

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **P1**   **Content**                                **Closure**                                                   **Evidence/Gate**
  -------- ------------------------------------------ ------------------------------------------------------------- -------------------------------------------------------------------------------
  P1-01    Core AC Given/When/Then                    CLOSED IN v1.4                                                §13.2; actor/permission/precondition/test data/state/stock/movement/API/UI/DB

  P1-02    Stock-changing action test coverage        CLOSED AT TEST-DESIGN LEVEL                                   §13.3; execution evidence at WWHN-33/release tickets

  P1-03    Complete Data Dictionary attributes        CLOSED AT LOGICAL BASELINE                                    §13.4; physical DDL/index approval at WWHN-31

  P1-04    Machine-readable OpenAPI                   BA ARTIFACT ISSUED / TECH APPROVAL DOWNSTREAM                 HN_OpenAPI_v1_0.yaml; §13.5; WWHN-31

  P1-05    Screen Map/Figma/field specification       BA SCREEN/FIELD SPEC COMPLETE / DETAILED FIGMA DOWNSTREAM     §13.6; DR-UX-001; blocks FE detailed implementation, not SRS Done

  P1-06    Quantified NFR                             CLOSED IN v1.4                                                §13.7 + NFR-SRS-001..018

  P1-07    Privacy contract                           POLICY BASELINE COMPLETE / IMPLEMENTATION REVIEW DOWNSTREAM   §13.8; DR-PRIV-001; WWHN-31/WWHN-40 as applicable

  P1-08    Physical Code lifecycle                    CLOSED IN v1.4                                                §13.9

  P1-09    Report contract                            CLOSED IN v1.4                                                §13.10

  P1-10    location_hint/zone decision                CLOSED BY DECISION                                            DR-LOC-001; §13.11

  P1-11    Migration template/sample/error/dry-run    DOC CONTRACT CLOSED / ACTUAL DRY-RUN PENDING                  §13.12; Jira comment 12634

  P1-12    SRS DoD separated from release execution   CLOSED IN v1.4                                                §13.13; DEC-BA-GATE-001
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.2. Core Acceptance Criteria - Given/When/Then

  ------------------------------------------------------------------------------------------------------------------------------------------------
  **Test data IDs below are design fixtures. QA may map them to concrete seed records in WWHN-33 without changing expected business semantics.**
  ------------------------------------------------------------------------------------------------------------------------------------------------

  ------------------------------------------------------------------------------------------------------------------------------------------------

### AC-GWT-IN-001 - Post Receipt partial thành công

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Given**    Actor NV kho có inbound.post; Inbound IN-001 ở SCANNING, version=3; line SKU HN-MK-001 expected=10, posted=0, remaining=10; 10 ITEM có chip ACTIVE và chưa thuộc movement; Balance AVAILABLE=20.

  **When**     Client POST /inbound-documents/{id}/post-receipt với Idempotency-Key=IK-IN-001, If-Match=\"3\" và subset quantity=6.

  **Then**     • API trả 200, ETag/version=4, replayed=false; UI hiển thị thành công và tiến độ 6/10.\
               • Document/line = PARTIALLY_POSTED; posted_qty=6; remaining_qty=4.\
               • Stock +6; Inventory_Balance AVAILABLE 20→26; 6 Item_Instance → IN_STOCK.\
               • Tạo đúng một Posting_Event và các RECEIPT_POSTED movement; movement_key/idempotency unique.\
               • Document, movement, balance, item/subledger và audit commit trong cùng transaction.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### AC-GWT-OUT-001 - Post Issue thành công và không âm kho

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ ----------------------------------------------------------------------------------------------------------------------------------------------------
  **Given**    Actor NV kho có outbound.post; Outbound OUT-001 SCANNING version=2; line planned=5, issued=0; Balance AVAILABLE=8; 5 ITEM IN_STOCK; Agency active.

  **When**     Client POST /outbound-documents/{id}/post-issue với IK-OUT-001, If-Match=\"2\" và 5 item_codes.

  **Then**     • API 200; UI success, issued 5/5.\
               • Document/line = POSTED; Item status IN_STOCK→ISSUED.\
               • Stock -5; Balance 8→3; đúng 5 ISSUE_POSTED movement hoặc movement lines theo physical design.\
               • Agency chỉ lưu recipient; không tạo agency stock/balance.\
               • Atomic commit; audit actor/request/idempotency; không có negative balance.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------

### AC-GWT-STK-001 - Apply Adjustment line approved

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Given**    Actor QL kho có stocktake.apply; Session STK-001 REVIEWING version=5; snapshot=100, net movement đến cutoff=-10, actual=88, expected=90, variance=-2; line APPROVED và movement warning đã ack.

  **When**     Client POST /stocktake-sessions/{id}/apply-adjustment với IK-STK-001, If-Match=\"5\" và approved_variance_id.

  **Then**     • API 200; UI line → APPLIED và session đóng khi mọi line APPLIED/WAIVED.\
               • Stock -2; Balance 90→88; tạo ADJUST_OUT -2.\
               • Snapshot/count giữ immutable; variance lưu expected/actual/adjustment link.\
               • Retry cùng key trả response cũ; không tạo adjustment lần hai.\
               • Transaction lỗi ở movement/balance/subledger phải rollback all.
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### AC-GWT-REV-001 - Reverse Issue hàng SELLABLE

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Given**    Actor QL kho có inventory.reversal.post; original ISSUE movement qty=-4, reversible_qty=4, không dependency; hàng vật lý đã quay lại; item condition SELLABLE; reversal DRAFT version=1.

  **When**     Client POST /reversals/{id}/post với IK-REV-001 và If-Match=\"1\".

  **Then**     • API 200; reversal=POSTED; UI hiển thị original, reverse và net effect.\
               • Stock +4; item→IN_STOCK; Balance tăng đúng 4.\
               • Tạo ISSUE_REVERSED tham chiếu original_movement_id/correction_chain_id; movement gốc giữ nguyên.\
               • Audit reason/actor/request_id; report gross và net.\
               • Concurrent post trên cùng reversible scope chỉ một request commit.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### AC-GWT-REV-002 - Reverse Receipt bị chặn bởi downstream dependency

  ----------------------------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ ---------------------------------------------------------------------------------------------------------------------
  **Given**    Actor có quyền; original RECEIPT đã có item được ISSUE; reversible request qty=1; document version hiện hành.

  **When**     Client gọi Post Reversal.

  **Then**     • API 409 DOWNSTREAM_DEPENDENCY_EXISTS; UI hiển thị dependency và hướng dẫn đảo theo thứ tự ngược.\
               • Không đổi document gốc, stock, balance, item, movement.\
               • Không tạo Posting_Event/Reversal movement; audit failed attempt chỉ chứa request_id và error code, không raw PII.
  ----------------------------------------------------------------------------------------------------------------------------------

### AC-GWT-IDEMP-001 - Retry cùng key và conflict khác payload

  ----------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ ---------------------------------------------------------------------------------------------------
  **Given**    Một stock action đã commit bằng key IK-001 và payload hash H1.

  **When**     Client retry lần 2/3 cùng key+H1, sau đó gọi key IK-001 với payload hash H2.

  **Then**     • Retry H1 trả cùng business result, replayed=true, không đổi stock/movement/version lần hai.\
               • Request H2 trả 409 IDEMPOTENCY_CONFLICT.\
               • DB giữ một Posting_Event trong operation scope; payload_hash và result_reference được kiểm tra.
  ----------------------------------------------------------------------------------------------------------------

### AC-GWT-CONC-001 - Hai request cạnh tranh cùng tồn

  -------------------------------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ ------------------------------------------------------------------------------------------------------------------------
  **Given**    Balance SKU=5, version=10; hai request Post Issue A và B cùng yêu cầu 4; cả hai có key khác nhau và permission hợp lệ.

  **When**     A và B commit gần đồng thời.

  **Then**     • Tối đa một request thành công; request còn lại trả 409/412/422 theo điểm phát hiện.\
               • Balance không âm; tổng ISSUE_POSTED \<=5.\
               • UI request thua hiển thị refresh/retry, không tự submit lại bằng key mới.\
               • Lock/version và transaction log có evidence cho contract/concurrency test.
  -------------------------------------------------------------------------------------------------------------------------------------

### AC-GWT-MIG-001 - Commit Opening Balance sau dry-run PASS

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Clause**   **Specification**
  ------------ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Given**    Actor Data Migration Owner có quyền; batch MIG-001 DRY_RUN_VALIDATED; checksum không đổi; critical_error=0; duplicate=0; reconciliation pre-check PASS; QL kho xác nhận opening.

  **When**     Client commit migration batch trong cutover window.

  **Then**     • Tạo opening records/movements đúng một lần; Import_Batch=COMMITTED.\
               • Ledger/balance/subledger reconciliation=PASS; UI hiển thị summary và evidence link.\
               • Nếu bất kỳ bước nào lỗi, rollback toàn batch và status=FAILED; không để partial opening data.\
               • Re-run cùng checksum/batch key không duplicate; file đổi checksum phải dry-run lại.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.3. Stock-changing Action Test Design Matrix

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **TC ID**   **Action**         **Coverage**            **Permission**            **Test data/precondition**                                      **Expected HTTP**            **Expected state/stock/movement/DB**
  ----------- ------------------ ----------------------- ------------------------- --------------------------------------------------------------- ---------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------
  TC-P1-001   POST_RECEIPT       POSITIVE                inbound.post              Valid actor/state/data/header                                   200/201                      +N; RECEIPT_POSTED; Commit exactly once; expected state, stock, movement and audit.

  TC-P1-002   POST_RECEIPT       NEGATIVE                inbound.post              Invalid quantity/code/dependency/business rule                  409/422                      +N; RECEIPT_POSTED; No stock/movement; return field/business error.

  TC-P1-003   POST_RECEIPT       PERMISSION              inbound.post              Actor lacks permission or scope                                 403/404                      +N; RECEIPT_POSTED; No write; denied attempt logged without sensitive payload.

  TC-P1-004   POST_RECEIPT       INVALID_STATE           inbound.post              Source DRAFT/CANCELLED/POSTED or line not eligible              409                          +N; RECEIPT_POSTED; No write; state remains unchanged.

  TC-P1-005   POST_RECEIPT       RETRY_SAME_KEY          inbound.post              3 retries same key + same canonical payload                     200 replay                   +N; RECEIPT_POSTED; One Posting_Event/movement/balance effect; replayed=true.

  TC-P1-006   POST_RECEIPT       SAME_KEY_DIFF_PAYLOAD   inbound.post              Same key, different payload hash                                409                          +N; RECEIPT_POSTED; No second write; IDEMPOTENCY_CONFLICT.

  TC-P1-007   POST_RECEIPT       CONCURRENCY             inbound.post              Two parallel requests on same stock/reversible/session scope    one 200; other 409/412/422   +N; RECEIPT_POSTED; No negative stock, over-post, duplicate movement or lost update.

  TC-P1-008   POST_RECEIPT       ROLLBACK                inbound.post              Inject failure after document/movement/balance/subledger step   500                          +N; RECEIPT_POSTED; Rollback all business writes; request_id/error audit retained; retry can safely execute.

  TC-P1-009   POST_ISSUE         POSITIVE                outbound.post             Valid actor/state/data/header                                   200/201                      -N; ISSUE_POSTED; Commit exactly once; expected state, stock, movement and audit.

  TC-P1-010   POST_ISSUE         NEGATIVE                outbound.post             Invalid quantity/code/dependency/business rule                  409/422                      -N; ISSUE_POSTED; No stock/movement; return field/business error.

  TC-P1-011   POST_ISSUE         PERMISSION              outbound.post             Actor lacks permission or scope                                 403/404                      -N; ISSUE_POSTED; No write; denied attempt logged without sensitive payload.

  TC-P1-012   POST_ISSUE         INVALID_STATE           outbound.post             Source DRAFT/CANCELLED/POSTED or line not eligible              409                          -N; ISSUE_POSTED; No write; state remains unchanged.

  TC-P1-013   POST_ISSUE         RETRY_SAME_KEY          outbound.post             3 retries same key + same canonical payload                     200 replay                   -N; ISSUE_POSTED; One Posting_Event/movement/balance effect; replayed=true.

  TC-P1-014   POST_ISSUE         SAME_KEY_DIFF_PAYLOAD   outbound.post             Same key, different payload hash                                409                          -N; ISSUE_POSTED; No second write; IDEMPOTENCY_CONFLICT.

  TC-P1-015   POST_ISSUE         CONCURRENCY             outbound.post             Two parallel requests on same stock/reversible/session scope    one 200; other 409/412/422   -N; ISSUE_POSTED; No negative stock, over-post, duplicate movement or lost update.

  TC-P1-016   POST_ISSUE         ROLLBACK                outbound.post             Inject failure after document/movement/balance/subledger step   500                          -N; ISSUE_POSTED; Rollback all business writes; request_id/error audit retained; retry can safely execute.

  TC-P1-017   APPLY_ADJUSTMENT   POSITIVE                stocktake.apply           Valid actor/state/data/header                                   200/201                      ±N; ADJUST_IN/ADJUST_OUT; Commit exactly once; expected state, stock, movement and audit.

  TC-P1-018   APPLY_ADJUSTMENT   NEGATIVE                stocktake.apply           Invalid quantity/code/dependency/business rule                  409/422                      ±N; ADJUST_IN/ADJUST_OUT; No stock/movement; return field/business error.

  TC-P1-019   APPLY_ADJUSTMENT   PERMISSION              stocktake.apply           Actor lacks permission or scope                                 403/404                      ±N; ADJUST_IN/ADJUST_OUT; No write; denied attempt logged without sensitive payload.

  TC-P1-020   APPLY_ADJUSTMENT   INVALID_STATE           stocktake.apply           Source DRAFT/CANCELLED/POSTED or line not eligible              409                          ±N; ADJUST_IN/ADJUST_OUT; No write; state remains unchanged.

  TC-P1-021   APPLY_ADJUSTMENT   RETRY_SAME_KEY          stocktake.apply           3 retries same key + same canonical payload                     200 replay                   ±N; ADJUST_IN/ADJUST_OUT; One Posting_Event/movement/balance effect; replayed=true.

  TC-P1-022   APPLY_ADJUSTMENT   SAME_KEY_DIFF_PAYLOAD   stocktake.apply           Same key, different payload hash                                409                          ±N; ADJUST_IN/ADJUST_OUT; No second write; IDEMPOTENCY_CONFLICT.

  TC-P1-023   APPLY_ADJUSTMENT   CONCURRENCY             stocktake.apply           Two parallel requests on same stock/reversible/session scope    one 200; other 409/412/422   ±N; ADJUST_IN/ADJUST_OUT; No negative stock, over-post, duplicate movement or lost update.

  TC-P1-024   APPLY_ADJUSTMENT   ROLLBACK                stocktake.apply           Inject failure after document/movement/balance/subledger step   500                          ±N; ADJUST_IN/ADJUST_OUT; Rollback all business writes; request_id/error audit retained; retry can safely execute.

  TC-P1-025   POST_REVERSAL      POSITIVE                inventory.reversal.post   Valid actor/state/data/header                                   200/201                      inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; Commit exactly once; expected state, stock, movement and audit.

  TC-P1-026   POST_REVERSAL      NEGATIVE                inventory.reversal.post   Invalid quantity/code/dependency/business rule                  409/422                      inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; No stock/movement; return field/business error.

  TC-P1-027   POST_REVERSAL      PERMISSION              inventory.reversal.post   Actor lacks permission or scope                                 403/404                      inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; No write; denied attempt logged without sensitive payload.

  TC-P1-028   POST_REVERSAL      INVALID_STATE           inventory.reversal.post   Source DRAFT/CANCELLED/POSTED or line not eligible              409                          inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; No write; state remains unchanged.

  TC-P1-029   POST_REVERSAL      RETRY_SAME_KEY          inventory.reversal.post   3 retries same key + same canonical payload                     200 replay                   inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; One Posting_Event/movement/balance effect; replayed=true.

  TC-P1-030   POST_REVERSAL      SAME_KEY_DIFF_PAYLOAD   inventory.reversal.post   Same key, different payload hash                                409                          inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; No second write; IDEMPOTENCY_CONFLICT.

  TC-P1-031   POST_REVERSAL      CONCURRENCY             inventory.reversal.post   Two parallel requests on same stock/reversible/session scope    one 200; other 409/412/422   inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; No negative stock, over-post, duplicate movement or lost update.

  TC-P1-032   POST_REVERSAL      ROLLBACK                inventory.reversal.post   Inject failure after document/movement/balance/subledger step   500                          inverse/net; RECEIPT_REVERSED/ISSUE_REVERSED/CORRECTION; Rollback all business writes; request_id/error audit retained; retry can safely execute.

  TC-P1-033   MIGRATION_COMMIT   POSITIVE                migration.commit          Valid actor/state/data/header                                   200/201                      +opening; OPENING; Commit exactly once; expected state, stock, movement and audit.

  TC-P1-034   MIGRATION_COMMIT   NEGATIVE                migration.commit          Invalid quantity/code/dependency/business rule                  409/422                      +opening; OPENING; No stock/movement; return field/business error.

  TC-P1-035   MIGRATION_COMMIT   PERMISSION              migration.commit          Actor lacks permission or scope                                 403/404                      +opening; OPENING; No write; denied attempt logged without sensitive payload.

  TC-P1-036   MIGRATION_COMMIT   INVALID_STATE           migration.commit          Source DRAFT/CANCELLED/POSTED or line not eligible              409                          +opening; OPENING; No write; state remains unchanged.

  TC-P1-037   MIGRATION_COMMIT   RETRY_SAME_KEY          migration.commit          3 retries same key + same canonical payload                     200 replay                   +opening; OPENING; One Posting_Event/movement/balance effect; replayed=true.

  TC-P1-038   MIGRATION_COMMIT   SAME_KEY_DIFF_PAYLOAD   migration.commit          Same key, different payload hash                                409                          +opening; OPENING; No second write; IDEMPOTENCY_CONFLICT.

  TC-P1-039   MIGRATION_COMMIT   CONCURRENCY             migration.commit          Two parallel requests on same stock/reversible/session scope    one 200; other 409/412/422   +opening; OPENING; No negative stock, over-post, duplicate movement or lost update.

  TC-P1-040   MIGRATION_COMMIT   ROLLBACK                migration.commit          Inject failure after document/movement/balance/subledger step   500                          +opening; OPENING; Rollback all business writes; request_id/error audit retained; retry can safely execute.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.4. Data Dictionary Governance Supplement

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **The table below supplements §7.4 for every logical field. \"NONE\" is an explicit no-default decision. Physical storage type, exact index name and DDL are approved at WWHN-31; nullable/unique/FK/privacy/retention semantics may not be weakened without Change Decision.**
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Entity.Field**                                                                               **Length/Precision**   **Nullable**   **Default**                       **Enum/Constraint**                                                                        **Unique/FK/Index**                   **Data Owner**             **Privacy**             **Retention**                                          **Sample value**
  ---------------------------------------------------------------------------------------------- ---------------------- -------------- --------------------------------- ------------------------------------------------------------------------------------------ ------------------------------------- -------------------------- ----------------------- ------------------------------------------------------ --------------------------
  Warehouse.warehouse_id                                                                         \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX; QUERY INDEX                 Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Warehouse.warehouse_code                                                                       30                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Warehouse.warehouse_name                                                                       200                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                Máy khoan mẫu

  Warehouse.status                                                                               \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                ACTIVE

  Warehouse.created_at/updated_at                                                                \-                     NO             CURRENT_TIMESTAMP as applicable   \-                                                                                         QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  User.user_id                                                                                   \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  User.username                                                                                  100                    NO             NONE                              \-                                                                                         UNIQUE INDEX                          IAM / Admin                INTERNAL                Account life + 5 years audit reference                 Máy khoan mẫu

  User.display_name                                                                              200                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    IAM / Admin                PII-RESTRICTED          Account life + 5 years audit reference                 Máy khoan mẫu

  User.email/phone                                                                               \-                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    IAM / Admin                PII-RESTRICTED          Account life + 5 years audit reference                 090\*\*\*9922

  User.status                                                                                    \-                     NO             ACTIVE                            ACTIVE/INACTIVE/LOCKED                                                                     QUERY INDEX                           IAM / Admin                INTERNAL                Account life + 5 years audit reference                 ACTIVE

  User.version                                                                                   \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    IAM / Admin                INTERNAL                Account life + 5 years audit reference                 1

  Role / Permission.role_id / permission_id                                                      \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  Role / Permission.role_code / permission_key                                                   100                    NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  Role / Permission.name                                                                         200                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    IAM / Admin                INTERNAL                Account life + 5 years audit reference                 Máy khoan mẫu

  Role / Permission.status                                                                       \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           IAM / Admin                INTERNAL                Account life + 5 years audit reference                 ACTIVE

  Role / Permission.scope_type                                                                   \-                     YES            NONE                              SYSTEM/WAREHOUSE/FUNCTION                                                                  NO DEDICATED INDEX                    IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  User_Role / Role_Permission.user_id, role_id                                                   \-                     NO             NONE                              \-                                                                                         UNIQUE INDEX; FK INDEX                IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  User_Role / Role_Permission.permission_id                                                      \-                     NO             NONE                              \-                                                                                         UNIQUE INDEX; FK INDEX                IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  User_Role / Role_Permission.scope_ref                                                          per component          YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  User_Role / Role_Permission.effective_from/to                                                  \-                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    IAM / Admin                INTERNAL                Account life + 5 years audit reference                 sample-value

  Agency.agency_id                                                                               \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Agency.agency_code                                                                             50                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Agency.agency_name                                                                             200                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                Máy khoan mẫu

  Agency.phone/address                                                                           \-                     YES            NONE                              PII/business contact                                                                       NO DEDICATED INDEX                    Master Data / QL kho       PII-RESTRICTED          Active life + 5 years reference history                090\*\*\*9922

  Agency.status                                                                                  \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                ACTIVE

  Agency.version                                                                                 \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                1

  SKU.sku_id                                                                                     \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX; QUERY INDEX                 Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.sku_code                                                                                   100                    NO             NONE                              UQ; immutable after stock                                                                  UNIQUE INDEX; QUERY INDEX             Master Data / QL kho       INTERNAL                Active life + 5 years reference history                HN-MK-001-V1

  SKU.sku_name                                                                                   255                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                Máy khoan mẫu

  SKU.sku_type                                                                                   \-                     NO             NONE                              PRODUCT/COMPONENT                                                                          NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.unit                                                                                       30                     NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.is_serial_tracked                                                                          \-                     NO             NONE                              immutable after stock                                                                      NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.brand_id/category_id/model_id                                                              \-                     YES            NONE                              \-                                                                                         FK INDEX                              Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.power_or_voltage                                                                           50                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.package_variant                                                                            50                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.version_code                                                                               30                     NO             V1                                \-                                                                                         QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.published_to_app                                                                           \-                     NO             false                             \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  SKU.status                                                                                     \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                ACTIVE

  Product_Master.master_id                                                                       \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Product_Master.master_type                                                                     \-                     NO             NONE                              BRAND/CATEGORY/MODEL/PACKAGE/POWER                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Product_Master.code                                                                            80                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Product_Master.name                                                                            200                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                Máy khoan mẫu

  Product_Master.status                                                                          \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                ACTIVE

  Defect_Catalog.defect_id                                                                       \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Warranty Owner             INTERNAL                Active life + 5 years reference history                sample-value

  Defect_Catalog.defect_code                                                                     50                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Warranty Owner             INTERNAL                Active life + 5 years reference history                sample-value

  Defect_Catalog.defect_name                                                                     200                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Warranty Owner             INTERNAL                Active life + 5 years reference history                Máy khoan mẫu

  Defect_Catalog.description                                                                     \-                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Warranty Owner             RESTRICTED              Active life + 5 years reference history                sample-value

  Defect_Catalog.status                                                                          \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           Warranty Owner             INTERNAL                Active life + 5 years reference history                ACTIVE

  Physical_Code.physical_code_id                                                                 \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX; QUERY INDEX                 Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Physical_Code.code_value                                                                       100                    NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Master Data / QL kho       INTERNAL                Active life + 5 years reference history                HN-ITEM-000001

  Physical_Code.code_type                                                                        \-                     NO             NONE                              ITEM/CARTON/COMPONENT_SERIAL/BOX/TRAY/TEMP_WARRANTY                                        QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Physical_Code.carrier_type                                                                     \-                     NO             NONE                              ITEM requires RFID/NFC chip; others flexible                                               NO DEDICATED INDEX                    Master Data / QL kho       INTERNAL                Active life + 5 years reference history                sample-value

  Physical_Code.hardware_uid                                                                     150                    YES            NONE                              \-                                                                                         UNIQUE INDEX                          Master Data / QL kho       SECRET/RESTRICTED       Active life + 5 years reference history                E2000017221101441890ABCD

  Physical_Code.status                                                                           \-                     NO             NONE                              ACTIVE/LOST/REPLACED/INACTIVE                                                              QUERY INDEX                           Master Data / QL kho       INTERNAL                Active life + 5 years reference history                ACTIVE

  Item_Instance.item_id                                                                          \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Item_Instance.sku_id                                                                           \-                     NO             NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Item_Instance.physical_code_id                                                                 \-                     NO             NONE                              \-                                                                                         UNIQUE INDEX; FK INDEX; QUERY INDEX   Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Item_Instance.serial_number                                                                    100                    YES            NONE                              \-                                                                                         UNIQUE INDEX                          Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Item_Instance.container_id                                                                     \-                     YES            NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Item_Instance.status                                                                           \-                     NO             NONE                              NEW/IN_STOCK/ISSUED/IN_WARRANTY/RETURNED_TO_CUSTOMER/LOST/ADJUSTED_OUT                     QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                NEW

  Item_Instance.item_condition                                                                   \-                     NO             NONE                              NORMAL/DEMO/DEFECTIVE/WARRANTY_RETURN/NON_SELLABLE                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Item_Instance.import_batch_id                                                                  \-                     YES            NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Item_Instance.version                                                                          \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                1

  Container.container_id                                                                         \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container.container_code                                                                       100                    NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container.container_type                                                                       \-                     NO             NONE                              CARTON/BOX/TRAY                                                                            NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container.physical_code_id                                                                     \-                     NO             NONE                              FK/UQ active mapping                                                                       UNIQUE INDEX; FK INDEX; QUERY INDEX   Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container.primary_sku_id                                                                       \-                     YES            NONE                              required for CARTON/BOX; null for mixed tray                                               FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container.parent_container_id                                                                  \-                     YES            NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container.status                                                                               \-                     NO             NONE                              type-specific state                                                                        QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                ACTIVE

  Container.version                                                                              \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                1

  Container_Item.container_item_id                                                               \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container_Item.container_id                                                                    \-                     NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container_Item.item_id                                                                         \-                     YES            NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container_Item.sku_id                                                                          \-                     YES            NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Container_Item.quantity                                                                        18,3                   YES            NONE                              \>0 for quantity-only                                                                      NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                10.000

  Container_Item.status                                                                          \-                     NO             NONE                              ACTIVE/REMOVED                                                                             QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                ACTIVE

  Container_Item.UQ rule                                                                         \-                     NO             NONE                              no duplicate active item; one SKU per carton/box                                           NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Inventory_Balance.warehouse_id                                                                 \-                     NO             NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Inventory_Balance.sku_id                                                                       \-                     NO             NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Inventory_Balance.stock_status                                                                 \-                     NO             NONE                              AVAILABLE/NON_SELLABLE/etc.                                                                QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                AVAILABLE

  Inventory_Balance.available_qty                                                                18,3                   NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                10.000

  Inventory_Balance.version                                                                      \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                1

  Inventory_Balance.updated_at                                                                   \-                     NO             CURRENT_TIMESTAMP as applicable   \-                                                                                         QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Inventory_Balance.Composite UQ                                                                 \-                     NO             NONE                              warehouse_id + sku_id + stock_status                                                       NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                Active life + 5 years reference history                sample-value

  Inventory_Movement.movement_id                                                                 \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.movement_key                                                                128                    NO             NONE                              \-                                                                                         UNIQUE INDEX                          Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.movement_type                                                               \-                     NO             NONE                              OPENING/RECEIPT_POSTED/ISSUE_POSTED/ADJUST_IN/ADJUST_OUT/RECEIPT_REVERSED/ISSUE_REVERSED   NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.warehouse_id/sku_id                                                         \-                     NO             NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.qty_delta                                                                   18,3                   NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               10.000

  Inventory_Movement.source_type/source_id/source_line_id                                        per component          NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.original_movement_id                                                        \-                     YES            NONE                              for reversal/correction                                                                    FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.correction_chain_id                                                         \-                     YES            NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.idempotency_key                                                             128                    NO             NONE                              \-                                                                                         UNIQUE INDEX                          Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.posted_at                                                                   \-                     NO             CURRENT_TIMESTAMP as applicable   \-                                                                                         QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Inventory_Movement.created_by/request_id                                                       per component          NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               req-20260723-0001

  Inbound_Document / Line.inbound_id / line_id                                                   \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Inbound_Document / Line.document_no                                                            50                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               IN-20260723-0001

  Inbound_Document / Line.status / line_status                                                   \-                     NO             NONE                              partial states                                                                             QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               ACTIVE

  Inbound_Document / Line.source_reference                                                       200                    YES            NONE                              supplier/import ref                                                                        NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Inbound_Document / Line.sku_id                                                                 \-                     NO             NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Inbound_Document / Line.expected_qty                                                           18,3                   NO             NONE                              \>=0                                                                                       NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               10.000

  Inbound_Document / Line.posted_qty                                                             18,3                   NO             0                                 \>=0                                                                                       NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               10.000

  Inbound_Document / Line.remaining_qty                                                          18,3                   NO             0                                 derived/validated                                                                          NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               10.000

  Inbound_Document / Line.cancelled_remainder_qty                                                18,3                   NO             0                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               10.000

  Inbound_Document / Line.version                                                                \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               1

  Outbound_Document / Line.outbound_id / line_id                                                 \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Outbound_Document / Line.document_no                                                           50                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               IN-20260723-0001

  Outbound_Document / Line.agency_id                                                             \-                     YES            NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Outbound_Document / Line.receiver_name                                                         200                    YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   PII-RESTRICTED          \>=5 years after closure                               Máy khoan mẫu

  Outbound_Document / Line.status / line_status                                                  \-                     NO             NONE                              partial states                                                                             QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               ACTIVE

  Outbound_Document / Line.sku_id                                                                \-                     NO             NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Outbound_Document / Line.planned_qty/issued_qty/remaining_qty                                  18,3                   NO             0                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               10.000

  Outbound_Document / Line.cancelled_remainder_qty                                               18,3                   NO             0                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               10.000

  Outbound_Document / Line.version                                                               \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               1

  Posting_Event.posting_event_id                                                                 \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Posting_Event.document_type/document_id                                                        per component          NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Posting_Event.idempotency_key                                                                  128                    NO             NONE                              \-                                                                                         UNIQUE INDEX                          Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Posting_Event.payload_hash                                                                     128                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Posting_Event.result_reference                                                                 \-                     NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Posting_Event.posted_at/posted_by/request_id                                                   per component          NO             NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               req-20260723-0001

  Stocktake_Session.session_id                                                                   \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Session.scope_type/scope_ref                                                         per component          NO             NONE                              WHOLE/SKU/GROUP                                                                            NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Session.stocktake_started_at                                                         \-                     NO             CURRENT_TIMESTAMP as applicable   \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Session.status                                                                       \-                     NO             NONE                              DRAFT/COUNTING/REVIEWING/APPLIED/CANCELLED                                                 QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               DRAFT

  Stocktake_Session.session_version                                                              \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               1

  Stocktake_Session.created_by/applied_by                                                        \-                     NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Snapshot / Count / Variance.snapshot_id/count_id/variance_id                         \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Snapshot / Count / Variance.session_id                                               \-                     NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Snapshot / Count / Variance.sku_id/item_id/container_id                              \-                     YES            NONE                              \-                                                                                         FK INDEX; QUERY INDEX                 Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Snapshot / Count / Variance.snapshot_qty/actual_qty/expected_at_count/variance_qty   18,3                   NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               10.000

  Stocktake_Snapshot / Count / Variance.count_cutoff_at                                          \-                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Stocktake_Snapshot / Count / Variance.line_status                                              \-                     NO             NONE                              PENDING/APPROVED/WAIVED/APPLIED                                                            QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               PENDING

  Stocktake_Snapshot / Count / Variance.waive_reason/acknowledged_movement_ids                   per component          YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years after closure                               sample-value

  Reversal_Document / Line.reversal_id / reversal_line_id                                        \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.reversal_type                                                         \-                     NO             NONE                              RECEIPT/ISSUE/CORRECTION                                                                   NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.original_document_id                                                  \-                     NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.original_movement_id                                                  \-                     NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.qty_to_reverse                                                        18,3                   NO             NONE                              \<= reversible_qty                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               10.000

  Reversal_Document / Line.return_condition                                                      \-                     YES            NONE                              SELLABLE/DEFECTIVE/NON_SELLABLE                                                            NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.reason_code/reason_text                                               per component          NO             NONE                              \-                                                                                         QUERY INDEX                           Inventory Owner / QL kho   RESTRICTED              \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.status                                                                \-                     NO             NONE                              DRAFT/CONFIRMED/POSTED/CANCELLED                                                           QUERY INDEX                           Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               DRAFT

  Reversal_Document / Line.correction_chain_id                                                   \-                     NO             NONE                              \-                                                                                         FK INDEX                              Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.idempotency_key/payload_hash                                          \-                     NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               sample-value

  Reversal_Document / Line.version                                                               \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Inventory Owner / QL kho   INTERNAL                \>=5 years; append-only where applicable               1

  Warranty_Case.case_id                                                                          \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   sample-value

  Warranty_Case.warranty_case_code                                                               50                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   sample-value

  Warranty_Case.item_id/item_code                                                                per component          YES            NONE                              \-                                                                                         QUERY INDEX                           Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   sample-value

  Warranty_Case.temporary_item_code                                                              100                    NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   sample-value

  Warranty_Case.identification_status                                                            \-                     NO             NONE                              IDENTIFIED/TEMP_ONLY                                                                       QUERY INDEX                           Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   IDENTIFIED

  Warranty_Case.customer_name/customer_phone                                                     \-                     NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Warranty Owner             PII-RESTRICTED          5 years after case closure, then anonymize/purge PII   090\*\*\*9922

  Warranty_Case.defect_id/reported_defect/confirmed_defect                                       per component          NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Warranty Owner             RESTRICTED              5 years after case closure, then anonymize/purge PII   sample-value

  Warranty_Case.missing_code_reason/manual_product_description                                   \-                     NO             NONE                              \-                                                                                         QUERY INDEX                           Warranty Owner             RESTRICTED              5 years after case closure, then anonymize/purge PII   sample-value

  Warranty_Case.status                                                                           \-                     NO             NONE                              warranty states                                                                            QUERY INDEX                           Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   ACTIVE

  Warranty_Case.received_date/returned_date                                                      \-                     NO             CURRENT_TIMESTAMP as applicable   \-                                                                                         NO DEDICATED INDEX                    Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   sample-value

  Warranty_Case.version                                                                          \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    Warranty Owner             INTERNAL                5 years after case closure, then anonymize/purge PII   1

  PV_Product_Profile.profile_id                                                                  \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Product_Profile.sku_id                                                                      \-                     NO             NONE                              \-                                                                                         UNIQUE INDEX; FK INDEX; QUERY INDEX   PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Product_Profile.display_name/description/specification                                      per component          NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    PV Product Owner           PII-RESTRICTED          Active life + 1 year history                           Máy khoan mẫu

  PV_Product_Profile.published                                                                   \-                     NO             false                             \-                                                                                         NO DEDICATED INDEX                    PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Product_Profile.featured/sort_order                                                         per component          NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Product_Profile.last_inventory_sync_at                                                      \-                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Product_Profile.version                                                                     \-                     NO             1                                 \-                                                                                         NO DEDICATED INDEX                    PV Product Owner           INTERNAL                Active life + 1 year history                           1

  PV_Industry / Tag / Mapping.industry_id/tag_id                                                 \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Industry / Tag / Mapping.code                                                               80                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             PV Product Owner           PUBLIC WHEN PUBLISHED   Active life + 1 year history                           sample-value

  PV_Industry / Tag / Mapping.name                                                               200                    NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    PV Product Owner           PUBLIC WHEN PUBLISHED   Active life + 1 year history                           Máy khoan mẫu

  PV_Industry / Tag / Mapping.status                                                             \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           PV Product Owner           INTERNAL                Active life + 1 year history                           ACTIVE

  PV_Industry / Tag / Mapping.profile_id + industry_id/tag_id                                    \-                     NO             NONE                              \-                                                                                         UNIQUE INDEX; FK INDEX                PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Industry / Tag / Mapping.priority                                                           \-                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    PV Product Owner           INTERNAL                Active life + 1 year history                           1

  PV_Recommendation_Rule.rule_id                                                                 \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Recommendation_Rule.industry_id                                                             \-                     NO             NONE                              \-                                                                                         FK INDEX                              PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Recommendation_Rule.category_id/tag_id/sku_id                                               \-                     YES            NONE                              selector/priority                                                                          FK INDEX; QUERY INDEX                 PV Product Owner           INTERNAL                Active life + 1 year history                           sample-value

  PV_Recommendation_Rule.priority                                                                \-                     NO             NONE                              \-                                                                                         UNIQUE INDEX                          PV Product Owner           INTERNAL                Active life + 1 year history                           1

  PV_Recommendation_Rule.status                                                                  \-                     NO             ACTIVE                            ACTIVE/INACTIVE                                                                            QUERY INDEX                           PV Product Owner           INTERNAL                Active life + 1 year history                           ACTIVE

  Import_Batch.import_batch_id                                                                   \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Data Migration Owner       INTERNAL                \>=5 years after closure                               sample-value

  Import_Batch.import_batch_code                                                                 80                     NO             NONE                              \-                                                                                         UNIQUE INDEX; QUERY INDEX             Data Migration Owner       INTERNAL                \>=5 years after closure                               sample-value

  Import_Batch.source_file/checksum                                                              \-                     NO             NONE                              \-                                                                                         NO DEDICATED INDEX                    Data Migration Owner       RESTRICTED              \>=5 years after closure                               sha256:abc123\...

  Import_Batch.status                                                                            \-                     NO             NONE                              DRAFT/DRY_RUN_VALIDATED/COMMITTED/FAILED/ROLLED_BACK                                       QUERY INDEX                           Data Migration Owner       INTERNAL                \>=5 years after closure                               DRAFT

  Import_Batch.valid/invalid/duplicate_count                                                     \-                     NO             0                                 \-                                                                                         NO DEDICATED INDEX                    Data Migration Owner       INTERNAL                \>=5 years after closure                               1

  Import_Batch.reconciliation_status                                                             \-                     NO             NONE                              PENDING/PASS/FAIL                                                                          QUERY INDEX                           Data Migration Owner       INTERNAL                \>=5 years after closure                               PENDING

  Import_Batch.committed_at/rollback_reference                                                   per component          YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Data Migration Owner       INTERNAL                \>=5 years after closure                               sample-value

  Audit_Log / Reconciliation_Incident.audit_id/incident_id                                       \-                     NO             GENERATED UUID                    \-                                                                                         PK/INDEX                              Tech Lead / Security       INTERNAL                \>=5 years; append-only where applicable               sample-value

  Audit_Log / Reconciliation_Incident.actor_id/action/object_type/object_id                      per component          NO             NONE                              \-                                                                                         FK INDEX                              Tech Lead / Security       INTERNAL                \>=5 years; append-only where applicable               sample-value

  Audit_Log / Reconciliation_Incident.reason/request_id                                          per component          CONDITIONAL    NONE                              \-                                                                                         FK INDEX                              Tech Lead / Security       INTERNAL                \>=5 years; append-only where applicable               req-20260723-0001

  Audit_Log / Reconciliation_Incident.before_data/after_data                                     \-                     YES            NONE                              \-                                                                                         NO DEDICATED INDEX                    Tech Lead / Security       RESTRICTED              \>=5 years; append-only where applicable               sample-value

  Audit_Log / Reconciliation_Incident.divergence_type/status/resolution_ref                      per component          YES            NONE                              \-                                                                                         QUERY INDEX                           Tech Lead / Security       INTERNAL                \>=5 years; append-only where applicable               ACTIVE

  Audit_Log / Reconciliation_Incident.created_at/resolved_at                                     \-                     NO             CURRENT_TIMESTAMP as applicable   \-                                                                                         QUERY INDEX                           Tech Lead / Security       INTERNAL                \>=5 years; append-only where applicable               sample-value
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.5. Machine-readable OpenAPI Release Contract

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Control**               **Status/Reference**   **Contract**
  ------------------------- ---------------------- ------------------------------------------------------------------------------------------------------------------------------------------------
  Artifact                  HN_OpenAPI_v1_0.yaml   OpenAPI 3.1.0 BA machine-readable baseline; accompanies this DOCX.

  Request/response schema   Included               40 operations/31 paths with operationId, request/response schemas, required/max/enum and resource examples.

  Error body                Included               ErrorEnvelope: code, message, request_id, timestamp, field_errors and details; 400/401/403/404/409/412/422/428/500.

  Headers                   Included               Authorization, X-Request-Id, Idempotency-Key, If-Match, ETag and Idempotency-Replayed.

  Pagination                Included               page, page_size default 50/max 200, total_items and total_pages.

  Security                  Included               bearerAuth + x-permission by operation; 403/404 data-scope convention.

  Examples                  Included               Schema/error/resource examples and stock/scan request examples.

  Contract tests            Designed               x-contract-tests IDs for positive, negative, permission, state, retry, conflict, concurrency and rollback; execution at WWHN-33 after BA Done.

  Approval                  DOWNSTREAM             Tech approval at WWHN-31 and detailed QA Test Master at WWHN-33 after BA Done; neither is a prerequisite for SRS Done.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.6. Screen Map and Approved Field Specification Candidate

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Screen**      **Purpose**                                       **Loading**                                                        **Empty**                                                    **Error/Retry**                                                    **Success**                                                  **Confirm**                                                                                                                   **Responsive**                                                                               **Scan-focus**
  --------------- -------------------- ---------------------------- -------------------------------------------- --------------------- ------------------------------------- ---------------------- ------------------------------------------------------------------ ------------------------------------------------------------ --------------------------------------------------------------------------------------- ------------------------------------- ------------------------------------------------------ ------------------------------------- -------------------------------------------------------------------------------------
  **Screen**                           **Field/Control**                                                         **UI type**                                                 **Required**                                                                              **Validation**                                                                                                                                       **Permission/Editability**                                                                   **API/Data mapping**                  

  SCR-IAM-01      User/Role                                         Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Required for irreversible/post/close/publish/deactivate; show stock effect and reason                                         360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-MST-01      SKU/Product Master                                Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-AGY-01      Agency                                            Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-DEF-01      Defect                                            Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-IN-01       Inbound                                           Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Required for irreversible/post/close/publish/deactivate; show stock effect and reason                                         360/768/1280+, no horizontal loss of critical action                                         Auto-focus scan input; Enter/reader event submits; retain focus after success/error

  SCR-OUT-01      Outbound                                          Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Required for irreversible/post/close/publish/deactivate; show stock effect and reason                                         360/768/1280+, no horizontal loss of critical action                                         Auto-focus scan input; Enter/reader event submits; retain focus after success/error

  SCR-REV-01      Reversal                                          Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Required for irreversible/post/close/publish/deactivate; show stock effect and reason                                         360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-INV-01      Inventory                                         Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-TRACE-01    Trace                                             Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         Auto-focus scan input; Enter/reader event submits; retain focus after success/error

  SCR-STK-01      Stocktake                                         Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Required for irreversible/post/close/publish/deactivate; show stock effect and reason                                         360/768/1280+, no horizontal loss of critical action                                         Auto-focus scan input; Enter/reader event submits; retain focus after success/error

  SCR-WAR-01      Warranty                                          Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         Auto-focus scan input; Enter/reader event submits; retain focus after success/error

  SCR-RPT-01      Reports                                           Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-PV-01       PV List                                           Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-PV-02       PV Detail                                         Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-PV-ADM-01   PV Admin                                          Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Required for irreversible/post/close/publish/deactivate; show stock effect and reason                                         360/768/1280+, no horizontal loss of critical action                                         N/A

  SCR-DEMO-01     Demo Scanner                                      Skeleton/spinner; disable duplicate action                         Explain no data + clear next action                          Inline + request_id; retry same idempotency key where applicable   Toast/summary + updated state/version                        Only destructive actions                                                                                                      360/768/1280+, no horizontal loss of critical action                                         Auto-focus scan input; Enter/reader event submits; retain focus after success/error

  SCR-IN-01                            document_no                                                               Text/read-only                                              Y after create                                                                            Generated unique                                                                                                                                     All actors view                                                                              Inbound.document_no                   

  SCR-IN-01                            source_reference                                                          Text                                                        N                                                                                         max 200                                                                                                                                              Edit DRAFT/SCANNING                                                                          Inbound.source_reference              

  SCR-IN-01                            scan_input                                                                Scanner/Text                                                Y per scan                                                                                1..150 chars; trim; no auto stock effect                                                                                                             inbound.create users                                                                         /scan-batches/classify.codes\[\]      

  SCR-IN-01                            post_subset                                                               Line selector + qty                                         Y for post                                                                                \>0 and \<=remaining; ITEM requires eligible chip/fallback                                                                                           inbound.post only                                                                            PostLinesRequest.lines                

  SCR-IN-01                            close_reason                                                              Code + textarea                                             Y when close                                                                              reason text 5..500                                                                                                                                   inbound.close_remainder                                                                      CloseRemainderRequest                 

  SCR-OUT-01                           agency_id/receiver_name                                                   Select/Text                                                 Conditional                                                                               Active agency or receiver required                                                                                                                   outbound.create                                                                              OutboundCreateRequest                 

  SCR-OUT-01                           available_qty                                                             Number/read-only                                            Y                                                                                         Refresh at commit; stale warning                                                                                                                     Authorized view                                                                              Inventory_Balance.available_qty       

  SCR-OUT-01                           issue_subset                                                              Scan/qty                                                    Y for post                                                                                \<=remaining and \<=available                                                                                                                        outbound.post                                                                                PostLinesRequest                      

  SCR-STK-01                           scope_type/scope_ref                                                      Select                                                      Y/Conditional                                                                             WHOLE/SKU/GROUP                                                                                                                                      stocktake.count                                                                              StocktakeCreateRequest                

  SCR-STK-01                           actual_qty                                                                Decimal/scan count                                          Y at confirm                                                                              \>=0; duplicate serial ignored                                                                                                                       Counter                                                                                      Stocktake_Count.actual_qty            

  SCR-STK-01                           movement_warning_ack                                                      Checkbox/list                                               Y when warning                                                                            All movement IDs reviewed                                                                                                                            QL kho                                                                                       acknowledged_movement_ids             

  SCR-STK-01                           approve/waive                                                             Action + reason                                             Y per variance                                                                            Waive reason required                                                                                                                                QL kho                                                                                       Variance.line_status                  

  SCR-REV-01                           original_movement                                                         Search/read-only                                            Y                                                                                         POSTED and reversible                                                                                                                                inventory.reversal.post                                                                      original_movement_id                  

  SCR-REV-01                           qty_to_reverse                                                            Decimal                                                     Y                                                                                         \>0 \<= reversible_qty                                                                                                                               inventory.reversal.post                                                                      qty_to_reverse                        

  SCR-REV-01                           return_condition                                                          Select                                                      Conditional                                                                               Required for Reverse Issue physical return                                                                                                           inventory.reversal.post                                                                      SELLABLE/DEFECTIVE/NON_SELLABLE       

  SCR-WAR-01                           identification_status                                                     Radio                                                       Y                                                                                         IDENTIFIED/TEMP_ONLY                                                                                                                                 warranty.manage                                                                              Warranty.identification_status        

  SCR-WAR-01                           customer_name                                                             Text                                                        Y                                                                                         max 200; mask outside PII scope                                                                                                                      warranty.pii.view for full                                                                   Warranty.customer_name                

  SCR-WAR-01                           customer_phone                                                            Tel                                                         Y                                                                                         normalized; mask default                                                                                                                             warranty.pii.view for full                                                                   Warranty.customer_phone               

  SCR-WAR-01                           images                                                                    Upload                                                      N                                                                                         jpg/png/webp; \<=10 files; \<=10MB/file; malware scan                                                                                                warranty.manage                                                                              attachment IDs only                   

  SCR-WAR-01                           manual_product_description                                                Textarea                                                    Y if TEMP_ONLY                                                                            max 2000; no raw PII in logs                                                                                                                         warranty.manage                                                                              Warranty.manual_product_description   

  SCR-RPT-01                           date_from/date_to                                                         Date                                                        Y for period reports                                                                      from\<=to; timezone Asia/Ho_Chi_Minh                                                                                                                 report.view                                                                                  query filters                         

  SCR-RPT-01                           export                                                                    Action                                                      N                                                                                         same filters/scope; PII default excluded                                                                                                             report.export; PII extra permission                                                          /reports/export                       

  SCR-PV-ADM-01                        published                                                                 Toggle                                                      Y                                                                                         Only active SKU/profile complete                                                                                                                     pv.publish                                                                                   PV_Profile.published                  

  SCR-PV-01                            available_qty/data_as_of                                                  Read-only                                                   Y                                                                                         cache staleness \<=60s                                                                                                                               public/read-only                                                                             PV read model                         
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.7. Quantified NFR Baseline

  ----------------------------------------------------------------------------------------------------------------------------------
  **NFR dimension**      **Scope**                           **Measured target**
  ---------------------- ----------------------------------- -----------------------------------------------------------------------
  Scan batch             1..500 codes/request                P95 \<=5s; duplicate/unknown classified; no stock effect

  Single scan feedback   One scan event                      UI feedback P95 \<=500ms; API classify P95 \<=1.5s

  Read/list API          page_size\<=50                      P95 \<=2s; P99 \<=4s

  Stock action API       Post/Apply/Reversal                 P95 \<=3s excluding hardware read time

  Concurrency            20 stock-changing + 50 read users   No negative stock, duplicate movement, lost update

  Availability           Monthly                             \>=99.5%, excluding announced planned maintenance

  Backup/RPO/RTO         Core data/service                   Daily backup; RPO\<=24h; RTO\<=8h; restore test quarterly/pre-go-live

  Import                 10,000 rows/file minimum            Dry-run result/error file; critical errors=0 before commit

  Retention              Ledger/audit/transaction            \>=5 years; no hard-delete authoritative ledger

  Privacy retention      Warranty PII                        5 years after case closure then anonymize/purge unless legal hold

  Device/browser         360/768/1280+                       Chrome/Edge/Chrome Android/Safari iOS latest 2 versions

  PV cache               Inventory read model                max staleness \<=60s; expose data_as_of/last_inventory_sync_at
  ----------------------------------------------------------------------------------------------------------------------------------

## 13.8. Privacy Contract - Warranty Name, Phone, Image and Description

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Data**                           **Masking/access scope**                                               **UI/API scope**                                              **Export**                                           **Logging**                                          **Retention/purge**
  ---------------------------------- ---------------------------------------------------------------------- ------------------------------------------------------------- ---------------------------------------------------- ---------------------------------------------------- -------------------------------------------------------------
  Customer name                      Full: warranty.manage + warranty.pii.view; otherwise N\*\*\* H\*\*\*   Not in PV; report masked by default                           PII export requires warranty.pii.export + reason     Do not write full value to application/access logs   5 years after case close; anonymize/purge unless legal hold

  Customer phone                     Full only PII permission; otherwise \*\*\*\*\*\*9922                   Search may use normalized exact match for authorized staff    PII export separate permission; audit every export   Never log raw phone; use case_id/request_id          Same as customer name

  Warranty images                    Authorized warranty staff/QL/Admin only; signed/private URL            No public bucket; malware/content-type check                  Export/download audited; no bulk export by default   Log attachment_id only, not binary/URL token         Purge with case PII unless legal hold

  Machine description/defect notes   Warranty actors; reports aggregate unless detail permission            Free text may contain incidental PII; show warning/minimize   Detailed export restricted                           Sanitize; log ID/change metadata, not full text      5 years after closure; anonymize personal content
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

-   Purge job phải idempotent, có dry-run/report, retry, legal-hold exclusion và audit số record anonymized/purged; không xóa Inventory_Movement hoặc business evidence cần giữ.

-   API 404 được phép dùng để mask resource ngoài data scope; 403 dùng cho action đã nhận diện nhưng thiếu permission.

## 13.9. Physical Code / Chip Lifecycle

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **State**         **Action**            **Rule**                                                                             **Operational effect**
  ----------------- --------------------- ------------------------------------------------------------------------------------ --------------------------------------------------------------------------------
  UNASSIGNED        Generate/Import       Code/UID đã validate nhưng chưa gắn target                                           Không dùng post tồn

  ACTIVE            Assign                Một active code/UID map đúng một Item/Container; ITEM target carrier chip            Được scan theo permission/state

  DAMAGED           Mark damaged          Không đọc tin cậy; giữ lịch sử mapping                                               Normal post bị chặn; có controlled fallback

  LOST              Mark lost             Không còn vật lý; actor/reason/time bắt buộc                                         Code cũ không được tái gán

  REPLACED          Replace               Code mới ACTIVE; code cũ REPLACED; replacement_of link                               Mọi trace hiển thị chuỗi cũ→mới

  INACTIVE          Deactivate            Không dùng transaction mới; history retained                                         Không hard-delete

  FALLBACK_ACTIVE   Manual/QR exception   Tạm thời tối đa 24h, permission physical_code.fallback, reason + approver + expiry   Cho phép nghiệp vụ được duyệt; bắt buộc thay chip trước lần outbound tiếp theo
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

-   Assign: code_value và hardware_uid unique khi populated; target không được có active mapping khác.

-   Replace: tạo mapping mới và audit; không sửa code/UID cũ thành giá trị mới; report/trace giữ replacement chain.

-   Duplicate hardware UID: trả 409 DUPLICATE_HARDWARE_UID, hiển thị target hiện tại theo scope; không tự merge.

-   Fallback manual/QR là exception có thời hạn, không thay quyết định ITEM carrier chip; UI hiển thị cảnh báo và danh sách cần remediate.

-   Warranty TEMP_ONLY vẫn dùng temporary_item_code riêng, không được xem là chip replacement hoặc tự link Item_Instance.

## 13.10. Report Contract

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Report**                     **Columns**                                                                                                                              **Filters**                            **Timezone/period**                                                       **Formula/partial handling**                                                                           **Export**                                             **Reconciliation**
  ------------------------------ ---------------------------------------------------------------------------------------------------------------------------------------- -------------------------------------- ------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------ ------------------------------------------------------ -----------------------------------------------------------------
  RPT-INV-01 Current Inventory   warehouse, sku_code/name, category, stock_status, available_qty, serial_qty, box_qty, location_hint, updated_at, reconciliation_status   SKU/category/status; as_of             Asia/Ho_Chi_Minh; as_of inclusive                                         Current Balance; location_hint non-authoritative                                                       XLSX/PDF same scope; no PII                            Ledger=Balance=subledger; FAIL warning/block sign-off

  RPT-XNT-01 XNT                 sku, opening_qty, receipt_qty, issue_qty, adjust_in/out, reversal_in/out, closing_qty, partial_remaining                                 from/to, SKU/category, movement type   posted_at converted to Asia/Ho_Chi_Minh; \[from 00:00,to 23:59:59.999\]   closing=opening+receipt-issue+adjust_in-adjust_out+reversal_net; only POSTED qty; remaining separate   XLSX/PDF; filter/timezone in header                    Closing must match Balance at period end

  RPT-MOV-01 Movement History    movement_id/key/type, posted_at, sku, qty_delta, source, original_movement, correction_chain, actor, request_id                          date, SKU, source, type, actor         posted_at authoritative                                                   Show gross and net; append-only; partial posts are separate events                                     XLSX; PDF summary optional                             movement_key unique; chain net equals balance effect

  RPT-STK-01 Stocktake           session, snapshot, cutoff, expected, actual, variance, status, warning/ack, adjustment movement, owner                                   session/date/SKU/status                snapshot/cutoff in Asia/Ho_Chi_Minh                                       expected=snapshot+net movement to cutoff; only APPROVED applied; WAIVED reason                         XLSX/PDF; evidence links                               Applied lines reconcile to adjustment and final Balance

  RPT-WAR-01 Warranty Defect     case code, SKU/model or UNKNOWN, defect, status, received/returned, turnaround; customer masked by default                               date, model, defect, status            event timestamps Asia/Ho_Chi_Minh                                         TEMP_ONLY counted separately; no inventory effect                                                      PII excluded unless extra permission; export audited   Case/event counts match source; no inference link for TEMP_ONLY

  RPT-IO-01 Inbound/Outbound     document, line, source/recipient, planned/expected, posted/issued, remaining, cancelled remainder, status, posting events                date, SKU, status, agency recipient    posting date by posted_at; document date shown separately                 Only posted quantities affect XNT; partial quantities shown explicitly                                 XLSX/PDF same filters                                  Sum posting events = posted/issued qty; no agency stock
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.11. location_hint / Zone Decision

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **DECISION DR-LOC-001: Exact zone/rack/bin hierarchy is OUT OF MVP. MVP supports only Tray mapping and optional location_hint as relative, non-authoritative information. It does not create an inventory bucket, does not participate in available_qty, and may be null until physical survey.**
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Field/capability**   **Baseline**                  **Usage**                                                       **Constraint**
  ---------------------- ----------------------------- --------------------------------------------------------------- -----------------------------------------------------------------------------
  location_hint          VARCHAR(200), nullable        Examples: \"Cửa nhập - khu chờ\", \"Khay T-01\"                 Inventory/trace/report display only; not used to post/reconcile stock

  tray_id / tray code    Existing Container relation   Scan locator for Box/Item mapping                               Putaway changes mapping only; no Inventory_Movement

  zone/rack/bin master   OUT OF MVP                    No hierarchy, capacity, occupancy or optimization requirement   Any future addition requires Change Decision/CR and migration impact review
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.12. Migration Template, Sample Data, Error File and Dry-run/Reconciliation Criteria

-   Template evidence đã được đính kèm tại WWHN-333 comment 12634: https://tan0110.atlassian.net/browse/WWHN-333?focusedCommentId=12634

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Sheet**               **Required columns**                                                                                                                                                                        **Sample row**
  ----------------------- ---------------------------------------------------------------------------------------------- -------------------------------------------------------------------------------------------- ---------------------------------------------------------------------------
  **Error-file column**                                                                                                  **Meaning**                                                                                  

  SKU                     sku_code, sku_name, sku_type, unit, is_serial_tracked, brand/category/model, version, status                                                                                                HN-MK-001-V1 \| Máy khoan mẫu \| PRODUCT \| PCS \| TRUE \| \...

  PHYSICAL_CODE           code_value, code_type, carrier_type, hardware_uid, target_legacy_key, status                                                                                                                HN-ITEM-000001 \| ITEM \| RFID \| E200\... \| LEG-001 \| ACTIVE

  ITEM                    legacy_item_key, sku_code, serial_number, code_value, condition, import_batch                                                                                                               LEG-001 \| HN-MK-001-V1 \| SN0001 \| HN-ITEM-000001 \| NORMAL \| BATCH-01

  CONTAINER               container_code, type, carrier, physical_code, primary_sku, parent_tray, status                                                                                                              CTN-001 \| CARTON \| QR \| HN-CTN-001 \| HN-MK-001-V1 \| \| IN_STOCK

  OPENING_BALANCE         warehouse_code, sku_code, stock_status, quantity, source, owner_confirmation                                                                                                                HN-WH-01 \| HN-MK-001-V1 \| AVAILABLE \| 100 \| CUTOVER_COUNT \| QL_KHO

  AGENCY                  agency_code, agency_name, phone, address, status                                                                                                                                            AG-001 \| Đại lý mẫu \| 090\*\*\*9922 \| Hà Nội \| ACTIVE

  source_file                                                                                                            Original file name/checksum                                                                  

  sheet                                                                                                                  Logical dataset                                                                              

  row_no                                                                                                                 1-based source row                                                                           

  field                                                                                                                  Field causing error                                                                          

  error_code                                                                                                             DUPLICATE_CODE / UNKNOWN_SKU / INVALID_ENUM / REQUIRED / RECON_MISMATCH / CHECKSUM_CHANGED   

  message                                                                                                                Human-readable Vietnamese message                                                            

  raw_value                                                                                                              Masked if PII                                                                                

  severity                                                                                                               CRITICAL / ERROR / WARNING                                                                   

  suggested_action                                                                                                       Fix, map, confirm waiver or exclude                                                          
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

-   Dry-run PASS: checksum/version recorded; critical_error=0; duplicate active item/code/hardware_uid=0; unknown required FK=0; required/enum/type errors=0; valid+invalid+duplicate = input row count.

-   Reconciliation PASS: 100% SKU quantity match between approved opening source and ledger/balance; serial-tracked quantity equals eligible unique Item count; container mapping creates no extra stock; QL kho signs result.

-   Commit is blocked on FAIL. File changed after dry-run must receive a new checksum and rerun. Rollback test must prove no partial master/opening/movement remains.

## 13.13. Definition of Done - SRS Task vs Release Execution

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Artifact/Ticket**             **Done criteria**                                                                                                                                                                                                                                                         **Explicitly separated execution evidence**
  ------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------
  SRS/FRD task WWHN-334           Attachment v1.4 current; 0 TBD in core logic; REQ/BR/AC GWT; BA test-design definitions; entity/constraint/enum; stock/state effect; HN_OpenAPI_v1_0.yaml; Screen/Field Specification; traceability/source/version control; PM/PO baseline approval by Jira transition.   Physical Tech approval, detailed Figma, detailed Test Master, actual test/UAT/migration/cutover/production proof are NOT required in this task.

  Tech baseline WWHN-31/WWHN-40   Physical ERD/DD/index/DDL; Tech-approved OpenAPI; permission middleware mapping; contract-test environment.                                                                                                                                                               Runs after BA Done; blocks Ready for Dev/API integration, not SRS Done.

  QA design/execution WWHN-33     QA Lead derives detailed scenarios, data, steps, expected results and executes/mappings from stable SRS baseline.                                                                                                                                                         Starts after BA Done; blocks Ready for QA/Beta as applicable, not SRS Done.

  QA/Beta execution ticket        Run approved tests; actual result, evidence, defect IDs, rerun and residual-risk waiver.                                                                                                                                                                                  Blocks Ready for Beta/Release.

  UAT ticket                      Business scenarios, users/data/environment, actual result, defects, business sign-off/waiver.                                                                                                                                                                             Blocks Go/No-Go.

  Migration/Cutover ticket        Template/data frozen; dry-run/reconciliation/rollback rehearsal; cutover log; opening balance sign-off.                                                                                                                                                                   Blocks production cutover.

  Detailed UI/UX/Figma ticket     Create user flow, layout, components, responsive prototype/design system and FE handoff from SRS Screen/Field Specification.                                                                                                                                              Starts after BA Done; blocks FE detailed implementation, not SRS Done.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 13.14. P1 Waiver Minimum Content

  -------------------------------------------------------------------------------------------------------------------------
  **Waiver field**        **Required content**
  ----------------------- -------------------------------------------------------------------------------------------------
  Waiver ID/date/expiry   Unique Jira comment or decision; expiry no later than Beta gate

  Scope                   Exact P1 item/artifact/test excluded; no blanket waiver

  Reason                  Why unavailable and why risk is acceptable temporarily

  Risk/impact             DEV/FE/QA/Beta impact and data/stock/privacy exposure

  Compensating control    Manual review, limited pilot, feature flag, read-only, reduced scope, additional reconciliation

  Owner/due date          Named owner and closure date

  Approver                PM/PO; Tech/QA/Security co-approval where relevant

  Reopen condition        Condition that invalidates waiver or blocks Beta/Go-live
  -------------------------------------------------------------------------------------------------------------------------

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **P1 FINAL CONCLUSION: v1.4 closes the specification-level P1 gaps and is eligible for formal approval. SRS Done is conditional only on PM/PO approval of the current v1.4 baseline at WWHN-334. Physical Tech baseline, detailed UI/UX/Figma, WWHN-33 Test Master/execution, UAT and migration/cutover remain separate downstream gates for Ready for Dev/FE/QA/Beta/Go-live.**
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
