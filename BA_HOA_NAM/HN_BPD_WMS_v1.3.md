**BPD**

**TÀI LIỆU QUY TRÌNH NGHIỆP VỤ WMS**

**Hệ thống Quản lý Kho & Web App Xem Sản phẩm**

**Hoa Nam Tools**

  -------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Giá trị**
  ----------------- -------------------------------------------------------------------------------------------------------
  Document ID       HN-BPD-WMS-001

  Version           1.3

  Ngày cập nhật     24/07/2026

  Tác giả/Owner     Business Analyst – Nguyễn Đình Hùng

  Trạng thái        FINAL APPROVAL CANDIDATE / BASELINE EFFECTIVE ON WWHN-335 DONE AFTER OR CONCURRENT WITH WWHN-333 DONE
  -------------------------------------------------------------------------------------------------------------------------

+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| KẾT LUẬN PHÁT HÀNH v1.3                                                                                                                                                                                                                                                                                                                                                                                               |
|                                                                                                                                                                                                                                                                                                                                                                                                                       |
| • P0 content đã được đóng ở cấp tài liệu: cơ chế approval/effective date, Source Registry/Contract Coverage, AS-IS discovery evidence giới hạn, một Accountable duy nhất, decision dependency, staged traceability và reversal/correction guard.                                                                                                                                                                      |
|                                                                                                                                                                                                                                                                                                                                                                                                                       |
| • Khảo sát trực tiếp tại kho ngày 30/06/2026 đã được tổng hợp trong “Tóm tắt yêu cầu đối tác.docx”; WWHN-335 comment 12646 là evidence xác nhận mức discovery này đủ cho BPD và không yêu cầu bộ ảnh/layout/time study/mẫu phiếu AS-IS riêng.                                                                                                                                                                         |
|                                                                                                                                                                                                                                                                                                                                                                                                                       |
| • BPD v1.3 trở thành APPROVED/BASELINE vào ngày WWHN-335 được chuyển DONE, với điều kiện WWHN-333 đã DONE hoặc được PM/PO chuyển DONE đồng thời. WWHN-335 transition history và attachment v1.3 là formal approval evidence.                                                                                                                                                                                          |
|                                                                                                                                                                                                                                                                                                                                                                                                                       |
| • File Excel thật, checksum, dry-run và migration reconciliation được waiver sang [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69). [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646) là evidence PM/PO xác nhận waiver: không chặn BPD Done nhưng vẫn chặn Migration Commit/Beta/Go-live; BPD Done không đồng nghĩa migration ready. |
|                                                                                                                                                                                                                                                                                                                                                                                                                       |
| • Ready for Dev/QA/Beta tổng thể vẫn phụ thuộc BE API/ERD/Data Dictionary tại [[WWHN-31]{.underline}](https://tan0110.atlassian.net/browse/WWHN-31), permission tại [[WWHN-40]{.underline}](https://tan0110.atlassian.net/browse/WWHN-40), TestCase Master + Test Data tại [[WWHN-33]{.underline}](https://tan0110.atlassian.net/browse/WWHN-33) và FE Screen/Wireframe/Figma hiện PLANNED / JIRA NOT CREATED.        |
+=======================================================================================================================================================================================================================================================================================================================================================================================================================+
+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

# 0. DOCUMENT CONTROL

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Trường**         **Giá trị**
  ------------------ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Document ID        HN-BPD-WMS-001

  Version            1.3

  Title              Business Process Document – Quy trình nghiệp vụ WMS Hoa Nam

  Author/Owner       Business Analyst – Nguyễn Đình Hùng

  Updated date       24/07/2026

  Current status     FINAL APPROVAL CANDIDATE / PROCESS BASELINE EFFECTIVE ON WWHN-335 DONE AFTER OR CONCURRENT WITH WWHN-333 DONE

  Source documents   \[DOC\]\[BA\]\[BRD\] WMS v3.11; \[DOC\]\[BA\]\[SRS-FRD\] v1.4 ([[WWHN-334 comment 12637]{.underline}](https://tan0110.atlassian.net/browse/WWHN-334?focusedCommentId=12637)); Tóm tắt yêu cầu đối tác; Hợp đồng 07072026/HOANAM-A4I; WWHN-333 comments 12634/12635; [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646); [[WWHN-69 migration execution]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69).

  Document purpose   Mô tả AS-IS ở mức discovery đã được xác nhận và TO-BE chi tiết; cung cấp process/business baseline. BPD Done tách khỏi migration execution và các API/data/UX/test gate downstream.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.1. Approval matrix

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Vai trò**                 **Người**                          **Phạm vi xác nhận**                                                             **Trạng thái**                                                    **Evidence cần có**
  --------------------------- ---------------------------------- -------------------------------------------------------------------------------- ----------------------------------------------------------------- ------------------------------------------------------------------
  BA Owner                    Nguyễn Đình Hùng                   Nội dung quy trình, traceability, P0/P1 closure                                  COMPLETED / READY FOR PM APPROVAL                                 BPD v1.3

  PM/PO                       Nguyễn Quang Đức                   Scope, priority, process baseline, waiver và task Done                           APPROVAL BY WWHN-335 DONE                                         Transition history + attachment v1.3; effective date = ngày DONE

  Đại diện xác nhận phạm vi   Vũ Tuấn Cương                      Phạm vi kinh doanh tổng quát và quyết định/waiver theo project approval list     SCOPE EVIDENCE AVAILABLE / PROCESS BASELINE BY WWHN-335 DONE      Hợp đồng + WWHN-335

  Process/Data Owner          Chị Phương – Quản lý kho Hoa Nam   Accountable duy nhất; AS-IS discovery, vận hành kho, dữ liệu và reconciliation   CONFIRMED FOR BPD BASELINE                                        Khảo sát 30/06/2026; WWHN-335 comment 12646

  Tech Lead                   Nguyễn Quang Đức                   Tính khả thi transaction/idempotency/data authority; technical handoff           DECISIONS EFFECTIVE ON WWHN-333 DONE; TECH ARTIFACTS DOWNSTREAM   WWHN-333 comment 12635 + transition; WWHN-31

  QA Lead                     Đặng Thị Soi                       Testability và staged test coverage; execution downstream                        PROCESS REVIEW BY WWHN-335 DONE / TEST DESIGN DOWNSTREAM          WWHN-33; waiver/approval recorded on Jira
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.2. Readiness assessment

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Checkpoint**                                          **Kết luận**                       **Giải thích**
  ------------------------------------------------------- ---------------------------------- ------------------------------------------------------------------------------------------------------------
  Lập BPD TO-BE                                           YES                                Actor, scope, state, rule, BPMN, stock effect, exception, control và E2E đã có.

  Mô tả AS-IS discovery                                   YES – LIMITED DISCOVERY EVIDENCE   Khảo sát trực tiếp tại kho ngày 30/06/2026; kết quả tổng hợp tại “Tóm tắt yêu cầu đối tác.docx”.

  Chi tiết vật lý/ảnh/layout/time study/mẫu AS-IS riêng   NOT REQUIRED FOR BPD               Dự án nhỏ; PM/PO và Process Owner xác nhận mức evidence giới hạn đủ đóng P0-03 tại WWHN-335 comment 12646.

  Đính kèm Jira để final review                           YES                                BPD v1.3 là attachment hiện hành tại WWHN-335; v1.0/v1.1/v1.2 được đánh dấu SUPERSEDED.

  Approved/Baseline / Jira Done                           CONDITIONAL ON TRANSITION          Baseline có hiệu lực khi WWHN-335 DONE, sau hoặc đồng thời với WWHN-333 DONE.

  P1 process/business readiness                           YES – BPD GATE                     P1-01..09, 11..12 đóng; P1-10 waiver sang WWHN-69 và chỉ chặn migration/Beta/Go-live.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.3. Open External Closure Register

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **ID**        **Điểm cần đóng**                          **Owner**                     **Hiện trạng**                           **Evidence/Điều kiện đóng**                                                                                                                                                                                                                                                                                                                                  **Blocks**
  ------------- ------------------------------------------ ----------------------------- ---------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ -------------------------------------
  BPD-EVD-001   AS-IS discovery và handoff vật lý          Chị Phương + BA               CLOSED WITH LIMITED DISCOVERY EVIDENCE   Khảo sát 30/06/2026; Trần Tùng Lâm, Nguyễn Đình Hùng và Chị Phương; [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646). Không yêu cầu package ảnh/layout/time study/form riêng.                                                                                                                    Không

  BPD-EVD-002   Process Owner, executor và backup          Chị Phương + PM/PO            CLOSED                                   Chị Phương là Accountable duy nhất; executor theo role/permission; Backup NOT DESIGNATED và phải được Hoa Nam ủy quyền khi cần.                                                                                                                                                                                                                              Không

  BPD-EVD-003   Formal approval/effective date             PM/PO                         PENDING FORMAL TRANSITION                [[WWHN-335 DONE]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335) là approval event; effective date là ngày transition. [[WWHN-333]{.underline}](https://tan0110.atlassian.net/browse/WWHN-333) phải DONE trước hoặc đồng thời.                                                                                                                   BPD Approved/Done

  BPD-EVD-004   Actual Excel/checksum/dry-run/reconcile    Chị Phương + WWHN-69 owners   WAIVED TO WWHN-69                        Không chặn BPD Done theo [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646); actual Excel, checksum, dry-run, reconciliation và rollback vẫn bắt buộc tại [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69) trước Migration Commit/Beta/Go-live. BPD Done ≠ migration ready.   Migration/Beta

  BPD-EVD-005   Thiết bị/điểm quét và performance target   Tech Lead + Khách hàng        P2 / DOWNSTREAM                          Model thiết bị, vị trí đọc, batch/latency nếu tích hợp thật.                                                                                                                                                                                                                                                                                                 Hardware readiness only

  BPD-EVD-006   Test Master/UAT/Cutover evidence           QA/PM/Khách hàng              DOWNSTREAM EXECUTION                     WWHN-33/WWHN-75; actual result, defect, evidence, sign-off.                                                                                                                                                                                                                                                                                                  QA/UAT/Go-live; không chặn BPD Done
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.4. Change log

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Version**   **Date**     **Thay đổi**                                                                                                                                                                                                                                                                                         **Tác giả**
  ------------- ------------ ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -------------
  1.0           22/07/2026   Phát hành BPD TO-BE từ BRD v3.11, SRS/FRD v1.3 (historical; superseded by v1.4) và tóm tắt yêu cầu đối tác; bổ sung readiness, AS-IS discovery, process inventory, process controls và open closure register.                                                                                        BA

  1.1           23/07/2026   Hoàn thiện P1: BPMN 2.0/swimlane; sơ đồ Putaway/Reconciliation/Reversal/App PV/Report/Migration; AS-IS–Gap–TO-BE; zone/location_hint; mẫu TO-BE; KPI baseline; warranty privacy; state/cancel/reopen rules; App PV cache; migration control; E2E; tách HTTP/API detail sang SRS/Technical Handoff.   BA

  1.2           23/07/2026   Đóng P0/P1 BPD gate: approval mechanism WWHN-335, AS-IS limited discovery evidence comment 12646, single-accountable RACI, Contract/Source/Supersession, staged traceability, reversal dependency guard và migration waiver WWHN-69.                                                                 BA

  1.3           24/07/2026   Đồng bộ SRS/FRD v1.4 theo WWHN-334 comment 12637; sửa metadata cp:version; sửa Source Supersession; phân loại KPI acceptance/pilot; bổ sung downstream ID/link FE/BE/QA; ghi rõ migration waiver theo WWHN-335 comment 12646 và BPD Done không đồng nghĩa migration ready.                           BA
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.5. P0 Closure Matrix

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **P0**         **Cách đóng trong BPD v1.3**                                                                                                    **Closure status**            **Evidence/Gate**            **Remaining condition**
  -------------- ------------------------------------------------------------------------------------------------------------------------------- ----------------------------- ---------------------------- ------------------------------------------------
  P0-01          Approval mechanism B: WWHN-335 DONE là formal approval; effective date = ngày transition.                                       CLOSED BY GOVERNANCE DESIGN   WWHN-335                     WWHN-333 DONE trước/đồng thời; PM transition

  P0-02          Contract-first Source Registry, Contract Coverage, discovery/decision/Jira sources và supersession register.                    CLOSED                        §1.3, §1.3.1, §1.3.2         Formal transition only

  P0-03          Khảo sát kho 30/06/2026 được tổng hợp trong Tóm tắt yêu cầu; limited evidence được xác nhận.                                    CLOSED                        WWHN-335 comment 12646; §2   Không yêu cầu ảnh/layout/time study/form riêng

  P0-04          Chị Phương là Accountable duy nhất; executor theo role; backup chưa chỉ định và cần ủy quyền.                                   CLOSED                        §3.2, §4.2–4.3               Không

  P0-05          Web App và carrier decision chỉ có hiệu lực theo BRD/Decision Record khi WWHN-333 DONE.                                         CONDITIONAL CLOSED            WWHN-333 comment 12635       WWHN-333 transition

  P0-06          Traceability theo staged model: Source/Decision → BP → REQ/BR/AC/TC → Jira/artifact/evidence.                                   CLOSED AT BPD LEVEL           §8.1; WWHN-31/33/40/69/75    Execution evidence downstream

  P0-07          Reversal khóa dependency, partial, chain correction, condition, pending return, permission, concurrency và report net effect.   CLOSED                        §5.10, §6.1–6.4              Implementation/test downstream
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 0.6. P1 Closure Matrix

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **P1**         Nội dung đóng trong BPD v1.3                                                                                            **Closure status**                   **Evidence/Section**                                                                                                                                                                         **Remaining dependency**
  -------------- ----------------------------------------------------------------------------------------------------------------------- ------------------------------------ -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **P1-01**      Thay 4 flowchart bằng BPMN swimlane, có actor/system/physical/document/handoff.                                         CLOSED                               Hình 2–5                                                                                                                                                                                     Formal review

  **P1-02**      Bổ sung Putaway, Reconciliation, Reversal, App publish, Report, Migration.                                              CLOSED                               Hình 6–11                                                                                                                                                                                    Không

  **P1-03**      AS-IS → Gap → TO-BE matrix có root cause, impact và KPI.                                                                CLOSED                               §2.3                                                                                                                                                                                         Limited discovery evidence đã được chấp thuận; refine qua Jira/CR nếu phát sinh

  **P1-04**      Chốt flat zone_code + location_hint/tray, không tạo stock bucket.                                                       CLOSED                               §3.3                                                                                                                                                                                         Khảo sát nhãn khu vực thực tế

  **P1-05**      Bổ sung 6 mẫu nghiệp vụ TO-BE; ghi rõ không phải mẫu AS-IS.                                                             CLOSED AS TO-BE                      §7.2                                                                                                                                                                                         Actual forms nếu Hoa Nam có

  **P1-06**      KPI có formula, owner, source, frequency và được phân loại rõ Acceptance Target, Pilot Monitoring hoặc Mixed Control.   CLOSED / TARGET CLASSIFIED           §7.3                                                                                                                                                                                         Acceptance target áp dụng theo gate; KPI pilot chỉ đo sau pilot và không dùng để chặn BPD Done.

  **P1-07**      Warranty privacy: access, masking, consent, export, retention, purge.                                                   CLOSED                               §6.5                                                                                                                                                                                         Security implementation

  **P1-08**      Chuẩn hóa transition một chiều; cancel/close/reopen terminal rules.                                                     CLOSED                               §6.2                                                                                                                                                                                         Không

  **P1-09**      App PV cache ≤60s; stale warning \>5m; last_inventory_sync_at.                                                          CLOSED                               §5.11, Hình 9                                                                                                                                                                                Monitoring implementation

  **P1-10**      Data Owner/schema/tolerance/dry-run/checksum/rollback/reconcile đã chốt.                                                WAIVED TO WWHN-69 / CLOSED FOR BPD   §5.13; [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646); [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69)   Actual file + execution chặn Migration Commit/Beta/Go-live; không chặn BPD Done. BPD Done ≠ migration ready.

  **P1-11**      E2E nhập→tồn→xuất→bảo hành→trả/reversal→App/report.                                                                     CLOSED                               §5.14                                                                                                                                                                                        TestCase Master + Test Data tại [[WWHN-33]{.underline}](https://tan0110.atlassian.net/browse/WWHN-33)

  **P1-12**      BPD giữ business control; HTTP status/header/API convention chuyển SRS/Tech.                                            CLOSED                               §6.3                                                                                                                                                                                         BE API/Data: [[WWHN-31]{.underline}](https://tan0110.atlassian.net/browse/WWHN-31); Permission: [[WWHN-40]{.underline}](https://tan0110.atlassian.net/browse/WWHN-40)
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 1. MỤC TIÊU, PHẠM VI VÀ NGUỒN

## 1.1. Mục tiêu tài liệu

-   Mô tả các quy trình nghiệp vụ WMS từ trigger đến kết quả, bao gồm actor, dữ liệu đầu vào/đầu ra, bước xử lý, ngoại lệ và kiểm soát.

-   Thống nhất cách vận hành TO-BE cho kho tổng Hoa Nam trước khi DEV/FE/QA thiết kế chi tiết, phát triển và kiểm thử.

-   Phân biệt rõ hoạt động làm thay đổi tồn và hoạt động chỉ cập nhật thông tin/mapping.

-   Quản lý các điểm chưa có evidence bên ngoài mà không để placeholder làm mơ hồ logic nghiệp vụ lõi.

## 1.2. Phạm vi MVP

  ------------------------------------------------------------------------------------------------------------------------------
  **Trong phạm vi**                                                    **Ngoài phạm vi**
  -------------------------------------------------------------------- ---------------------------------------------------------
  01 kho tổng Hoa Nam; đại lý là nơi nhận, không phải kho              Multi-warehouse hoặc tồn kho đại lý/cửa hàng con

  SKU PRODUCT/COMPONENT; item/serial; carton/box/tray; Physical_Code   Kệ/bin/sơ đồ kho hoặc tối ưu vị trí kho chuyên sâu

  Nhập kho, partial receipt, putaway linh kiện, reversal               Approval workflow cho phiếu nhập/xuất

  Xuất kho, partial issue, reverse issue/correction                    Bán hàng, order, reservation, payment, công nợ, giá vốn

  Tồn kho, ledger/balance/subledger, kiểm kê snapshot                  Hardware driver/gateway/protocol chuyên sâu

  Bảo hành cơ bản và TEMP_ONLY                                         Chi phí, SLA, người sửa/phân công sửa chữa

  Báo cáo kho và Web App PV read-only                                  Native mobile app, offline mode
  ------------------------------------------------------------------------------------------------------------------------------

## 1.3. Source Registry

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Source ID**   **Nguồn**                                                                                                                             **Nội dung sử dụng**                                                                                                                              **Đánh giá evidence**
  --------------- ------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------------------------------------------------------
  SRC-BPD-001     Tóm tắt yêu cầu đối tác – Biên bản tổng hợp discovery/khảo sát nghiệp vụ tại kho                                                      AS-IS discovery: Excel/thủ công, kiểm kê, hai cửa nhập–xuất, scan nhanh, bảo hành và App PV; khảo sát ngày 30/06/2026.                            AVAILABLE – CONTROLLING AS-IS DISCOVERY SUMMARY; NO SEPARATE PHOTO/FORM PACKAGE

  SRC-BPD-002     BRD Hoa Nam v3.11                                                                                                                     Scope, actor, feature, state, business rule, luồng chi tiết, decision, migration/UAT plan                                                         FINAL APPROVAL CANDIDATE; EFFECTIVE ON WWHN-333 DONE

  SRC-BPD-003     SRS/FRD Hoa Nam v1.4 – [[WWHN-334 comment 12637]{.underline}](https://tan0110.atlassian.net/browse/WWHN-334?focusedCommentId=12637)   Requirement, AC/TC, core flow, permission, data authority, privacy, cache/API/error/NFR và technical handoff reference                            CURRENT CONTROLLING P1 READINESS SOURCE; TECH APPROVAL GATES DOWNSTREAM

  SRC-BPD-004     Hợp đồng 07072026/HOANAM-A4I, ngày 21/07/2026, trang 1–2                                                                              Phạm vi tổng quát kho thông minh, App đại lý, RFID, nhập/xuất, kiểm kê, bảo hành                                                                  SOURCE AVAILABLE; NO APPENDIX

  SRC-BPD-005     WWHN-333 comment 12634 – Import Template                                                                                              Schema migration TO-BE và evidence template; actual Excel data chưa có                                                                            TEMPLATE AVAILABLE; ACTUAL FILE/EXECUTION WAIVED TO WWHN-69

  SRC-BPD-006     [[WWHN-333 comment 12635]{.underline}](https://tan0110.atlassian.net/browse/WWHN-333?focusedCommentId=12635)                          Kết luận/đề nghị PM phê duyệt BRD v3.11 và chuyển WWHN-333 DONE.                                                                                  AVAILABLE; FORMAL EFFECT ON WWHN-333 DONE

  SRC-BPD-007     [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646)                          Xác nhận chung: AS-IS limited discovery đủ đóng P0-03; migration execution được waiver sang WWHN-69; BPD Done không đồng nghĩa migration ready.   AVAILABLE – CONTROLLING BPD AS-IS + MIGRATION WAIVER EVIDENCE

  SRC-BPD-008     [[WWHN-335 – BPD approval task]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335)                                           Approval mechanism, attachment v1.3, transition history và effective date.                                                                        FORMAL APPROVAL EVENT = TASK DONE

  SRC-BPD-009     [[WWHN-69 – Migration execution]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69)                                           Actual Excel, checksum, dry-run, reconcile, rollback và sign-off.                                                                                 DOWNSTREAM; WAIVED FROM BPD DONE
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 1.3.1. Contract Coverage Matrix

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Coverage ID**   **Contract/Input item**                   **Process coverage**   **Detailed source**                                **Status**
  ----------------- ----------------------------------------- ---------------------- -------------------------------------------------- -----------------------------------------------
  CTR-BPD-001       Khảo sát, phân tích hệ thống kho          BP-WMS-01..13          HĐ trang 1–2; SRC-BPD-001; BRD v3.11; SRS v1.4     GENERAL CONTRACT SCOPE; DETAIL BY BRD/SRS/BPD

  CTR-BPD-002       RFID, nhập/xuất, kiểm kê, bảo hành        BP-WMS-02..10, 12      HĐ; DR-CARRIER-001; DEC-INV-001; DEC-PARTIAL-001   COVERED; TECH DETAIL DOWNSTREAM

  CTR-BPD-003       Ứng dụng đại lý/App PV                    BP-WMS-11              HĐ; DR-PLAT-001; BRD/SRS App PV scope              MVP WEB READ-ONLY BASELINE

  CTR-BPD-004       Dữ liệu đầu kỳ và triển khai thử nghiệm   BP-WMS-13              Import Template; WWHN-69; WWHN-75                  BPD DESIGN COVERED; EXECUTION DOWNSTREAM

  CR-POLICY-001     Capability ngoài kho/App PV baseline      N/A                    Formal Change Request                              OUT-OF-SCOPE CHANGE REQUIRES CR
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 1.3.2. Source and Supersession Register

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Artifact/statement cũ**             **Controlling artifact/decision**                 **Status**                      **Evidence**
  ------------------------------------- ------------------------------------------------- ------------------------------- --------------------------------------------------------------------------------------------------------------
  BPD v1.0                              BPD v1.3                                          SUPERSEDED                      WWHN-335 attachment history

  BPD v1.1                              BPD v1.3                                          SUPERSEDED                      WWHN-335 attachment history

  BPD v1.2                              BPD v1.3                                          SUPERSEDED                      WWHN-335 attachment history

  SRS/FRD v1.3                          SRS/FRD v1.4                                      SUPERSEDED                      [[WWHN-334 comment 12637]{.underline}](https://tan0110.atlassian.net/browse/WWHN-334?focusedCommentId=12637)

  BRD versions trước v3.11              BRD v3.11                                         SUPERSEDED WHEN WWHN-333 DONE   WWHN-333 comment 12635 + transition

  App local/platform chưa rõ            DR-PLAT-001 – Web App responsive                  SUPERSEDED FOR MVP              WWHN-333 DONE

  Carrier bắt buộc đồng nhất            DR-CARRIER-001 – ITEM chip; container linh hoạt   SUPERSEDED                      WWHN-333 DONE

  Actual migration evidence trong BPD   WWHN-69 execution record                          MOVED DOWNSTREAM / WAIVED       §5.13; WWHN-69
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 1.4. Nguyên tắc ưu tiên khi nguồn mâu thuẫn

-   Decision Record/Decision Matrix mới nhất trong BRD v3.11 và SRS/FRD v1.4 điều khiển TO-BE.

-   Tóm tắt yêu cầu đối tác chỉ được dùng để mô tả nhu cầu ban đầu và AS-IS ở mức discovery; không tự mở rộng scope ngoài BRD/SRS.

-   Các điểm chưa được nguồn hỗ trợ không được tự suy đoán; được ghi vào Open Closure Register với owner và evidence cần có.

-   BPD tập trung quy trình nghiệp vụ; API, DB, OpenAPI và test detail chỉ được tham chiếu khi cần giải thích control.

# 2. AS-IS Ở MỨC DISCOVERY

+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| **GIỚI HẠN VÀ EVIDENCE AS-IS**                                                                                                                                               |
|                                                                                                                                                                              |
| • Đội dự án đã khảo sát trực tiếp tại kho Hoa Nam ngày 30/06/2026. Phía Hoa Nam: Chị Phương – Quản lý kho. Phía dự án: Trần Tùng Lâm và Nguyễn Đình Hùng.                    |
|                                                                                                                                                                              |
| • Kết quả khảo sát được tổng hợp trong “Tóm tắt yêu cầu đối tác.docx” và được dùng làm nguồn AS-IS discovery cho BPD.                                                        |
|                                                                                                                                                                              |
| • Do quy mô dự án nhỏ và hiện trạng chủ yếu quản lý bằng Excel/thao tác thủ công, hai bên không lập riêng bộ ảnh hiện trường, sơ đồ layout, time study hoặc mẫu phiếu AS-IS. |
|                                                                                                                                                                              |
| • BPD chỉ khẳng định các chi tiết được ghi trong nguồn discovery; điều chỉnh phát sinh khi UAT/vận hành thử được quản lý bằng Jira/Change Request.                           |
|                                                                                                                                                                              |
| • WWHN-335 comment 12646 xác nhận mức evidence này đủ đóng P0-03 và không chặn BPD Done.                                                                                     |
+==============================================================================================================================================================================+
+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

## 2.1. Hiện trạng đã được nguồn hỗ trợ

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Nhóm**            **Hiện trạng discovery**                                                                                 **Hệ quả**
  ------------------- -------------------------------------------------------------------------------------------------------- ---------------------------------------------------------------------------
  Quản lý dữ liệu     Dữ liệu kho được lưu bằng Excel; SKU đang cần chuẩn hóa.                                                 Khó duy trì mã duy nhất, truy vết vòng đời và đối soát nhiều nguồn.

  Định danh hàng      Chưa có mã quét/chip ổn định cho toàn bộ máy; tem dán có thể mờ.                                         Tra cứu và kiểm kê phụ thuộc nhập tay/nhận diện thủ công.

  Kiểm kê             Kiểm kê chưa có phần mềm quản lý tốt và mất nhiều thời gian.                                             Rủi ro đếm trùng, thiếu evidence và khó giải thích chênh lệch.

  Nhập/xuất           Có điểm/cửa nhập và xuất cần thao tác nhanh bằng quét.                                                   Nếu ghi tay sau thao tác vật lý có thể chậm cập nhật hoặc sai tồn.

  Bảo hành            Máy khách dùng một thời gian có thể mang tới đại lý/kho để sửa/bảo hành; vị trí để máy chưa chuẩn hóa.   Khó nhận diện khi mất mã và khó theo dõi trạng thái xử lý.

  Kênh xem sản phẩm   Cần app nội bộ/read-only để chủ đại lý/khách xem sản phẩm và tồn khả dụng.                               Thông tin sản phẩm/tồn chưa được chuẩn hóa thành kênh tra cứu thống nhất.
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 2.2. Pain points và mục tiêu cải tiến

  -------------------------------------------------------------------------------------------------------------------------------------------
  **Pain point**                             **Mục tiêu TO-BE**
  ------------------------------------------ ------------------------------------------------------------------------------------------------
  Kiểm kê thủ công, chậm                     Scan batch/wide-range hoặc demo scanner; snapshot, count cutoff, variance và movement warning.

  Mã dán dễ mờ/khó nhận diện                 Physical_Code duy nhất; ITEM bắt buộc chip; container carrier linh hoạt.

  Excel và SKU chưa chuẩn                    Product Master Data, SKU code chuẩn và alias cho mã cũ.

  Nguy cơ cập nhật tồn lặp                   Post Receipt/Post Issue/Apply Adjustment idempotent và atomic.

  Không rõ máy bảo hành khi mất mã           TEMP_ONLY với temporary_item_code và thông tin nhận diện bắt buộc.

  Dữ liệu tồn và container dễ double count   Movement authoritative; Balance projection; item/container subledger reconcile.
  -------------------------------------------------------------------------------------------------------------------------------------------

## 2.3. AS-IS → Gap → TO-BE Impact Matrix

Ma trận dưới đây chuyển discovery evidence đã được xác nhận thành control TO-BE. Các chi tiết vật lý không có trong nguồn khảo sát không được tự suy đoán; nếu phát sinh khác biệt tại UAT/vận hành thử, BA cập nhật bằng Jira/Change Request với Process Owner.

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Pain point AS-IS**                              **Root cause**                                                         **Control TO-BE**                                                                               **Impact role/handoff**                                                 **Impact data/system**                                              **KPI**
  ------------------------------------------------- ---------------------------------------------------------------------- ----------------------------------------------------------------------------------------------- ----------------------------------------------------------------------- ------------------------------------------------------------------- -------------------------------------------------------------
  Kiểm kê thủ công, lâu và khó giải thích lệch      Không có Physical_Code thống nhất; không có snapshot/cutoff/evidence   Scan batch; snapshot; expected_at_count; movement warning; approve/waive; adjustment có audit   NV kho chuyển từ ghi tay sang scan/count; QL kho review variance        Stocktake Session/Snapshot/Count/Variance; authoritative movement   Stocktake cycle time; unknown scan; variance/reconciliation

  Tem/mã dễ mờ, định danh không ổn định             Mã dán và legacy code chưa có source of truth                          Physical_Code duy nhất; ITEM dùng chip; alias mã cũ; unknown không được Post                    NV kho scan/đối chiếu; Admin quản lý code                               Code uniqueness, carrier mapping, Scan_Event                        Unknown/duplicate scan rate

  Excel và SKU chưa chuẩn                           Nhiều nguồn, format/mã trùng, chưa có Data Owner rõ                    Product Master; SKU chuẩn; migration dry-run/checksum/error file                                Chị Phương là Data Owner; BA map; QA reconcile                          Migration_Batch, alias, validation report                           Migration pass rate

  Nhập/xuất có nguy cơ cập nhật chậm hoặc lặp       Handoff vật lý và ghi nhận hệ thống tách rời; retry/click lặp          Scan tại handoff; Post là điểm đổi tồn; business request key; atomic transaction                NV kho chịu trách nhiệm evidence; QL kho theo dõi lỗi                   Movement + Balance + subledger cùng commit                          Posting error; duplicate posting prevented

  Không rõ máy bảo hành khi mất mã                  Không có định danh thay thế và evidence tiếp nhận                      TEMP_ONLY, temporary_item_code, description/ảnh/consent, state history                          NV bảo hành tiếp nhận/đối chiếu; quyền PII tách biệt                    Warranty_Case/Event; PII access audit                               Unknown warranty identification; turnaround (monitor)

  Tồn và container dễ double count                  Không phân biệt SKU/item/container/locator                             Movement authoritative; Balance projection; carton/box/tray không là stock bucket               QL kho reconcile; NV kho sửa mapping bằng Putaway/Correction            Ledger–Balance–Subledger 3 lớp                                      Inventory reconciliation pass rate

  App xem tồn có thể chậm hoặc hiểu nhầm realtime   Read model/cache không có freshness contract                           Cache ≤60 giây; last_inventory_sync_at; cảnh báo stale \>5 phút; read-only                      Admin publish; Tech vận hành sync; người xem nhận freshness indicator   PV cache/read model; sync timestamp                                 PV freshness compliance
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 3. KIẾN TRÚC QUY TRÌNH TO-BE

![](media/image1.png){width="7.0in" height="1.6001312335958005in"}

*Hình 1. Bản đồ quy trình nghiệp vụ WMS và điểm tích hợp App PV*

## 3.1. Nguyên tắc điều khiển quy trình

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **ID**   **Nguyên tắc**                                                                                **Hệ quả vận hành**
  -------- --------------------------------------------------------------------------------------------- ------------------------------------------------------------------------
  P-01     MVP chỉ có 01 kho tổng. Agency là master data nơi nhận.                                       Không tạo balance, movement hoặc stocktake cho agency.

  P-02     Tồn chỉ đổi tại Post Receipt, Post Issue, Apply Adjustment hoặc Reversal đã post.             DRAFT/SCANNING/PUTAWAY/WARRANTY/App PV không tự đổi tồn.

  P-03     Inventory_Movement là authoritative ledger; Balance và subledger cập nhật cùng transaction.   Mọi lệch phải tạo incident và xử lý bằng reversal/adjustment có audit.

  P-04     Mọi action đổi tồn bắt buộc idempotent.                                                       Retry cùng key/payload không tạo movement hoặc cập nhật tồn lần hai.

  P-05     ITEM bắt buộc dùng chip; CARTON/BOX/TRAY carrier linh hoạt.                                   Nghiệp vụ xử lý theo Physical_Code, không phụ thuộc vendor thiết bị.

  P-06     Container/locator không phải bucket tồn độc lập.                                              Không double count thùng/hộp/khay với item/quantity bên trong.

  P-07     Nhập/xuất hỗ trợ partial post và close remainder.                                             Có PARTIALLY_POSTED; không over-receipt/over-issue.

  P-08     Kiểm kê không khóa toàn kho.                                                                  Dùng snapshot + movement đến cutoff + stale guard.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 3.2. Process inventory

  ------------------------------------------------------------------------------------------------------------------------------------------------------
  **Process ID**   **Tên quy trình**                    **Loại**       **Accountable / Process Owner**   **Kết quả**
  ---------------- ------------------------------------ -------------- --------------------------------- -----------------------------------------------
  BP-WMS-01        Quản lý danh mục, SKU và mã vật lý   Supporting     Chị Phương – QL kho Hoa Nam       Master data sẵn sàng cho giao dịch

  BP-WMS-02        Nhập kho sản phẩm/máy theo thùng     Core           Chị Phương – QL kho Hoa Nam       Tăng tồn sản phẩm đúng một lần

  BP-WMS-03        Nhập kho linh kiện và Putaway        Core           Chị Phương – QL kho Hoa Nam       Tăng tồn; gán vị trí khay không đổi tồn

  BP-WMS-04        Xuất kho sản phẩm                    Core           Chị Phương – QL kho Hoa Nam       Giảm tồn, ghi nơi nhận

  BP-WMS-05        Xuất kho linh kiện                   Core           Chị Phương – QL kho Hoa Nam       Giảm tồn theo serial/quantity

  BP-WMS-06        Tra cứu tồn và đối soát              Control        Chị Phương – QL kho Hoa Nam       Tồn ledger/balance/subledger khớp

  BP-WMS-07        Kiểm kê và điều chỉnh                Control        Chị Phương – QL kho Hoa Nam       Variance được review và apply an toàn

  BP-WMS-08        Bảo hành máy có mã                   Core-support   Chị Phương – QL kho Hoa Nam       Theo dõi vòng đời, không tăng tồn bán

  BP-WMS-09        Bảo hành TEMP_ONLY                   Core-support   Chị Phương – QL kho Hoa Nam       Theo dõi bằng mã tạm, không suy đoán item gốc

  BP-WMS-10        Reversal/Correction sau Post         Control        Chị Phương – QL kho Hoa Nam       Sửa sai append-only, giữ movement gốc

  BP-WMS-11        Publish và cung cấp tồn cho App PV   Integration    Chị Phương – QL kho Hoa Nam       Read-only product + available_qty

  BP-WMS-12        Báo cáo vận hành                     Reporting      Chị Phương – QL kho Hoa Nam       XNT, kiểm kê, bảo hành

  BP-WMS-13        Migration và Opening Balance         Transition     Chị Phương – QL kho Hoa Nam       Dữ liệu đầu kỳ đối soát và ký xác nhận
  ------------------------------------------------------------------------------------------------------------------------------------------------------

## 3.3. Decision Baseline – zone_code, location_hint và Tray

DEC-BPD-LOC-001: MVP không triển khai cây zone/rack/bin hoặc tồn theo vị trí. Để đáp ứng nhu cầu “khu vực/vị trí tương đối ở mức đủ dùng”, hệ thống cho phép nhãn khu vực phẳng và gợi ý vị trí; các trường này chỉ hỗ trợ tìm kiếm/handoff, không tham gia công thức tồn và không chặn Post.

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Thành phần**      **Baseline P1**                                                                                                                    **Bắt buộc**                                                             **Cách dùng**                                                     **Không được hiểu là**
  ------------------- ---------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------------ ----------------------------------------------------------------- ---------------------------------------------
  **zone_code**       Nhãn khu vực phẳng do QL kho cấu hình; ví dụ RECEIVING, BULK_STORAGE, COMPONENT_AREA, WARRANTY, DISPATCH. Không có parent/child.   Optional; nên ghi tại handoff/putaway khi biết                           Lọc/tìm khu vực tương đối, điều phối vật lý và báo cáo vận hành   Warehouse con, bin hierarchy hoặc chiều tồn

  **location_hint**   Mô tả vị trí tương đối nullable; ví dụ “gần cửa nhập”, “dãy trái khu linh kiện”, “phòng bảo hành”.                                 Optional                                                                 Hiển thị cho NV kho khi tìm hàng; audit khi thay đổi              Địa chỉ tồn chính xác hoặc khóa duy nhất

  **tray_code**       Locator có Physical_Code; dùng cho box linh kiện sau Putaway.                                                                      Bắt buộc khi box đã được xếp vào tray; không bắt buộc ngay lúc Receipt   Box–Tray mapping và tra cứu vị trí                                SKU, stock bucket hoặc đơn vị xuất

  **handoff_area**    Khu vực vật lý ghi tại bước nhận/bàn giao nếu vận hành cần.                                                                        Optional theo SOP                                                        Evidence nơi chuyển giao trách nhiệm                              Điểm tích hợp thiết bị cố định trong MVP

  **Quy tắc stock**   Inventory_Balance chỉ theo kho tổng + SKU + stock status; zone/tray/location không tạo balance/movement riêng.                     Always                                                                   Ngăn double count và giữ inventory authority                      Tồn theo zone/tray
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 4. ACTOR, RACI VÀ PHÂN TÁCH TRÁCH NHIỆM

## 4.1. Actor

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Actor**                          **Trách nhiệm chính**
  ---------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------
  Admin hệ thống                     Cấu hình tài khoản/quyền, master data, SKU, Physical_Code, publish sản phẩm và tham số hệ thống.

  Quản lý kho tổng / Process Owner   Chị Phương – Quản lý kho Hoa Nam; Accountable duy nhất cho baseline nghiệp vụ kho, dữ liệu đầu vào, reconciliation và quyết định vận hành.

  Nhân viên kho                      Tạo/scan phiếu nhập/xuất, đếm kiểm kê, putaway, tra cứu item/container.

  Nhân viên bảo hành                 Tiếp nhận, cập nhật và trả máy bảo hành; quản lý TEMP_ONLY.

  Ban lãnh đạo                       Xem báo cáo read-only.

  Người xem App PV                   Xem sản phẩm published và available_qty, không tạo nghiệp vụ kho.

  PM/PO/Đại diện khách hàng          Phê duyệt scope, quyết định, waiver, UAT và Go/No-Go.

  Backup Process Owner               NOT DESIGNATED. Khi cần thay thế, Hoa Nam phải ủy quyền và cấp tài khoản/quyền tương ứng; không mặc định mọi nhân viên kho có quyền approve/adjust/reversal.

  Executor theo vai trò              Nhân viên kho, nhân viên bảo hành, Admin, BA/Tech/QA thực hiện theo tài khoản, role và action-level permission; không cần ghi tên cá nhân cố định.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 4.2. RACI cấp quy trình

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Process**                        **Accountable (A) duy nhất**   **Responsible / Executor (R)**                **Consulted (C)**                   **Informed / View (I/V)**
  ---------------------------------- ------------------------------ --------------------------------------------- ----------------------------------- ------------------------------------
  BP-WMS-01 Danh mục/SKU/Mã          Chị Phương                     Admin/người có master.manage                  NV kho, NV bảo hành, Tech           Lãnh đạo; App PV chỉ xem published

  BP-WMS-02 Nhập sản phẩm            Chị Phương                     NV kho được phân quyền                        Admin/Tech khi lỗi                  Lãnh đạo

  BP-WMS-03 Nhập linh kiện/Putaway   Chị Phương                     NV kho được phân quyền                        Admin/Tech                          Lãnh đạo

  BP-WMS-04 Xuất sản phẩm            Chị Phương                     NV kho được phân quyền                        Admin/Tech                          Lãnh đạo

  BP-WMS-05 Xuất linh kiện           Chị Phương                     NV kho được phân quyền                        Admin/Tech                          Lãnh đạo

  BP-WMS-06 Tra cứu/Đối soát         Chị Phương                     Admin hoặc NV kho được phân quyền             Tech/QA                             Lãnh đạo theo quyền

  BP-WMS-07 Kiểm kê/Adjustment       Chị Phương                     NV kho đếm; Chị Phương/người ủy quyền Apply   Admin/QA                            Lãnh đạo

  BP-WMS-08/09 Bảo hành              Chị Phương                     NV bảo hành/người được giao                   Admin; NV kho khi handoff           Lãnh đạo theo báo cáo

  BP-WMS-10 Reversal/Correction      Chị Phương                     Người có inventory.reversal.post              NV kho cung cấp evidence; Tech/QA   Lãnh đạo

  BP-WMS-11 Publish App PV           Chị Phương                     Admin hệ thống                                Tech/FE                             Lãnh đạo; App PV user

  BP-WMS-12 Báo cáo                  Chị Phương                     Hệ thống/Admin vận hành report                Tech/QA                             Lãnh đạo/người có quyền xem

  BP-WMS-13 Migration/Opening        Chị Phương – Data Owner        BA/Tech import; QA đối soát                   PM/PO                               Các bên Go/No-Go
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 4.3. Quy tắc Process Owner, Backup và Ủy quyền

Process Owner/Data Owner: Chị Phương – Quản lý kho Hoa Nam. Chị Phương là Accountable duy nhất đối với baseline nghiệp vụ kho, dữ liệu đầu vào, kết quả đối soát và quyết định vận hành.

Backup: NOT DESIGNATED – authorization required when needed. Người thay thế chỉ được thực hiện action sau khi Hoa Nam ủy quyền và hệ thống cấp đúng role/permission.

Executor được xác định theo vai trò, không theo cá nhân cố định. Các action nhạy cảm như Post, Apply Adjustment và Reversal chỉ được thực hiện khi có action-level permission; backend phải enforce.

R = Responsible; A = Accountable; C = Consulted; I/V = Informed/View. Mỗi process có đúng một A là Chị Phương. Người thực hiện được xác định theo role/permission; ủy quyền không chuyển trách nhiệm Accountable và phải có audit.

# 5. QUY TRÌNH NGHIỆP VỤ TO-BE CHI TIẾT

Các quy trình dưới đây là nội dung có thể dùng để formal review. Mỗi quy trình được mô tả theo mục tiêu, trigger, actor, đầu vào/đầu ra, luồng chính, hậu điều kiện, ngoại lệ và nguồn truy vết.

*BPMN notation: user task = xanh dương; system task = xanh lá; physical task = vàng; document/evidence = biểu tượng tờ giấy; handoff/message = nét tím đứt; gateway = hình thoi.*

*Hình 2. BPMN 2.0/Swimlane – Nhập kho và Partial Receipt*

![](media/image6.png){width="6.25in" height="2.7741633858267716in"}

*Hình 3. BPMN 2.0/Swimlane – Xuất kho và Partial Issue*

![](media/image7.png){width="6.25in" height="2.7741633858267716in"}

*Hình 4. BPMN 2.0/Swimlane – Kiểm kê Snapshot, Reconciliation và Adjustment*

![](media/image8.png){width="6.25in" height="2.7741633858267716in"}

*Hình 5. BPMN 2.0/Swimlane – Bảo hành có mã, TEMP_ONLY và Privacy Control*

![](media/image9.png){width="6.25in" height="2.7690168416447944in"}

*Hình 6. BPMN 2.0/Swimlane – Putaway Linh kiện và Location Hint*

![](media/image10.png){width="6.25in" height="2.7741633858267716in"}

*Hình 7. BPMN 2.0/Swimlane – Reconciliation Ledger, Balance và Subledger*

![](media/image11.png){width="6.25in" height="2.7834765966754156in"}

*Hình 8. BPMN 2.0/Swimlane – Reversal/Correction Append-only*

![](media/image12.png){width="6.25in" height="2.7741633858267716in"}

*Hình 9. BPMN 2.0/Swimlane – App PV Publish, Cache Freshness và Degraded Behavior*

![](media/image13.png){width="6.25in" height="2.770044838145232in"}

*Hình 10. BPMN 2.0/Swimlane – Báo cáo, Export và Data Quality Warning*

![](media/image14.png){width="6.25in" height="2.781402012248469in"}

*Hình 11. BPMN 2.0/Swimlane – Migration, Dry-run, Reconciliation và Rollback Gate*

![](media/image15.png){width="6.25in" height="2.7845155293088366in"}

  -----------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- -----------------------------------------------------------------------------------------------------------
  Mục tiêu          Tạo nền dữ liệu chuẩn để mọi giao dịch scan, nhập, xuất, kiểm kê, bảo hành và App PV dùng cùng định danh.

  Trigger           Có SKU/sản phẩm/linh kiện/đại lý/mã vật lý mới hoặc cần cập nhật/ngừng hoạt động.

  Actor chính       Admin, Quản lý kho; NV kho/NV bảo hành ở quyền xem hoặc tạo nhanh theo phân quyền.

  Đầu vào           Product master data, legacy SKU, thông tin brand/category/model/spec, code_value/hardware_uid, Agency.

  Tiền điều kiện    Người dùng có quyền master data; dữ liệu bắt buộc và quy tắc unique đã được xác định.

  Đầu ra/Kết thúc   SKU/Agency/Physical_Code/Container active; alias mã cũ; dữ liệu sẵn sàng cho giao dịch.
  -----------------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**      **Hoạt động nghiệp vụ**                                                            **Xử lý/Kết quả hệ thống**                                                                 **Rule/ngoại lệ liên quan**
  ---------- -------------- ---------------------------------------------------------------------------------- ------------------------------------------------------------------------------------------ --------------------------------
  01         Admin/QL kho   Tạo hoặc cập nhật category, brand, model, đơn vị tính, defect catalog và Agency.   Validate code unique, trạng thái ACTIVE/INACTIVE; Agency không sinh Warehouse/Balance.     WM-SCOPE-002; BR-AGY-01

  02         Admin/QL kho   Tạo SKU PRODUCT hoặc COMPONENT theo format chuẩn.                                  Validate sku_code unique; lưu sku_type, is_serial_tracked, unit và thuộc tính phân biệt.   BR-SKU-01..10

  03         Admin/QL kho   Khai báo alias cho mã SKU cũ nếu migration.                                        Alias unique theo source; không dùng alias làm khóa tồn.                                   REQ-SRS-021

  04         Admin/QL kho   Tạo Physical_Code cho ITEM/CARTON/BOX/TRAY.                                        code_value unique; ITEM bắt buộc carrier chip; container carrier linh hoạt.                DR-CARRIER-001; BR-CODE-01..07

  05         Hệ thống       Khóa sửa sku_code/serial mode khi đã phát sinh stock/movement.                     Trả business rule violation nếu cố thay đổi thuộc tính ảnh hưởng dữ liệu vận hành.         BR-SKU-10; AC-SRS-002

  06         Admin/QL kho   Publish/unpublish hồ sơ sản phẩm cho App PV.                                       Chỉ SKU active mới publish; lưu profile, ảnh, tags, industries.                            REQ-SRS-020; PV-VIS-001
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Master data không tự tạo Inventory_Movement.

-   Mỗi code_value chỉ map một đối tượng nghiệp vụ tại một thời điểm.

-   Agency chỉ là nơi nhận, không phải kho.

## Ngoại lệ chính

  ------------------------------------------------------------------------------------------------------------------
  **Tình huống**                **Cách xử lý bắt buộc**
  ----------------------------- ------------------------------------------------------------------------------------
  SKU trùng mã                  Chặn tạo; yêu cầu dùng mã khác hoặc cập nhật bản ghi hiện có.

  ITEM thiếu chip mapping       Không cho dùng trong core flow cần item identification.

  Carrier container chưa chốt   Cho phép cấu hình QR/BARCODE/RFID/NFC/MANUAL theo decision; không block core flow.

  Mã cũ trùng alias             Đưa vào error list để BA/QL kho xử lý trước commit migration.
  ------------------------------------------------------------------------------------------------------------------

# 5.2. BP-WMS-02 – Nhập kho sản phẩm/máy theo thùng

  -------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- -------------------------------------------------------------------------------------------
  Mục tiêu          Ghi nhận máy vào kho tổng theo carton/item, hỗ trợ partial receipt và không tăng tồn lặp.

  Trigger           Hàng sản phẩm/máy được giao đến kho tổng.

  Actor chính       NV kho (R), QL kho/Admin (A theo quyền).

  Đầu vào           Phiếu/nguồn nhập, SKU dự kiến, carton code, item code/chip, expected_qty.

  Tiền điều kiện    Kho tổng active; SKU PRODUCT active; mã không trùng; quyền inbound.create/post.

  Đầu ra/Kết thúc   Item IN_STOCK; carton IN_STOCK/PARTIAL; Balance tăng; movement RECEIPT_POSTED.
  -------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**       **Hoạt động nghiệp vụ**                                  **Xử lý/Kết quả hệ thống**                                                               **Rule/ngoại lệ liên quan**
  ---------- --------------- -------------------------------------------------------- ---------------------------------------------------------------------------------------- ------------------------------
  01         NV kho          Tạo phiếu nhập và dòng expected_qty theo SKU.            Tạo trạng thái DRAFT; chưa đổi tồn.                                                      BR-IN-01

  02         NV kho          Scan/nhập mã carton hoặc dùng Demo máy quét.             Tạo/nhận diện CARTON; ghi Scan_Batch/Scan_Event.                                         BR-SCAN-01..02; BR-CON-01

  03         NV kho          Scan các mã item trong carton; có thể nhận cùng batch.   Phân loại ITEM/CARTON/UNKNOWN; map item vào carton; cảnh báo trùng/lạ/khác SKU.          BR-SCAN-02; BR-CON-01/08

  04         NV kho          Kiểm tra số thực nhận và chọn subset cần post.           Tính remaining_qty; không cho vượt expected/remaining trong MVP.                         DEC-PARTIAL-001

  05         NV kho/QL kho   Post Receipt với khóa yêu cầu nghiệp vụ duy nhất.        Trong một transaction: tạo posting event/movement, tăng Balance, cập nhật Item/Carton.   REQ-SRS-007/008; DEC-INV-001

  06         Hệ thống        Xác định trạng thái phiếu.                               PARTIALLY_POSTED nếu còn remainder; POSTED nếu đủ.                                       DEC-PARTIAL-001

  07         QL kho/Admin    Nếu không nhận tiếp, Close remainder kèm lý do.          Phiếu CLOSED; cancelled_remainder_qty = remaining; không đổi tồn.                        REQ-SRS-007
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   DRAFT/SCANNING không làm tăng tồn.

-   Retry cùng khóa yêu cầu nghiệp vụ duy nhất/cùng payload trả kết quả cũ.

-   Carton không được cộng thêm như một đơn vị tồn ngoài item.

## Ngoại lệ chính

  -------------------------------------------------------------------------------------------------------------------------------
  **Tình huống**                **Cách xử lý bắt buộc**
  ----------------------------- -------------------------------------------------------------------------------------------------
  Mã item trùng                 Chặn; hiển thị item đang thuộc phiếu/kho/trạng thái nào.

  Item khác SKU trong carton    Chặn hoặc yêu cầu tách carton.

  Over-receipt                  Không cho phép trong MVP; điều chỉnh expected hoặc tạo chứng từ khác theo quyền.

  Post lỗi giữa chừng           Rollback document/movement/balance/subledger trong cùng transaction.

  Cùng key nhưng payload khác   Chặn do business request key đã dùng với nội dung khác; không đổi tồn; technical code theo SRS.
  -------------------------------------------------------------------------------------------------------------------------------

# 5.3. BP-WMS-03 – Nhập kho linh kiện và Putaway

  ------------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- ------------------------------------------------------------------------------------------------------------
  Mục tiêu          Nhập linh kiện theo serial hoặc quantity, tăng tồn tại Post Receipt và gán khay sau nhập mà không đổi tồn.

  Trigger           Linh kiện/phụ tùng được giao đến kho tổng.

  Actor chính       NV kho (R), QL kho/Admin (A).

  Đầu vào           SKU COMPONENT, is_serial_tracked, box code, serial hoặc quantity, expected_qty, tray code khi putaway.

  Tiền điều kiện    SKU active; box một SKU; mã/quantity hợp lệ.

  Đầu ra/Kết thúc   Balance linh kiện tăng; box RECEIVED_PENDING_PUTAWAY/STORED; mapping Box–Tray.
  ------------------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**       **Hoạt động nghiệp vụ**                                                        **Xử lý/Kết quả hệ thống**                                                              **Rule/ngoại lệ liên quan**
  ---------- --------------- ------------------------------------------------------------------------------ --------------------------------------------------------------------------------------- -----------------------------
  01         NV kho          Tạo phiếu nhập linh kiện và dòng expected_qty.                                 DRAFT; chưa đổi tồn.                                                                    BR-IN-01

  02         NV kho          Scan box và serial nếu is_serial_tracked=true; hoặc nhập quantity nếu false.   Validate một box chỉ chứa một SKU; SCANNING.                                            BR-COMP-01; BR-CON-02

  03         NV kho/QL kho   Post Receipt với khóa yêu cầu nghiệp vụ duy nhất.                              Tăng Balance; item serial → IN_STOCK hoặc box quantity tăng; movement RECEIPT_POSTED.   REQ-SRS-007/008

  04         Hệ thống        Nếu chưa có tray thực tế, gán trạng thái Chờ xếp khay.                         Box = RECEIVED_PENDING_PUTAWAY; quantity vẫn tính Available.                            BR-PTW-01

  05         NV kho          Khi đặt hàng vào khay, tạo Putaway task và scan tray + box.                    Tạo DRAFT putaway; validate tray active và box hợp lệ.                                  BR-PTW-02

  06         NV kho/QL kho   Confirm Putaway.                                                               Cập nhật tray mapping/location hint; box → STORED; không sinh movement.                 REQ-SRS-009
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Post Receipt là điểm duy nhất tăng tồn trong quy trình này.

-   Putaway không đổi available_qty và không sinh Inventory_Movement.

-   Linh kiện quantity-only không yêu cầu serial.

## Ngoại lệ chính

  --------------------------------------------------------------------------------------------------------------------------------
  **Tình huống**                                          **Cách xử lý bắt buộc**
  ------------------------------------------------------- ------------------------------------------------------------------------
  Scan box nhưng không nhập quantity cho SKU non-serial   Không đủ dữ liệu; yêu cầu quantity thực nhận.

  Box chứa SKU khác                                       Chặn và yêu cầu box khác.

  Tray inactive/không tồn tại                             Không confirm putaway.

  Putaway lặp                                             Cập nhật mapping theo transaction/audit; không được tạo biến động tồn.

  Quantity vượt expected/remaining                        Chặn theo partial receipt rule.
  --------------------------------------------------------------------------------------------------------------------------------

# 5.4. BP-WMS-04 – Xuất kho sản phẩm

  -------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- -------------------------------------------------------------------------------------------------
  Mục tiêu          Xuất nguyên carton hoặc từng item từ kho tổng cho Agency/đối tượng nhận, giảm tồn đúng một lần.

  Trigger           Có yêu cầu xuất hàng hợp lệ.

  Actor chính       NV kho (R), QL kho/Admin (A).

  Đầu vào           Agency/receiver, SKU/planned_qty, carton/item code.

  Tiền điều kiện    Agency active; item IN_STOCK; đủ available; quyền outbound.create/post.

  Đầu ra/Kết thúc   Item ISSUED; carton PARTIAL/ISSUED; Balance giảm; ISSUE_POSTED; agency_id lưu trên chứng từ.
  -------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**       **Hoạt động nghiệp vụ**                                      **Xử lý/Kết quả hệ thống**                                               **Rule/ngoại lệ liên quan**
  ---------- --------------- ------------------------------------------------------------ ------------------------------------------------------------------------ -----------------------------
  01         NV kho          Tạo phiếu xuất, chọn Agency/đối tượng nhận và planned_qty.   DRAFT; không tạo tồn agency.                                             WM-SCOPE-002/003

  02         NV kho          Xuất nguyên thùng: scan carton.                              Tải các item còn IN_STOCK trong carton vào phiếu.                        BR-CON-05

  03         NV kho          Hoặc xuất lẻ: scan từng item.                                Validate item thuộc kho tổng, IN_STOCK và chưa nằm trong posting khác.   BR-OUT-02

  04         NV kho          Kiểm tra subset sẽ xuất.                                     Không vượt planned remaining hoặc available.                             DEC-PARTIAL-001

  05         NV kho/QL kho   Post Issue với khóa yêu cầu nghiệp vụ duy nhất.              Lock SKU/item/carton; tạo ISSUE_POSTED; giảm Balance; item → ISSUED.     REQ-SRS-011/012

  06         Hệ thống        Xác định PARTIALLY_POSTED hoặc POSTED.                       Carton PARTIAL nếu còn item IN_STOCK; ISSUED nếu hết.                    State model

  07         QL kho/Admin    Close remainder nếu không xuất tiếp.                         CLOSED kèm reason; không đổi tồn.                                        REQ-SRS-011
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Agency chỉ là chiều nơi nhận; không tạo movement tăng hoặc balance tại agency.

-   Concurrency phải bảo đảm chỉ một request commit trên cùng item/available.

-   App PV chỉ đọc balance sau khi post thành công.

## Ngoại lệ chính

  -----------------------------------------------------------------------------------------------------------------------
  **Tình huống**                                         **Cách xử lý bắt buộc**
  ------------------------------------------------------ ----------------------------------------------------------------
  Carton đã xuất hết                                     Báo không còn item khả dụng.

  Item đã ISSUED/IN_WARRANTY/RETURNED_TO_CUSTOMER/LOST   Chặn xuất.

  Thiếu available do request đồng thời                   Một request thành công; request còn lại conflict/insufficient.

  Retry post                                             Trả kết quả cũ; không trừ tồn lần hai.

  Hàng quay lại kho                                      Không sửa phiếu gốc; dùng Reverse Issue/Return confirmation.
  -----------------------------------------------------------------------------------------------------------------------

# 5.5. BP-WMS-05 – Xuất kho linh kiện

  ---------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- ---------------------------------------------------------------------------------------
  Mục tiêu          Xuất linh kiện theo serial hoặc quantity từ box; không xuất tray và không cho âm kho.

  Trigger           Có yêu cầu xuất linh kiện.

  Actor chính       NV kho (R), QL kho/Admin (A).

  Đầu vào           Agency/receiver, SKU component, serial hoặc box + quantity.

  Tiền điều kiện    SKU active; serial/quantity khả dụng; box tồn tại.

  Đầu ra/Kết thúc   Serial ISSUED hoặc box quantity giảm; Balance giảm; ISSUE_POSTED.
  ---------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**       **Hoạt động nghiệp vụ**                                                               **Xử lý/Kết quả hệ thống**                                  **Rule/ngoại lệ liên quan**
  ---------- --------------- ------------------------------------------------------------------------------------- ----------------------------------------------------------- -----------------------------
  01         NV kho          Tạo/thêm dòng linh kiện trên phiếu xuất.                                              DRAFT/SCANNING; chưa đổi tồn.                               BR-OUT-01

  02         Hệ thống        Hiển thị box/tray gợi ý để tìm hàng.                                                  Tra cứu mapping; tray chỉ là locator.                       BR-CON-03/06

  03         NV kho          Nếu serial-tracked, scan từng serial; nếu quantity-only, scan box và nhập số lượng.   Validate mode theo SKU.                                     BR-COMP-01

  04         Hệ thống        Kiểm tra quantity còn trong box và total available.                                   Chặn vượt box_qty/remaining/available.                      BR-OUT-03

  05         NV kho/QL kho   Post Issue idempotent.                                                                Giảm Balance; cập nhật serial/box; movement ISSUE_POSTED.   REQ-SRS-012

  06         Hệ thống        Cập nhật box PARTIAL/EMPTY và phiếu PARTIALLY_POSTED/POSTED.                          Không thay đổi tray như một đơn vị tồn.                     BR-CON-04/06
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Không có nghiệp vụ xuất tray.

-   Tồn quantity-only là tổng quantity khả dụng trong box đủ điều kiện.

-   Putaway/location không thay thế kiểm tra tồn ở commit time.

## Ngoại lệ chính

  ---------------------------------------------------------------------------------------------------
  **Tình huống**                  **Cách xử lý bắt buộc**
  ------------------------------- -------------------------------------------------------------------
  Xuất quantity vượt box          Chặn và yêu cầu nhập lại.

  Scan tray như hàng xuất         Chặn; chỉ dùng tray để liệt kê box.

  Serial không IN_STOCK           Chặn.

  Hai request lấy cùng quantity   Lock/optimistic version; không cho âm.

  Box quantity và Balance lệch    Tạo reconciliation incident; block sign-off, không tự sửa ledger.
  ---------------------------------------------------------------------------------------------------

# 5.6. BP-WMS-06 – Tra cứu tồn và đối soát

  -----------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- -----------------------------------------------------------------------------------------
  Mục tiêu          Cung cấp tồn hiện tại đáng tin cậy và phát hiện lệch giữa ledger, balance và subledger.

  Trigger           Người dùng tra cứu tồn, chạy báo cáo hoặc job/check phát hiện divergence.

  Actor chính       QL kho/Admin (R/A), NV kho/Lãnh đạo (View theo quyền).

  Đầu vào           Inventory_Movement, Inventory_Balance, Item_Instance, Box quantity, filter SKU/status.

  Tiền điều kiện    Các posting đã commit; người dùng có quyền report/inventory view.

  Đầu ra/Kết thúc   Tồn theo SKU/trạng thái; location hint; reconciliation incident nếu lệch.
  -----------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**      **Hoạt động nghiệp vụ**                              **Xử lý/Kết quả hệ thống**                                                                          **Rule/ngoại lệ liên quan**
  ---------- -------------- ---------------------------------------------------- --------------------------------------------------------------------------------------------------- -----------------------------
  01         Người dùng     Tra cứu SKU/item/carton/box/tray hoặc báo cáo tồn.   Hệ thống đọc Balance và subledger phù hợp; không cộng container độc lập.                            DEC-INV-001

  02         Hệ thống       Tính/hiển thị available_qty.                         Serial: count IN_STOCK; quantity: sum box eligible; warranty/issued không tính.                     BR-WAR-11; §13.2 BRD

  03         Hệ thống/Job   Đối soát ledger → balance.                           Opening + receipt - issue ± adjustment/reversal phải bằng Balance.                                  SRS §7.2

  04         Hệ thống/Job   Đối soát serial/quantity subledger → balance.        Tổng item/box đủ điều kiện phải khớp available.                                                     DEC-INV-001

  05         QL kho/Admin   Xử lý divergence.                                    Tạo incident, điều tra source; dùng reversal/adjustment có audit, không update/delete ledger gốc.   BR-REV-01/04
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Inventory_Movement là authoritative ledger.

-   Balance là projection phục vụ đọc nhanh.

-   Divergence phải có incident và evidence resolution.

## Ngoại lệ chính

  ------------------------------------------------------------------------------------------------------------------------------
  **Tình huống**                         **Cách xử lý bắt buộc**
  -------------------------------------- ---------------------------------------------------------------------------------------
  Balance âm                             Block posting liên quan; điều tra concurrency/data.

  Serial count lệch Balance              Tạo incident; không auto đổi item/ledger.

  Container mapping sai nhưng tồn đúng   Sửa mapping qua putaway/correction có audit; không sinh movement.

  Người dùng không có scope              Từ chối do ngoài quyền/phạm vi; cách biểu diễn kỹ thuật theo SRS/permission contract.

  Dữ liệu App PV cache                   Hiển thị/log last_inventory_sync_at nếu có cache.
  ------------------------------------------------------------------------------------------------------------------------------

# 5.7. BP-WMS-07 – Kiểm kê và điều chỉnh

  -------------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- -------------------------------------------------------------------------------------------------------------
  Mục tiêu          Kiểm kê không khóa toàn hệ thống nhưng vẫn tính đúng chênh lệch tại thời điểm đếm và chống apply lặp/stale.

  Trigger           Kế hoạch kiểm kê toàn kho hoặc theo phạm vi SKU/nhóm.

  Actor chính       NV kho (count), QL kho/Admin (review/apply).

  Đầu vào           Phạm vi kiểm kê, snapshot, scan/count, movement sau snapshot, reason/approval line.

  Tiền điều kiện    Kho/SKU active; quyền stocktake; snapshot tạo thành công.

  Đầu ra/Kết thúc   Session APPLIED/CANCELLED; ADJUST_IN/ADJUST_OUT cho line approved; evidence variance.
  -------------------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**       **Hoạt động nghiệp vụ**                                             **Xử lý/Kết quả hệ thống**                                                        **Rule/ngoại lệ liên quan**
  ---------- --------------- ------------------------------------------------------------------- --------------------------------------------------------------------------------- -----------------------------
  01         QL kho/NV kho   Tạo Stocktake Session và phạm vi.                                   Cùng transaction ghi stocktake_started_at, session_version và snapshot.           BR-COUNT-08

  02         NV kho          Start Counting; scan item/carton/box/tray hoặc nhập quantity.       Ghi actual và count_cutoff_at; scan/count không đổi tồn.                          BR-COUNT-03..07

  03         Hệ thống        Tập hợp net movement đã commit từ snapshot đến cutoff.              Không tính transaction chưa commit tại cutoff; movement sau cutoff tạo warning.   BR-COUNT-09/10

  04         Hệ thống        Tính expected_at_count và variance_to_apply.                        expected = snapshot + net movement; variance = actual - expected.                 AC-P0-STK-001

  05         QL kho          Review actual/snapshot/expected/movement/variance; ack warning.     Session REVIEWING; stale data phải refresh/recount.                               BR-COUNT-10/13

  06         QL kho          Approve hoặc Waive từng variance line.                              Chỉ APPROVED được apply; WAIVED phải có reason.                                   BR-COUNT-12

  07         QL kho/Admin    Apply Adjustment với khóa yêu cầu nghiệp vụ duy nhất và If-Match.   Atomic update Balance/subledger/movement; line → APPLIED.                         REQ-SRS-015

  08         Hệ thống        Đóng session.                                                       APPLIED khi mọi line APPLIED hoặc WAIVED; retry không tạo duplicate adjustment.   BR-COUNT-11/12
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Không khóa toàn kho ở mức hệ thống.

-   Scan tray không thay thế đếm quantity trong box.

-   Ví dụ chuẩn: snapshot 100, issue -10, actual 90 → expected 90, variance 0.

## Ngoại lệ chính

  --------------------------------------------------------------------------------------------------------------------------------
  **Tình huống**                   **Cách xử lý bắt buộc**
  -------------------------------- -----------------------------------------------------------------------------------------------
  Scan trùng serial                Cảnh báo và không tính trùng.

  Movement phát sinh trong phiên   Hiển thị warning và bắt buộc ack trước apply.

  Stale session version            Chặn do session/review stale; refresh và review lại trước Apply; technical response theo SRS.

  Partial approval                 Chỉ line APPROVED sinh movement; line còn PENDING không được đóng session.

  Apply retry                      Trả response cũ; không sinh ADJUST lần hai.
  --------------------------------------------------------------------------------------------------------------------------------

# 5.8. BP-WMS-08 – Bảo hành máy có mã

  -----------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- -----------------------------------------------------------------------------------------------
  Mục tiêu          Theo dõi tiếp nhận–xử lý–trả máy có item_code mà không đưa máy vào tồn bán.

  Trigger           Khách/đại lý gửi máy có mã hợp lệ để bảo hành/sửa chữa.

  Actor chính       NV bảo hành (R), QL kho/Admin (C/A theo quyền).

  Đầu vào           item_code, customer name/phone, reported defect, phụ kiện/ảnh, ngày nhận.

  Tiền điều kiện    Item ISSUED hoặc RETURNED_TO_CUSTOMER; không có active warranty case khác.

  Đầu ra/Kết thúc   Warranty Case RETURNED/CANCELLED; item IN_WARRANTY rồi RETURNED_TO_CUSTOMER; Warranty Events.
  -----------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**     **Hoạt động nghiệp vụ**                                     **Xử lý/Kết quả hệ thống**                                      **Rule/ngoại lệ liên quan**
  ---------- ------------- ----------------------------------------------------------- --------------------------------------------------------------- -----------------------------
  01         NV bảo hành   Scan/nhập item_code.                                        Tra cứu item; validate state và active case.                    BR-WAR-10..13

  02         NV bảo hành   Nhập khách/SĐT, bệnh, tình trạng ban đầu và phụ kiện/ảnh.   Validate field bắt buộc; tạo case RECEIVED.                     BR-WAR-02/04

  03         Hệ thống      Chuyển item → IN_WARRANTY.                                  Không sinh Inventory_Movement; available không tăng.            BR-WAR-01/11

  04         NV bảo hành   Cập nhật CHECKING → REPAIRING → COMPLETED.                  Ghi Warranty_Event và kết quả/confirmed defect.                 State model

  05         NV bảo hành   Return to customer.                                         Case → RETURNED; item → RETURNED_TO_CUSTOMER; không IN_STOCK.   BR-WAR-05/13
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Một item tối đa một active case.

-   ISSUED/IN_WARRANTY/RETURNED_TO_CUSTOMER không tính Available.

-   Có thể mở chu kỳ bảo hành mới sau RETURNED nếu không có active case.

## Ngoại lệ chính

  -----------------------------------------------------------------------------------------------------------------------
  **Tình huống**                       **Cách xử lý bắt buộc**
  ------------------------------------ ----------------------------------------------------------------------------------
  Item không tồn tại                   Chuyển sang quy trình TEMP_ONLY nếu không thể định danh.

  Item đang IN_STOCK                   Không dùng warranty flow để lấy hàng kho; cần rule/nghiệp vụ riêng.

  Active case đã tồn tại               Chặn vì item đã có active warranty case; không tạo case thứ hai.

  Chuyển RETURNED khi chưa COMPLETED   Chặn.

  Muốn đưa lại hàng vào tồn bán        Không tự động; phải có nghiệp vụ kiểm định/nhập/điều chỉnh riêng được phê duyệt.
  -----------------------------------------------------------------------------------------------------------------------

# 5.9. BP-WMS-09 – Bảo hành TEMP_ONLY

  --------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- --------------------------------------------------------------------------------------------------------
  Mục tiêu          Quản lý máy mất/hỏng mã hoặc không thể truy vết bằng mã tạm, tránh liên kết sai với máy đã bán.

  Trigger           Khách gửi máy nhưng không có/không đọc được/không nhớ item_code.

  Actor chính       NV bảo hành (R), QL kho/Admin (C).

  Đầu vào           Customer, phone, reported defect, missing_code_reason, manual description, ảnh nếu có, model nếu biết.

  Tiền điều kiện    Không thể xác nhận item gốc một cách đáng tin cậy.

  Đầu ra/Kết thúc   Warranty Case TEMP_ONLY với temporary_item_code; sales_trace_status=NOT_TRACEABLE.
  --------------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**     **Hoạt động nghiệp vụ**                                       **Xử lý/Kết quả hệ thống**                                                           **Rule/ngoại lệ liên quan**
  ---------- ------------- ------------------------------------------------------------- ------------------------------------------------------------------------------------ -----------------------------
  01         NV bảo hành   Chọn “Tạo case không có mã/TEMP_ONLY”.                        Bật bộ field bắt buộc cho case không định danh.                                      BR-WAR-07

  02         NV bảo hành   Nhập khách/SĐT, bệnh, lý do mất mã, mô tả nhận diện và ảnh.   Model có thể UNKNOWN_MODEL; không suy đoán item.                                     BR-WAR-08/09

  03         Hệ thống      Sinh temporary_item_code và warranty_case_code.               item_code null; identification_status=TEMP_ONLY; sales_trace_status=NOT_TRACEABLE.   REQ-SRS-016

  04         NV bảo hành   Xử lý CHECKING → REPAIRING → COMPLETED.                       Ghi event theo mã tạm.                                                               State model

  05         NV bảo hành   Đối chiếu mã tạm + khách/SĐT + mô tả/ảnh và trả máy.          Case → RETURNED; không cập nhật Item_Instance hoặc tồn.                              BR-WAR-08
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   TEMP_ONLY không gắn Item_Instance và không xác nhận lịch sử bán hàng.

-   Không làm tăng/giảm sellable stock.

-   Mã tạm chỉ dùng nội bộ cho ca bảo hành.

## Ngoại lệ chính

  ---------------------------------------------------------------------------------------------------------------------------------
  **Tình huống**                      **Cách xử lý bắt buộc**
  ----------------------------------- ---------------------------------------------------------------------------------------------
  Nhân viên cố link theo phỏng đoán   Không cho auto-link; giữ NOT_TRACEABLE.

  Thiếu missing_code_reason/mô tả     Không cho lưu.

  Khách mất mã tạm                    Tra cứu bằng case code/SĐT/mô tả/ảnh theo quyền.

  Sau này tìm lại item gốc            Chỉ link bằng quy trình correction có quyền/audit và bằng chứng; không sửa lịch sử âm thầm.
  ---------------------------------------------------------------------------------------------------------------------------------

# 5.10. BP-WMS-10 – Reversal và Correction sau Post

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Mục tiêu          Sửa sai giao dịch đã post bằng chứng từ append-only, giữ nguyên lịch sử và chống đảo lặp.

  Trigger           Phát hiện Post Receipt/Issue sai hoặc hàng đã xuất quay lại kho.

  Actor chính       Chị Phương – QL kho (A); người có inventory.reversal.post (R); NV kho cung cấp evidence.

  Đầu vào           Original document/movement, reversal type, quantity, reason, condition hàng, khóa yêu cầu nghiệp vụ duy nhất.

  Tiền điều kiện    Giao dịch gốc POSTED; còn reversible_qty; quyền hợp lệ; dependency downstream đã được khóa/đảo theo thứ tự; hàng quay lại có evidence vật lý và condition được xác định.

  Đầu ra/Kết thúc   Reversal POSTED append-only; movement ngược; Balance/subledger và report net effect cập nhật; correction_chain/original reference đầy đủ.
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**       **Actor**                 **Hoạt động nghiệp vụ**                                              **Xử lý/Kết quả hệ thống**                                                                                                                  **Rule/ngoại lệ liên quan**
  -------------- ------------------------- -------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------- -----------------------------
  01             Người có quyền reversal   Tạo request, chọn movement gốc, reason, line/qty và reversal type.   DRAFT; tạo correction_chain_id; không sửa/xóa document/movement gốc.                                                                        BR-REV-01/02

  02             Hệ thống                  Tính reversible_qty và khóa chain.                                   reversible_qty = original_qty − tổng qty reversal POSTED; chặn vượt qty và concurrent duplicate.                                            BR-REV-04/05

  03             Hệ thống/QL kho           Kiểm tra downstream dependency.                                      Reverse Receipt bị chặn nếu item/qty đã Issue/Warranty/Adjustment; phải đảo dependency theo thứ tự ngược hoặc mở correction chain hợp lệ.   BR-REV-06/07

  04             NV kho + QL kho           Xác nhận handoff vật lý và condition với Reverse Issue.              PENDING_RETURN cho đến khi hàng về; SELLABLE mới cộng available; DEFECTIVE/NON_SELLABLE vào condition/status riêng.                         BR-REV-03/08

  05             Người có quyền reversal   Confirm/Post với business request key duy nhất.                      Atomic: movement ngược, Balance/subledger/item state, reversal POSTED; rollback toàn bộ nếu một bước lỗi.                                   DEC-INV-001; BR-REV-09

  06             Hệ thống/QL kho           Đối soát và cập nhật báo cáo.                                        Ledger–Balance–Subledger khớp; report hiển thị original, reversal, correction chain và net effect.                                          BR-REV-10/11

  07             QL kho                    Sửa tiếp nếu reversal đã POSTED sai.                                 Không reverse trực tiếp reversal; tạo correction/reversal mới link correction_chain và giữ full audit.                                      BR-REV-12
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát: reversal giữ nguyên movement gốc; dependency, reversible_qty, condition và correction_chain được audit; báo cáo trình bày gross movement, reversal và net effect.

-   Không UPDATE/DELETE Inventory_Movement hoặc chứng từ gốc; mọi sửa sai sau Post là append-only.

-   Stocktake/Adjustment không được dùng để che lỗi chứng từ có thể truy nguyên; ưu tiên reversal/correction theo source transaction.

-   Mọi reversal có reason, actor, timestamp, request_id, original reference, correction_chain, physical return evidence và condition khi áp dụng.

## Ngoại lệ chính

  -------------------------------------------------------------------------------------------------------------------------------------------------
  **Tình huống**                                            **Cách xử lý bắt buộc**
  --------------------------------------------------------- ---------------------------------------------------------------------------------------
  Retry cùng key/cùng payload                               Replay kết quả cũ; không sinh movement/stock effect lần hai.

  Cùng key nhưng payload khác                               Chặn request identity conflict; stock effect = 0.

  Partial reversal                                          Chỉ đảo subset hợp lệ; qty không vượt reversible_qty; phần còn lại vẫn truy vết được.

  Reverse Receipt có downstream Issue/Warranty/Adjustment   Chặn; đảo dependency theo thứ tự ngược hoặc xử lý correction chain được phê duyệt.

  Reverse Issue nhưng hàng chưa về                          Giữ PENDING_RETURN; không cộng IN_STOCK/available.

  Hàng về DEFECTIVE/NON_SELLABLE                            Ghi condition/status riêng; không cộng sellable available; report tách condition.

  Reverse-of-reversal                                       Không thao tác trực tiếp trên reversal POSTED; tạo correction mới link chain.

  Stocktake đang Apply/posting chưa hoàn tất                Chặn hoặc chờ transaction hoàn tất; refresh dữ liệu trước review/post.

  Hai request reversal đồng thời                            Lock chain/movement; chỉ một request commit.

  Reconciliation/report mismatch                            Tạo incident; block sign-off; không update/delete ledger gốc.
  -------------------------------------------------------------------------------------------------------------------------------------------------

# 5.11. BP-WMS-11 – Publish và cung cấp tồn cho App PV

  ------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- ------------------------------------------------------------------------------------------------
  Mục tiêu          Cung cấp sản phẩm published và available_qty kho tổng cho kênh Web App read-only.

  Trigger           Admin/QL kho publish sản phẩm hoặc tồn kho thay đổi sau posting.

  Actor chính       Admin/QL kho (publish), App PV/User (read).

  Đầu vào           PV Product Profile, published flag, ngành nghề/tag, Inventory_Balance available_qty.

  Tiền điều kiện    SKU active; profile đầy đủ; người dùng có quyền publish hoặc đọc public.

  Đầu ra/Kết thúc   Danh sách/chi tiết/recommendation; available_qty, Còn hàng/Hết hàng và last_inventory_sync_at.
  ------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**      **Hoạt động nghiệp vụ**                                         **Xử lý/Kết quả hệ thống**                                                                                                    **Rule/ngoại lệ liên quan**
  ---------- -------------- --------------------------------------------------------------- ----------------------------------------------------------------------------------------------------------------------------- -------------------------------------------------------
  01         Admin/QL kho   Cấu hình profile, ảnh, thông số, ngành nghề, tags và publish.   Chỉ active SKU mới published.                                                                                                 PV-VIS-001

  02         Người xem      Mở list/search/filter/recommendation.                           Chỉ trả product active + published; không lộ item/container/movement.                                                         REQ-SRS-017/019

  03         Hệ thống       Đọc available_qty từ Balance kho tổng.                          Hiển thị số và trạng thái: \>0 Còn hàng; =0 Hết hàng.                                                                         REQ-SRS-018

  04         Hệ thống       Đồng bộ PV cache/read model sau publish hoặc action đổi tồn.    Freshness target ≤ 60 giây trong điều kiện bình thường; ghi last_inventory_sync_at; App PV không reserve hoặc tạo movement.   BPD-PV-FRESH-001; tham chiếu SRS REQ-SRS-018/BR-PV-14

  05         Người xem      Xem chi tiết và phụ kiện tương thích.                           Read-only; không order/payment/hold/post issue.                                                                               DR-PLAT-001
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   App PV không thay đổi tồn.

-   Không hiển thị serial/item/carton/box/tray, movement, phiếu hoặc tồn agency.

-   Recommendation dùng rule cấu hình, không AI trong MVP.

## Ngoại lệ chính

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Tình huống**                                   **Cách xử lý bắt buộc**
  ------------------------------------------------ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Sản phẩm inactive/chưa publish                   Không xuất hiện kể cả deep link.

  Balance = 0                                      Hiển thị Hết hàng; không cho giữ/đặt.

  Cache chậm                                       Nếu tuổi dữ liệu \> 5 phút, vẫn cho xem read-only nhưng phải hiển thị “Dữ liệu tồn có thể chậm” và last_inventory_sync_at. Nếu chưa từng sync, hiển thị “Tạm thời chưa có dữ liệu tồn”, không suy đoán số lượng.

  Người dùng cố thực hiện thao tác ghi từ App PV   App PV không cung cấp nghiệp vụ kho/đặt hàng/giữ hàng; từ chối theo permission. Endpoint và technical response thuộc SRS.

  Profile thiếu dữ liệu hiển thị                   Không publish hoặc hiển thị empty/placeholder theo rule UI được duyệt.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 5.12. BP-WMS-12 – Báo cáo vận hành

  ------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- ------------------------------------------------------------------------------------
  Mục tiêu          Cung cấp dữ liệu tồn, XNT, lịch sử, kiểm kê và bảo hành phục vụ vận hành/quản trị.

  Trigger           Người dùng xem/export báo cáo hoặc kỳ báo cáo đến hạn.

  Actor chính       QL kho/Admin/Lãnh đạo; NV kho view nếu được cấp.

  Đầu vào           Movement, Balance, documents, stocktake, warranty, filters.

  Tiền điều kiện    Người dùng có quyền report.view; dữ liệu đã post.

  Đầu ra/Kết thúc   Báo cáo tồn hiện tại, XNT, lịch sử, kiểm kê, bệnh máy; export nếu triển khai.
  ------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**    **Hoạt động nghiệp vụ**                                                                 **Xử lý/Kết quả hệ thống**                                **Rule/ngoại lệ liên quan**
  ---------- ------------ --------------------------------------------------------------------------------------- --------------------------------------------------------- -----------------------------
  01         Người dùng   Chọn báo cáo và filter thời gian/SKU/category/status/agency nơi nhận.                   Validate quyền và phạm vi.                                Permission matrix

  02         Hệ thống     Tính tồn đầu kỳ/nhập/xuất/adjust/reversal/cuối kỳ từ ledger.                            Không coi agency là kho; filter agency chỉ là nơi nhận.   BR-SCOPE-04

  03         Hệ thống     Hiển thị tồn hiện tại từ Balance kèm location hint.                                     Không double count container.                             BR-CON-04

  04         Hệ thống     Hiển thị kiểm kê: snapshot, expected, actual, variance, movement warning, adjustment.   Trace theo session/line.                                  REQ-SRS-014/015

  05         Hệ thống     Hiển thị bảo hành theo SKU/model/defect/status/date.                                    TEMP_ONLY có thể UNKNOWN_MODEL; không suy đoán item.      REQ-SRS-016

  06         Người dùng   Export Excel/PDF nếu thuộc release.                                                     Giữ filter, thời gian tạo và người xuất.                  Should
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Báo cáo phải có nguồn dữ liệu/logic nhất quán với ledger.

-   Role Lãnh đạo là read-only.

-   Export là Should, không chặn core flow nếu chưa triển khai.

## Ngoại lệ chính

  ------------------------------------------------------------------------------------------------------------------
  **Tình huống**             **Cách xử lý bắt buộc**
  -------------------------- ---------------------------------------------------------------------------------------
  Kỳ báo cáo có divergence   Hiển thị/cảnh báo incident; không che sai lệch.

  Filter agency              Chỉ thống kê xuất cho agency, không tồn agency.

  Dữ liệu chưa post          Không tính vào báo cáo tồn/XNT.

  Người dùng ngoài scope     Từ chối do ngoài quyền/phạm vi; cách biểu diễn kỹ thuật theo SRS/permission contract.
  ------------------------------------------------------------------------------------------------------------------

# 5.13. BP-WMS-13 – Migration và Opening Balance

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**    **Nội dung**
  ----------------- -----------------------------------------------------------------------------------------------------------------------------------------------
  Mục tiêu          Chuyển dữ liệu ban đầu từ Excel/kiểm đếm vào hệ thống có dry-run, reconciliation và rollback.

  Trigger           Chuẩn bị UAT/cutover/go-live hoặc nạp master/opening stock.

  Actor chính       Data Owner: Chị Phương – Quản lý kho Hoa Nam; BA, Tech Lead/DEV, QA, PM/PO.

  Đầu vào           Import Template tại WWHN-333 comment 12634; actual Excel SKU/item/chip/container/agency/opening stock được bàn giao và kiểm soát tại WWHN-69.

  Tiền điều kiện    Template và owner dữ liệu xác định; backup/rollback plan; code format và unique rule sẵn sàng.

  Đầu ra/Kết thúc   BPD design baseline; execution output tại WWHN-69 gồm Migration Batch, opening balance, checksum, error file, reconciliation và sign-off.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------

## Luồng TO-BE chi tiết

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**   **Actor**          **Hoạt động nghiệp vụ**                                                                         **Xử lý/Kết quả hệ thống**                                                                                                           **Rule/ngoại lệ liên quan**
  ---------- ------------------ ----------------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------ -----------------------------
  01         Chị Phương/BA      Bàn giao Import Template và file dữ liệu theo version; xác định source of truth từng dataset.   Ghi owner, file/version, received_at và SHA-256 tại WWHN-69. Actual file chưa có không chặn BPD Done.                                BPD-MIG-CTRL-001

  02         Tech/BA            Chạy dry-run.                                                                                   Không đổi dữ liệu thật; xuất valid/invalid/duplicate counts và error file.                                                           REQ-SRS-021

  03         QL kho/BA          Sửa dữ liệu hoặc xác nhận waiver cho lỗi được phép.                                             Không commit nếu critical error \> 0 hoặc total pass rate \< 99,5%; mọi waiver non-critical phải có owner/reason/evidence.           AC-SRS-021

  04         Tech/QL kho        Commit migration trong cửa sổ cutover.                                                          Tạo opening data/movement theo thiết kế; audit Migration_Batch.                                                                      DEC-INV-001

  05         QL kho/QA          Đối soát theo SKU/item/container và kiểm đếm thực tế.                                           Reconcile 5 cấp: record, business key, quantity theo SKU, item/serial, container mapping; quantity và critical data phải đạt 100%.   BRD P0-8

  06         PM/PO/Khách hàng   Go/No-Go hoặc rollback.                                                                         Go/No-Go/rollback được thực hiện tại WWHN-69/WWHN-75; reconciliation failed thì No-Go.                                               REQ-SRS-022
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Migration Control Baseline – P1-10

Status: CLOSED FOR BPD / EXECUTION WAIVED TO [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69). Template, Data Owner, schema, tolerance, checksum, dry-run, rollback và reconciliation control đã chốt. [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646) là PM/PO evidence xác nhận actual Excel và execution evidence không chặn BPD Done nhưng bắt buộc trước Migration Commit/Beta/Go-live. BPD Done không đồng nghĩa migration ready.

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Control**                         **Baseline đã chốt**
  ----------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Data Owner**                      Chị Phương – Quản lý kho Hoa Nam; chịu trách nhiệm tính đầy đủ, source of truth và xác nhận opening balance.

  **Controlled source**               Import Template: WWHN-333 comment 12634; actual Excel/checksum/execution: [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69).

  **Schema minimum**                  SKU Master; SKU Alias; Agency; Physical_Code; Item/Serial; Carton/Box/Tray mapping; Opening Quantity/Condition.

  **Sample policy**                   Các dòng tại §7.2.6 là dữ liệu minh họa TO-BE, không phải dữ liệu thật Hoa Nam.

  **Tolerance**                       Critical identifier/reference/quantity error = 0; total valid record ≥ 99,5%; quantity reconciliation = 100%.

  **Dry-run exit criteria**           100% critical records valid; tổng pass ≥99,5%; duplicate critical = 0; error file phát hành; checksum khóa; Data Owner + QA xác nhận.

  **Checksum/version**                SHA-256 cho từng file trước dry-run và commit; file thay đổi phải tạo version/checksum mới và chạy lại toàn bộ dry-run.

  **Rollback**                        Chụp pre-migration backup/snapshot; ghi migration_batch_id và opening movement reference; No-Go thì restore hoặc chạy rollback plan được Tech phê duyệt. BPD không quy định lệnh DB.

  **Reconciliation level**            Record count; business key uniqueness; quantity theo SKU/status; serialized item count; container mapping; ledger–balance–subledger.

  BPD gate waiver                     PM/PO chấp thuận tại [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646): actual file, checksum, dry-run và reconciliation không chặn BPD Done; các nội dung này vẫn là hard gate cho Migration Commit/Beta/Go-live. BPD Done không đồng nghĩa migration ready.
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ---------------------------------------------------------------------------------------------------------------------------------------
  **Dataset**            **Critical key**                  **Required field baseline**                     **Ví dụ minh họa**
  ---------------------- --------------------------------- ----------------------------------------------- ------------------------------
  SKU Master             sku_code                          sku_name, sku_type, unit, serial_mode, status   DCH-DRILL-DJZ10A-220V-V1

  SKU Alias              source + legacy_sku_code          sku_code mới, source                            EXCEL-OLD + MAYKHOAN-01

  Agency                 agency_code                       agency_name, status                             AG-HN-001

  Physical Code / Item   code_value hoặc item_code         code_type, carrier_type, sku_code, condition    ITEM-RFID-000001

  Container mapping      container_code + child code/SKU   container_type, parent/tray, quantity           BOX-001 → TRAY-01, qty 100

  Opening Balance        warehouse + sku + stock_status    quantity, source_ref, as_of_date                WH-HN + SKU-A + NORMAL = 100
  ---------------------------------------------------------------------------------------------------------------------------------------

## Hậu điều kiện và kiểm soát

-   Bộ file dữ liệu thật chưa được cung cấp trong nguồn hiện tại.

-   Opening balance phải có người có thẩm quyền xác nhận.

-   Rollback và rehearsal là gate trước Go-live.

## Ngoại lệ chính

  -----------------------------------------------------------------------------------------------------------------
  **Tình huống**              **Cách xử lý bắt buộc**
  --------------------------- -------------------------------------------------------------------------------------
  Duplicate item/chip/code    Không commit dòng lỗi; đưa error file.

  SKU cũ không map được       Giữ pending/error; không tạo SKU suy đoán.

  Excel lệch kiểm đếm         Dùng kiểm đếm được QL kho ký xác nhận làm source of truth theo quyết định hiện tại.

  Reconciliation không khớp   No-Go/rollback.

  File thay đổi sau dry-run   Chạy lại bằng checksum/version mới.
  -----------------------------------------------------------------------------------------------------------------

# 5.14. End-to-End Scenario – Nhập → Tồn → Xuất → Bảo hành → Trả/Reversal → App PV/Báo cáo

Scenario minh họa dùng SKU-A, opening balance = 0 và 10 item có mã. Đây là test data TO-BE, không phải dữ liệu thật Hoa Nam. Scenario tách rõ “trả máy bảo hành cho khách” và “Reverse Issue hàng quay lại kho” vì hai action có stock effect khác nhau.

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước**    **Process/Handoff**               **Business action**                                                           **State/Evidence**                                                     **Stock effect**   **Expected available_qty**
  ----------- --------------------------------- ----------------------------------------------------------------------------- ---------------------------------------------------------------------- ------------------ ----------------------------
  0           Precondition                      SKU-A active/published; 10 item code hợp lệ; kho tổng active.                 Opening = 0                                                            0                  0

  1           BP-WMS-02 Inbound                 Nhận và Post Receipt 10 item.                                                 Inbound POSTED; 10 RECEIPT_POSTED; item IN_STOCK                       +10                10

  2           BP-WMS-03 Putaway/Location        Gán carton/box/tray hoặc location_hint.                                       Putaway CONFIRMED; mapping audit                                       0                  10

  3           BP-WMS-11 App PV                  Đồng bộ read model trong ≤60 giây.                                            last_inventory_sync_at; App hiển thị Còn hàng                          0                  10

  4           BP-WMS-04 Outbound                Post Issue 2 item cho AG-HN-001.                                              2 ISSUE_POSTED; item A/B → ISSUED                                      -2                 8

  5           BP-WMS-08 Warranty Receive        Khách mang item A bảo hành; tạo case và consent.                              Item A → IN_WARRANTY; case RECEIVED                                    0                  8

  6           BP-WMS-08 Warranty Return         Hoàn tất và trả item A cho khách.                                             Case RETURNED; item A → RETURNED_TO_CUSTOMER                           0                  8

  7           BP-WMS-10 Reverse Issue           Phát hiện xuất nhầm item B; hàng vật lý quay lại SELLABLE và Post reversal.   ISSUE_REVERSED; item B → IN_STOCK; trace movement gốc                  +1                 9

  8           BP-WMS-06/12 Reconcile & Report   Reconcile rồi chạy XNT và warranty report.                                    0 + receipt 10 - issue 2 + issue reversal 1 = closing 9; report PASS   0                  9

  9           BP-WMS-11 App PV                  Cache nhận balance mới; nếu \>5 phút hiển thị stale warning.                  available_qty = 9; last_inventory_sync_at mới                          0                  9
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 6. QUY TẮC KIỂM SOÁT XUYÊN QUY TRÌNH

## 6.1. Stock effect matrix

  --------------------------------------------------------------------------------------------------------------------------------------------------------
  **Hoạt động**                   **Stock effect**         **Movement**                      **Ghi chú**
  ------------------------------- ------------------------ --------------------------------- -------------------------------------------------------------
  Create/Scan Inbound             0                        Không                             Chỉ tạo document/scan event.

  Post Receipt                    +N                       RECEIPT_POSTED                    Idempotent, atomic, partial supported.

  Putaway                         0                        Không                             Chỉ Box–Tray/location mapping.

  Create/Scan Outbound            0                        Không                             Chưa giảm tồn.

  Post Issue                      -N                       ISSUE_POSTED                      Idempotent, lock/no negative stock.

  Create/Count/Review Stocktake   0                        Không                             Snapshot/count/variance only.

  Apply Adjustment                ±N                       ADJUST_IN/ADJUST_OUT              Chỉ line approved; version hiện hành + idempotency control.

  Warranty Receive/Return         0                        Không                             Không tăng sellable stock.

  Post Reversal                   ±N ngược giao dịch gốc   RECEIPT_REVERSED/ISSUE_REVERSED   Append-only; giữ movement gốc.

  App PV view/search/filter       0                        Không                             Read-only.
  --------------------------------------------------------------------------------------------------------------------------------------------------------

## 6.2. State transition summary

Ký pháp chuẩn: FROM -- Action \[Guard\] / Stock effect --\> TO. Mũi tên là một chiều; không dùng ký hiệu ↔. Trạng thái terminal không được reopen trực tiếp; phát sinh nghiệp vụ mới hoặc correction/reversal có liên kết và audit.

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Object**   **FROM**                           **Action / Guard**                                **TO**                         **Stock effect**         **Cancel / Close / Reopen rule**
  ------------ ---------------------------------- ------------------------------------------------- ------------------------------ ------------------------ -------------------------------------------------------------------------------
  Inbound      DRAFT                              Start scan/enter data                             SCANNING                       0                        DRAFT/SCANNING được CANCEL nếu chưa có post.

  Inbound      SCANNING hoặc PARTIALLY_POSTED     Post Receipt subset hợp lệ                        PARTIALLY_POSTED hoặc POSTED   +N                       PARTIALLY_POSTED không Cancel; dùng Close remainder.

  Inbound      PARTIALLY_POSTED                   Close remainder + reason                          CLOSED                         0                        CLOSED terminal; không reopen.

  Inbound      POSTED                             Finalize/lock document                            CLOSED                         0                        Sửa sai sau post bằng Reversal/Correction.

  Outbound     DRAFT                              Start pick/scan                                   SCANNING                       0                        DRAFT/SCANNING được CANCEL nếu chưa có post.

  Outbound     SCANNING hoặc PARTIALLY_POSTED     Post Issue subset; đủ tồn tại commit              PARTIALLY_POSTED hoặc POSTED   -N                       PARTIALLY_POSTED không Cancel; dùng Close remainder.

  Outbound     PARTIALLY_POSTED/POSTED            Close/finalize                                    CLOSED                         0                        CLOSED terminal; hàng quay lại dùng Reverse Issue.

  Item         NEW                                Post Receipt                                      IN_STOCK                       +1                       Không edit state thủ công.

  Item         IN_STOCK                           Post Issue                                        ISSUED                         -1                       Không chuyển trực tiếp sang RETURNED_TO_CUSTOMER.

  Item         ISSUED hoặc RETURNED_TO_CUSTOMER   Warranty Receive; không có active case            IN_WARRANTY                    0                        Một item tối đa một active warranty case.

  Item         IN_WARRANTY                        Return to customer sau COMPLETED                  RETURNED_TO_CUSTOMER           0                        Mở chu kỳ mới bằng Warranty Case mới, không reopen case cũ.

  Item         ISSUED                             Reverse Issue; hàng đã về và SELLABLE             IN_STOCK                       +1                       Nếu non-sellable, condition/status riêng và không cộng Available.

  Item         IN_STOCK                           Reverse Receipt; không có downstream dependency   NEW                            -1                       Movement gốc giữ nguyên; tạo reversal append-only.

  Item         IN_STOCK                           Approved stocktake adjustment                     LOST hoặc ADJUSTED_OUT         -1                       Không dùng update state trực tiếp để che lỗi chứng từ.

  Stocktake    DRAFT                              Start count                                       COUNTING                       0                        Có thể CANCEL trước Apply; reason bắt buộc nếu đã Count.

  Stocktake    COUNTING                           Submit count / calculate variance                 REVIEWING                      0                        Reopen review chỉ bằng refresh/recount trước Apply, không đổi state terminal.

  Stocktake    REVIEWING                          Apply all approved lines; version hiện hành       APPLIED                        ±N                       APPLIED terminal; lỗi sau đó xử lý bằng session/correction mới.

  Warranty     RECEIVED                           Begin checking                                    CHECKING                       0                        CANCELLED cần reason và evidence trả máy nếu đang giữ vật lý.

  Warranty     CHECKING                           Begin repair                                      REPAIRING                      0                        Không skip trực tiếp sang RETURNED.

  Warranty     REPAIRING                          Complete processing                               COMPLETED                      0                        COMPLETED chưa phải đã trả máy.

  Warranty     COMPLETED                          Handoff machine to customer                       RETURNED                       0                        RETURNED/CANCELLED terminal; case mới phải link case cũ nếu cần.

  Putaway      DRAFT                              Confirm valid Box–Tray mapping                    CONFIRMED                      0                        DRAFT có thể CANCEL; CONFIRMED terminal, sửa bằng task correction mới.

  Reversal     DRAFT                              Confirm business scope/evidence                   CONFIRMED                      0                        DRAFT/CONFIRMED có thể CANCEL trước Post.

  Reversal     CONFIRMED                          Post reversal; guard dependency/reversible qty    POSTED                         ±N ngược giao dịch gốc   POSTED terminal; sửa tiếp bằng correction_chain mới.
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 6.3. Business Idempotency, Concurrency và Technical Handoff Boundary

-   BPD-CTRL-IDEMP-001: Post Receipt, Post Issue, Apply Adjustment và Post Reversal phải có khóa yêu cầu nghiệp vụ duy nhất để cùng một intent chỉ tạo stock effect một lần.

-   Cùng business request key + cùng operation/payload: trả lại kết quả nghiệp vụ đã ghi nhận; không tạo movement hoặc cập nhật tồn lần hai.

-   Cùng business request key nhưng nội dung khác: chặn do xung đột request identity; không đổi tồn. Mã lỗi/HTTP response được quy định trong SRS/OpenAPI.

-   BPD-CTRL-CONC-001: Post Issue kiểm tra remaining_qty/available_qty tại thời điểm commit và dùng cơ chế khóa/phiên bản kỹ thuật để chỉ một giao dịch cạnh tranh thành công.

-   BPD-CTRL-STALE-001: Apply Stocktake chỉ được thực hiện trên bản review/session hiện hành; bản stale phải refresh/review lại trước khi đổi tồn. Header, status code và API convention thuộc SRS/Technical Handoff.

Nguyên tắc ranh giới: BPD là nguồn normative cho actor, guard, state, stock effect và evidence. SRS/FRD v1.4 ([[WWHN-334 comment 12637]{.underline}](https://tan0110.atlassian.net/browse/WWHN-334?focusedCommentId=12637)), [[WWHN-31]{.underline}](https://tan0110.atlassian.net/browse/WWHN-31) và [[WWHN-40]{.underline}](https://tan0110.atlassian.net/browse/WWHN-40) là nguồn normative cho endpoint, header, HTTP status, error body, locking implementation và permission contract.

  -------------------------------------------------------------------------------------------------------------------------------------------------------
  **Business control ID**   **BPD requirement**                                                       **Technical reference**
  ------------------------- ------------------------------------------------------------------------- ---------------------------------------------------
  **BPD-CTRL-IDEMP-001**    Duplicate/retry không được tạo stock effect lần hai.                      SRS REQ-SRS-008/012/015/013; OpenAPI/WWHN-31

  **BPD-CTRL-CONC-001**     Concurrent issue/reversal chỉ một transaction thành công; không âm kho.   SRS BR-CONC; ERD/transaction design WWHN-31

  **BPD-CTRL-STALE-001**    Stale stocktake review bị chặn trước Apply.                               SRS REQ-SRS-015; OpenAPI concurrency contract

  **BPD-CTRL-PERM-001**     Ngoài quyền/scope bị từ chối; backend enforce.                            SRS REQ-SRS-026; permission mapping WWHN-40

  **BPD-CTRL-ERROR-001**    Mỗi business exception có reason rõ và stock effect = 0.                  SRS error catalog/OpenAPI; QA Test Design WWHN-33
  -------------------------------------------------------------------------------------------------------------------------------------------------------

## 6.4. Audit và evidence

  ----------------------------------------------------------------------------------------------------------------------------------------------
  **Nhóm action**                  **Audit tối thiểu**
  -------------------------------- -------------------------------------------------------------------------------------------------------------
  Post/Close/Reversal/Adjustment   actor, time, request_id, document/source, reason nếu có, idempotency_key, before/after state, movement IDs.

  Scan                             scan_batch_id, code_value, code_type, scan_source, result, duplicate/unknown flag.

  Master/Permission/Publish        actor, field changed, old/new value, effective time.

  Warranty                         case/event, actor, status, notes, item/temp code, customer contact access controlled.

  Migration/UAT                    file checksum/version, dry-run result, error file, commit batch, reconciliation, evidence link, sign-off.
  ----------------------------------------------------------------------------------------------------------------------------------------------

## 6.5. Warranty Privacy Process – SĐT, Ảnh và Dữ liệu Nhận diện

Privacy baseline áp dụng cho Warranty_Case có mã và TEMP_ONLY. Mục tiêu là dùng tối thiểu dữ liệu cần thiết để tiếp nhận, liên hệ, đối chiếu và trả máy; không công khai dữ liệu khách trên App PV hoặc báo cáo rộng.

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bước/Control**    **Actor/Role**                                            **Business rule**                                                                                                                                         **Evidence / Data state**
  ------------------- --------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------- -----------------------------------------------
  Collect & consent   NV bảo hành                                               Thông báo mục đích dùng SĐT/ảnh; ghi consent_status, consent_at, consent_channel. Ảnh là optional trừ khi cần evidence và khách đồng ý/quy định hợp lệ.   Warranty receipt; consent record; image_count

  Full view           NV bảo hành; QL kho/Admin có warranty.manage + pii.view   Chỉ xem full SĐT/ảnh khi xử lý case hoặc kiểm soát; mọi view/export nhạy cảm được audit.                                                                  pii_access_log: actor, case, purpose, time

  Masking             NV kho/Lãnh đạo/report viewer                             Danh sách và báo cáo hiển thị SĐT dạng 09\*\*\*\*\*\*67; ảnh chỉ thumbnail/ẩn nếu không có quyền.                                                         masked_phone; image_access_denied flag

  Search              NV bảo hành/QL kho theo quyền                             Cho phép tìm bằng SĐT nhưng kết quả chỉ trong warranty scope; không dùng PII để gợi ý App PV.                                                             search audit; scoped result

  Export              Role có warranty.pii.export                               Export phải có purpose/reason, filter/scope và audit; không đưa raw PII vào application log. Cơ chế encryption/TTL file thuộc Tech Handoff.               export_id, requester, reason, record count

  Retention           Data Owner + Admin                                        Giữ dữ liệu Warranty PII tối đa 5 năm sau khi case đóng, trừ legal hold hoặc nghĩa vụ pháp lý được phê duyệt.                                             closed_at, retention_until, legal_hold_flag

  Purge/Anonymize     Admin job + Data Owner review                             Sau retention: anonymize/purge SĐT/ảnh và dữ liệu nhận diện; giữ aggregate defect/SKU/status không định danh cho báo cáo.                                 purge_batch_id, affected cases, approval

  Customer request    NV bảo hành/QL kho                                        Yêu cầu xem/xuất/chỉnh sửa/xóa được ghi ticket và xử lý theo policy/pháp luật; không xóa movement/audit bắt buộc.                                         privacy_request_id, decision, evidence
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

-   Degraded/privacy exception: nếu không có quyền xem full PII, người dùng vẫn xem được case code, status, SKU/model/defect và dữ liệu đã masking đủ để vận hành theo vai trò; không cấp quyền tạm bằng cách copy/export ngoài hệ thống.

# 7. INPUT/OUTPUT, BIỂU MẪU VÀ CHỈ SỐ QUY TRÌNH

## 7.1. Business document/input-output matrix

  ------------------------------------------------------------------------------------------------------------------------------------------
  **Quy trình**   **Đầu vào nghiệp vụ**                               **Đầu ra/evidence**
  --------------- --------------------------------------------------- ----------------------------------------------------------------------
  Danh mục/SKU    Product master, legacy codes, Agency list           SKU/alias, Physical_Code, Agency, publish profile.

  Nhập kho        Nguồn nhập, expected lines, scan/quantity           Inbound document, posting events, RECEIPT_POSTED, balance/subledger.

  Xuất kho        Receiver/Agency, planned lines, scan/quantity       Outbound document, ISSUE_POSTED, item/box state, receiver trace.

  Putaway         Tray + box/item mapping                             Putaway task/event, location hint.

  Kiểm kê         Scope, snapshot, counts, movement list              Variance lines, approval/waive, ADJUST movements, session evidence.

  Bảo hành        Customer, phone, item/temp identification, defect   Warranty case/events, returned evidence.

  Reversal        Original ref, reason, quantity/condition            Reversal doc, reverse movement, reconciliation.

  App PV          Published profile, balance read model               List/detail/search/filter/recommendation + available_qty.

  Migration       Excel/check count, mapping, checksum                Dry-run/error file, committed batch, reconciliation/sign-off.
  ------------------------------------------------------------------------------------------------------------------------------------------

## 7.2. Bộ Mẫu Nghiệp vụ TO-BE Đề xuất

*Các mẫu dưới đây là form TO-BE do BA đề xuất để DEV/FE/QA dùng làm field/evidence baseline. Chúng không được trình bày như biểu mẫu AS-IS thật của Hoa Nam; khi có mẫu/file thật, Data Owner xác nhận mapping và supersession trên Jira.*

  ----------------------------------------------------------------------------------------------------------------------------------------------------------
  **Form ID**      **Tên mẫu**                **Process**    **Owner sử dụng**             **Evidence chính**
  ---------------- -------------------------- -------------- ----------------------------- -----------------------------------------------------------------
  **FM-IN-001**    Phiếu nhập kho             BP-WMS-02/03   NV kho / QL kho               Expected/received lines, scan batch, posting event

  **FM-OUT-001**   Phiếu xuất kho             BP-WMS-04/05   NV kho / QL kho               Receiver, planned/issued, handoff, posting event

  **FM-STK-001**   Stocktake Sheet            BP-WMS-07      NV kho / QL kho               Snapshot, cutoff, actual, movement, variance, approve/waive

  **FM-WAR-001**   Phiếu tiếp nhận bảo hành   BP-WMS-08/09   NV bảo hành                   Item/temp code, PII/consent, defect, accessories/photo, handoff

  **FM-REV-001**   Reversal Request           BP-WMS-10      QL kho/Admin                  Original ref, reason, reversible qty, condition, approval

  **FM-MIG-001**   Migration Template         BP-WMS-13      Chị Phương / BA / Tech / QA   File version, checksum, dry-run, error, reconcile, sign-off
  ----------------------------------------------------------------------------------------------------------------------------------------------------------

## 7.2.1. FM-IN-001 – Phiếu Nhập Kho (sample)

  ---------------------------------------------------------------------------------------------------------------------------------------------------------
  **Nhóm field**          **Giá trị/field mẫu TO-BE**                                                         **Rule/evidence**
  ----------------------- ----------------------------------------------------------------------------------- ---------------------------------------------
  **Header**              inbound_no=IN-20260723-001; source=Nhà cung cấp TQ; warehouse=WH-HN; status=DRAFT   Document code unique; DRAFT stock effect 0

  **Line 1**              SKU=DCH-DRILL-DJZ10A-220V-V1; expected=10; received subset=8                        Không over-receipt; remaining=2

  **Physical scan**       carton=CTN-0001; item=ITEM-RFID-000001..008; scan_source=DEMO/REAL/MANUAL           Mã lạ/trùng bị tách error list

  **Posting evidence**    business_request_key; actor; posted_at; movement_ids; before/after state            Retry cùng intent không double stock

  **Close remainder**     close_reason; cancelled_remainder_qty=2                                             Chỉ QL kho/Admin theo quyền; stock effect 0
  ---------------------------------------------------------------------------------------------------------------------------------------------------------

## 7.2.2. FM-OUT-001 – Phiếu Xuất Kho (sample)

  -------------------------------------------------------------------------------------------------------------------------------------
  **Nhóm field**          **Giá trị/field mẫu TO-BE**                                       **Rule/evidence**
  ----------------------- ----------------------------------------------------------------- -------------------------------------------
  **Header**              outbound_no=OUT-20260723-001; agency=AG-HN-001; warehouse=WH-HN   Agency là nơi nhận, không phải kho

  **Line**                SKU-A; planned=2; issued=2; item codes A/B                        Kiểm tra IN_STOCK và available tại commit

  **Physical handoff**    handoff_area=DISPATCH; handed_by; received_by; handoff_at         Evidence bàn giao vật lý

  **Posting evidence**    ISSUE_POSTED movement; item → ISSUED; balance before/after        Không tạo balance/movement tại agency
  -------------------------------------------------------------------------------------------------------------------------------------

## 7.2.3. FM-STK-001 – Stocktake Sheet (sample)

  -------------------------------------------------------------------------------------------------------------------------------
  **Field**               **Giá trị mẫu**                                                 **Rule/evidence**
  ----------------------- --------------------------------------------------------------- ---------------------------------------
  **Session**             STK-20260723-001; scope=SKU-A; started_at=08:00; version=3      Snapshot tạo cùng session

  **Count line**          snapshot=100; movement_to_cutoff=-10; actual=90; cutoff=10:30   expected=90; variance=0

  **Review**              movement_warning_ack=true; reviewer=QL kho                      Stale review phải refresh

  **Decision**            line_status=WAIVED/APPROVED/APPLIED; reason                     Chỉ APPROVED được Apply

  **Adjustment**          movement_id nếu variance khác 0; request key; applied_at        Atomic; retry không double adjustment
  -------------------------------------------------------------------------------------------------------------------------------

## 7.2.4. FM-WAR-001 – Phiếu Tiếp nhận Bảo hành (sample)

  ----------------------------------------------------------------------------------------------------------------------------------------------
  **Field**               **Giá trị mẫu/an toàn**                                                   **Rule/evidence**
  ----------------------- ------------------------------------------------------------------------- --------------------------------------------
  **Case**                WAR-20260723-001; identification=ITEM hoặc TEMP_ONLY                      TEMP_ONLY không link item gốc

  **Customer**            name=Nguyễn Văn A (minh họa); phone display=09\*\*\*\*\*\*67              Full value chỉ role pii.view

  **Consent**             consent_status=GRANTED; channel=FORM; consent_at                          Ghi purpose cho contact/photo

  **Machine**             item_code hoặc temporary_item_code; SKU/model; description; accessories   missing_code_reason bắt buộc với TEMP_ONLY

  **Defect/Photo**        reported_defect; image_count; initial_condition                           Ảnh theo consent/quyền

  **Handoff**             received_by/at; returned_by/to/at; signature/evidence                     RETURNED chỉ sau COMPLETED
  ----------------------------------------------------------------------------------------------------------------------------------------------

## 7.2.5. FM-REV-001 – Reversal Request (sample)

  ----------------------------------------------------------------------------------------------------------------------------
  **Field**               **Giá trị mẫu**                                                   **Rule/evidence**
  ----------------------- ----------------------------------------------------------------- ----------------------------------
  **Request**             REV-20260723-001; type=ISSUE_REVERSAL; original_movement=MV-001   Append-only; giữ original

  **Scope**               qty=1; reversible_qty_before=1; item=ITEM-B                       Không vượt reversible qty

  **Reason**              reason_code=WRONG_ISSUE; reason_text; evidence link               Reason bắt buộc

  **Physical return**     returned_to_warehouse=true; condition=SELLABLE                    Chỉ SELLABLE cộng Available

  **Approval/Post**       created_by; confirmed_by; business_request_key; posted_at         Dependency guard + atomic commit
  ----------------------------------------------------------------------------------------------------------------------------

## 7.2.6. FM-MIG-001 – Migration Template (sample)

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Dataset/field**       **Dòng mẫu TO-BE**                                                               **Validation**
  ----------------------- -------------------------------------------------------------------------------- ------------------------------------------------------------------------
  **File control**        file=HN_OPENING_v0.1.xlsx; owner=Chị Phương; checksum=\<generated on receipt\>   Actual file managed at WWHN-69; SHA-256 required before dry-run/commit

  **SKU**                 DCH-DRILL-DJZ10A-220V-V1 \| Máy khoan \| PRODUCT \| ACTIVE                       sku_code unique; required refs active

  **Alias**               EXCEL_OLD \| MAYKHOAN-01 → DCH-DRILL-DJZ10A-220V-V1                              source+legacy key unique

  **Physical item**       ITEM-RFID-000001 \| RFID \| SKU \| NORMAL                                        code/item unique; ITEM carrier chip

  **Opening**             WH-HN \| SKU \| NORMAL \| qty=100 \| as_of_date                                  qty integer ≥0; quantity reconcile 100%

  **Dry-run result**      valid_count; invalid_count; duplicate_count; error_file                          Critical error=0; total pass ≥99,5%
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 7.3. KPI Baseline – Acceptance Target và Pilot Monitoring

Phân loại target: ACCEPTANCE TARGET là điều kiện bắt buộc tại đúng gate được nêu; PILOT MONITORING chỉ đo sau pilot để tinh chỉnh vận hành và không chặn BPD Done; MIXED CONTROL có cả tiêu chí acceptance an toàn/dữ liệu và ngưỡng theo dõi sau pilot. Các target acceptance có hiệu lực khi WWHN-335 DONE; KPI pilot được baseline sau pilot đầu tiên với Process Owner/PM/PO.

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **KPI**                              **Formula**                                                                                      **Owner**                                **Source/Frequency**                                         **Target**                                                                                                                                      **Action khi fail**
  ------------------------------------ ------------------------------------------------------------------------------------------------ ---------------------------------------- ------------------------------------------------------------ ----------------------------------------------------------------------------------------------------------------------------------------------- --------------------------------------------------------------------
  Inventory reconciliation pass rate   matched reconciliation scope / total scope ×100%                                                 Chị Phương + QL kho; Tech vận hành job   Reconciliation report; sau posting batch, daily và cutover   \[MIXED CONTROL\] Acceptance: reconciliation migration/cutover = 100%, mọi mismatch có incident. Pilot/operation monitoring: ≥99,9% vận hành.   Block sign-off liên quan; điều tra và reversal/adjustment có audit

  Stocktake cycle time                 applied_at − stocktake_started_at                                                                Chị Phương / QL kho                      Session timestamps; mỗi session/pilot                        \[PILOT MONITORING\] Giảm ≥50% so với AS-IS sau pilot; phút/giờ tuyệt đối được chốt sau pilot đầu tiên. Không dùng để chặn BPD Done.            Phân tích wait time, scan coverage, recount và movement warning

  Unknown scan rate                    UNKNOWN scan events / total scan events ×100%                                                    QL kho                                   Scan_Event; daily/weekly                                     \[MIXED CONTROL\] Acceptance: 0 UNKNOWN được phép Post. Pilot monitoring: unknown scan rate ≤1% sau data cleansing.                             Cleansing code/master; retrain thao tác; chặn Post

  Posting error rate                   Failed posting intents / total posting intents ×100%                                             Tech Lead + QL kho                       Posting/Audit log; daily/release                             \[MIXED CONTROL\] Acceptance: 0 negative stock và 0 duplicate movement. Pilot/operation monitoring: failed posting rate \<0,5%.                 Incident + root cause; rollback transaction; regression test

  Migration pass rate                  valid total / total ×100%; critical valid / critical total; quantity matched / source quantity   Chị Phương + BA + QA                     Migration_Batch dry-run/commit; mỗi file version             \[ACCEPTANCE TARGET\] 100% critical; ≥99,5% total; quantity reconciliation 100% trước Migration Commit/Beta/Go-live.                            No-Go; sửa file/version mới; checksum + dry-run lại

  PV freshness compliance              Responses có now−last_inventory_sync_at ≤60s / total sampled responses ×100%                     Tech Lead / App PV owner                 Sync metrics; continuous/daily                               \[ACCEPTANCE TARGET\] Normal freshness ≤60 giây; bắt buộc hiển thị stale warning khi \>5 phút; có last_inventory_sync_at.                       Hiển thị degraded warning; incident sync; không công bố realtime

  Duplicate posting prevented          Repeated same-intent requests trả replay / total repeated requests ×100%                         Tech Lead/QA                             Idempotency audit; contract test/release                     \[ACCEPTANCE TARGET\] 100% repeated same-intent request không tạo stock effect lần hai.                                                         Block release; kiểm tra request identity/transaction boundary
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 8. TRACEABILITY VÀ GATE

## 8.1. Staged End-to-End Traceability Master

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **BP**         **Contract/Input/Decision**        **REQ/BR/AC/TC**                        **Story/Screen/API/Data artifact**                             **Owner / Status**              **Evidence gate**
  -------------- ---------------------------------- --------------------------------------- -------------------------------------------------------------- ------------------------------- -----------------------------------------------
  BP-WMS-01      CTR-BPD-001; SRC-001; DR-CARRIER   REQ 002–005,020,026–029; TC tương ứng   Master/Code screens; WWHN-31 ERD/OpenAPI; WWHN-40 permission   BA complete; Tech planned       WWHN-335 baseline; DEV/QA evidence downstream

  BP-WMS-02      CTR-BPD-002; DEC-PARTIAL/INV       REQ 006–008; BR-IN/PARTIAL/IDEMP/TXN    Inbound screens/API/data; WWHN-31/40                           BA complete; Tech/QA pending    TC design WWHN-33; actual result downstream

  BP-WMS-03      SRC/DEC-LOC/INV                    REQ 007–009; BR-COMP/PTW                Component receipt/putaway UI/API/data                          BA complete                     WWHN-31/33

  BP-WMS-04      CTR; DEC-PARTIAL/INV               REQ 010–013; BR-OUT/CONC/REV            Outbound UI/API/data; permission                               BA complete                     WWHN-31/33/40

  BP-WMS-05      CTR; DEC-INV                       REQ 010–012,023; BR-COMP/OUT            Component issue/box quantity artifacts                         BA complete                     WWHN-31/33

  BP-WMS-06      DEC-INV                            REQ 023,030–032; BR-RECON/RPT           Inventory query/reconcile/report API/data                      BA complete                     WWHN-31/33

  BP-WMS-07      SRC; DEC-INV                       REQ 014–015; BR-COUNT; TC-STK           Stocktake screens/API/snapshot/data                            BA complete                     WWHN-31/33/40

  BP-WMS-08/09   CTR; DR-PRIV                       REQ 016; BR-WAR/PRIV; TC-WAR            Warranty/TEMP_ONLY UI/API/data                                 BA complete                     WWHN-31/33/40

  BP-WMS-10      DEC-INV; P0-07                     REQ 013; BR-REV-01..12; TC-REV          Reversal UI/API/data/report net                                BA complete                     WWHN-31/33/40

  BP-WMS-11      CTR-BPD-003; DR-PLAT               REQ 017–020,033; BR-PV; TC-PV           PV screens/read API/cache/last sync                            BA complete                     WWHN-31 + FE/QA gate

  BP-WMS-12      CTR; DEC-INV                       REQ 031–032; BR-RPT/EXP                 Report screens/API/export                                      BA complete                     WWHN-31/33/40

  BP-WMS-13      CTR-BPD-004; MIG waiver            REQ 021–022; BR-MIG/UAT; TC-MIG         Template + WWHN-69 migration + WWHN-75 UAT                     BPD closed; execution pending   Hard gate Migration/Beta/Go-live
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

*Governance trace: WWHN-333/335 comments → P0/P1 Closure Matrix → BPD v1.3 → WWHN-333 DONE trước hoặc đồng thời với WWHN-335 DONE; transition WWHN-335 là formal approval evidence và xác lập effective date.*

## 8.2. Gate sử dụng tài liệu

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Gate**                           Hiện trạng BPD v1.3                 **Điều kiện đạt**
  ---------------------------------- ----------------------------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Formal Review                      READY – FINAL APPROVAL CANDIDATE    Attach v1.3 vào WWHN-335; v1.0/v1.1/v1.2 SUPERSEDED.

  BPD Task Done / Process Baseline   READY ON GOVERNANCE CONDITION       WWHN-333 DONE trước hoặc đồng thời; PM/PO chuyển WWHN-335 DONE. Effective date = ngày WWHN-335 DONE.

  Ready for Dev                      PROCESS READY / OVERALL NOT READY   BE API/ERD/Data Dictionary: [[WWHN-31]{.underline}](https://tan0110.atlassian.net/browse/WWHN-31); Permission mapping/enforcement: [[WWHN-40]{.underline}](https://tan0110.atlassian.net/browse/WWHN-40); QA TestCase Master + Test Data: [[WWHN-33]{.underline}](https://tan0110.atlassian.net/browse/WWHN-33); FE Screen/Wireframe/Figma: PLANNED / JIRA NOT CREATED. Field/screen baseline hiện tham chiếu SRS/FRD v1.4.

  Ready for QA/UAT                   NOT READY – DOWNSTREAM              TestCase Master + Test Data và execution plan tại [[WWHN-33]{.underline}](https://tan0110.atlassian.net/browse/WWHN-33); UAT/evidence tại [[WWHN-75]{.underline}](https://tan0110.atlassian.net/browse/WWHN-75); cần environment và downstream implementation đã sẵn sàng.

  Ready for Beta                     NOT READY – RELEASE GATE            Actual migration file/dry-run/reconcile tại [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69); QA/UAT result/waiver tại [[WWHN-33]{.underline}](https://tan0110.atlassian.net/browse/WWHN-33) / [[WWHN-75]{.underline}](https://tan0110.atlassian.net/browse/WWHN-75); monitoring và rollback rehearsal.

  Go-live                            NOT READY                           Migration reconciliation pass, UAT pass/waiver, Go/No-Go, backup/rollback và sign-off.
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 9. DOWNSTREAM FOLLOW-UP VÀ WAIVER REGISTER

Các mục dưới đây không còn là P0 blocker của BPD khi cơ chế approval được thực hiện. Chúng được quản lý như downstream gate hoặc Change Request và không được dùng để tuyên bố Ready for Dev/QA/Beta/Go-live khi chưa hoàn tất.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Ưu tiên**             **Thông tin/Follow-up**                                                                                                                                                                                                       **Mục đích**
  ----------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -------------------------------------------------------------------------------------------
  CLOSED P0               AS-IS limited discovery: khảo sát 30/06/2026; summary + [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646).                                                         Đóng P0-03; không yêu cầu ảnh/layout/time study/form riêng.

  CLOSED P0               Chị Phương là Accountable duy nhất; executor theo role; Backup NOT DESIGNATED.                                                                                                                                                Đóng RACI/Process Owner.

  WAIVED P1-10            Migration execution: [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69); waiver evidence: [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646).    Không chặn BPD Done; hard gate Migration Commit/Beta/Go-live. BPD Done ≠ migration ready.

  DOWNSTREAM FE           Screen/Wireframe/Figma: PLANNED / JIRA NOT CREATED. Current field/screen baseline tham chiếu SRS/FRD v1.4 tại [[WWHN-334 comment 12637]{.underline}](https://tan0110.atlassian.net/browse/WWHN-334?focusedCommentId=12637).   Phải tạo/approve hoặc có waiver trước FE detailed implementation; không chặn BPD Done.

  DOWNSTREAM BE           Architecture, physical ERD, Data Dictionary và Tech-approved OpenAPI/API: [[WWHN-31]{.underline}](https://tan0110.atlassian.net/browse/WWHN-31).                                                                              BE implementation và contract-test gate.

  DOWNSTREAM SEC          Endpoint Permission Mapping / backend enforcement: [[WWHN-40]{.underline}](https://tan0110.atlassian.net/browse/WWHN-40).                                                                                                     Security/permission implementation gate.

  DOWNSTREAM QA           TestCase Master, Test Design và Test Data dùng chung tại [[WWHN-33]{.underline}](https://tan0110.atlassian.net/browse/WWHN-33).                                                                                               QA execution/readiness gate; actual evidence downstream.

  P2                      Thiết bị scan thật, điểm đọc, batch/latency target.                                                                                                                                                                           Hardware readiness/performance test.

  DOWNSTREAM              Code prefix/tem/chip và cách cấp mã thực tế.                                                                                                                                                                                  WWHN-31/UX/operating instruction.

  CLOSED P0               Reverse Issue SELLABLE/NON_SELLABLE, pending return và dependency chain tại §5.10.                                                                                                                                            Implementation/test tại WWHN-31/33.

  CLOSED P1               App PV cache ≤60s; stale warning \>5m; last_inventory_sync_at.                                                                                                                                                                Monitoring implementation downstream.

  P2/CR                   SLA bảo hành, người sửa, chi phí/linh kiện thay thế.                                                                                                                                                                          Change Request/Phase 2.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 10. PHỤ LỤC THUẬT NGỮ

  ---------------------------------------------------------------------------------------------------------------------------------------------------------
  **Thuật ngữ**                     **Định nghĩa**
  --------------------------------- -----------------------------------------------------------------------------------------------------------------------
  SKU                               Mã loại hàng dùng quản lý tồn; PRODUCT hoặc COMPONENT.

  Item/Serial                       Một máy hoặc linh kiện cụ thể có mã riêng.

  Physical_Code                     Mã nghiệp vụ duy nhất dùng scan/tra cứu; carrier có thể QR/Barcode/RFID/NFC/Manual; ITEM bắt buộc chip.

  Carton                            Thùng chứa nhiều sản phẩm cùng SKU; container, không phải tồn độc lập.

  Box                               Hộp linh kiện một SKU; chứa serial hoặc quantity.

  Tray                              Locator chứa nhiều box; không xuất và không có quantity độc lập.

  Inventory_Movement                Ledger append-only, nguồn thẩm quyền của biến động tồn.

  Inventory_Balance                 Projection tồn hiện tại để đọc nhanh, cập nhật cùng transaction với ledger.

  Partial Receipt/Issue             Post nhiều lần trên cùng chứng từ đến đủ hoặc close remainder.

  khóa yêu cầu nghiệp vụ duy nhất   Khóa chống xử lý lặp cho action đổi tồn.

  Stocktake Snapshot                Ảnh chụp tồn tại stocktake_started_at dùng làm baseline kiểm kê.

  TEMP_ONLY                         Case bảo hành không có định danh gốc; quản lý bằng temporary_item_code và NOT_TRACEABLE.

  Reversal                          Chứng từ đảo append-only tham chiếu movement gốc.

  App PV                            Web App responsive read-only hiển thị sản phẩm published và available_qty kho tổng.

  zone_code                         Nhãn khu vực phẳng, optional, không có hierarchy và không tạo stock bucket.

  location_hint                     Gợi ý vị trí tương đối nullable để tìm/handoff; không phải địa chỉ tồn hoặc khóa balance.

  last_inventory_sync_at            Thời điểm PV cache/read model đồng bộ tồn gần nhất; dùng đánh giá freshness và degraded warning.

  Data Owner                        Người chịu trách nhiệm source of truth/chất lượng dữ liệu; dự án chốt Chị Phương – Quản lý kho Hoa Nam cho migration.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------

# 11. KẾT LUẬN

+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| KẾT LUẬN PHÁT HÀNH v1.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| • BPD v1.3 là FINAL APPROVAL CANDIDATE và đã đóng P0/P1 process-content ở cấp tài liệu.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| • AS-IS discovery được xác nhận bằng khảo sát trực tiếp ngày 30/06/2026, “Tóm tắt yêu cầu đối tác.docx” và WWHN-335 comment 12646; không yêu cầu bộ ảnh/layout/time study/mẫu phiếu riêng cho BPD task.                                                                                                                                                                                                                                                                                                                      |
|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| • Chị Phương là Accountable/Process Owner/Data Owner duy nhất; executor theo role/permission; Backup chưa chỉ định và phải được Hoa Nam ủy quyền khi cần.                                                                                                                                                                                                                                                                                                                                                                    |
|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| • BPD v1.3 thay thế v1.0/v1.1/v1.2 và trở thành APPROVED/BASELINE khi WWHN-335 DONE, sau hoặc đồng thời với WWHN-333 DONE. Effective date là ngày WWHN-335 transition DONE.                                                                                                                                                                                                                                                                                                                                                  |
|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| • P1-10 được waiver sang [[WWHN-69]{.underline}](https://tan0110.atlassian.net/browse/WWHN-69) theo [[WWHN-335 comment 12646]{.underline}](https://tan0110.atlassian.net/browse/WWHN-335?focusedCommentId=12646): actual Excel/checksum/dry-run/reconciliation không chặn BPD Done nhưng chặn Migration Commit/Beta/Go-live. BPD Done không đồng nghĩa migration ready.                                                                                                                                                      |
|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| • Ready for Dev/Beta không được suy ra chỉ từ BPD; BE API/ERD/Data Dictionary tại [[WWHN-31]{.underline}](https://tan0110.atlassian.net/browse/WWHN-31), permission tại [[WWHN-40]{.underline}](https://tan0110.atlassian.net/browse/WWHN-40), TestCase Master + Test Data tại [[WWHN-33]{.underline}](https://tan0110.atlassian.net/browse/WWHN-33), UAT tại [[WWHN-75]{.underline}](https://tan0110.atlassian.net/browse/WWHN-75) và FE Screen/Wireframe/Figma (PLANNED / JIRA NOT CREATED) tiếp tục theo downstream gate. |
+==============================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================+
+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
