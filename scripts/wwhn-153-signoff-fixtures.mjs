// Fixture PENDING-state cho self-test của wwhn-153-signoff-core.
//
// Nguồn: ba tệp docs/evidence/wwhn-153/*.json tại 3822d45^ (git show), chép
// nguyên trạng. Kho docs/evidence đã gỡ khỏi repo theo 3822d45 nên self-test
// không đọc đĩa nữa — dữ liệu mẫu sống ở đây. Đây là INPUT kiểm thử cho
// evaluateWwhn153Signoff, không phải bằng chứng nghiệm thu.

export const PENDING_SIGNOFF_MANIFEST = {
  "schemaVersion": "4.0.0",
  "task": "WWHN-153",
  "assessmentDate": "2026-08-06",
  "requiredIssueKeys": [
    "WWHN-31",
    "WWHN-151",
    "WWHN-152",
    "WWHN-180",
    "WWHN-182",
    "WWHN-183"
  ],
  "findings": [
    {
      "id": "FE-P0-01",
      "severity": "P0",
      "title": "Official contract source chưa khóa"
    },
    {
      "id": "FE-P0-02",
      "severity": "P0",
      "title": "Final FE sign-off fail-closed"
    },
    {
      "id": "FE-P1-01",
      "severity": "P1",
      "title": "WWHN-151/WWHN-152 exact-hash chain"
    },
    {
      "id": "FE-P1-02",
      "severity": "P1",
      "title": "QA2 direct runtime/API evidence"
    },
    {
      "id": "FE-P1-03",
      "severity": "P1",
      "title": "BA G1 minutes"
    },
    {
      "id": "FE-P1-04",
      "severity": "P1",
      "title": "Permission catalog approval"
    },
    {
      "id": "FE-P1-05",
      "severity": "P1",
      "title": "Authoritative FE source provenance"
    },
    {
      "id": "FE-P2-01",
      "severity": "P2",
      "title": "Evidence hygiene"
    },
    {
      "id": "FE-P2-02",
      "severity": "P2",
      "title": "Closure matrix theo HEAD mới"
    }
  ],
  "sourceProvenancePath": "docs/evidence/wwhn-153/WWHN-153_FE_SOURCE_PROVENANCE.json",
  "permissionApprovalPath": "docs/evidence/wwhn-153/WWHN-153_PERMISSION_APPROVAL.json",
  "officialContractRelease": {
    "issueKey": "WWHN-31",
    "status": "PENDING",
    "version": null,
    "backendCommitSha": null,
    "artifactPath": null,
    "artifactSha256": null,
    "changelogPath": null,
    "changelogSha256": null,
    "publisherAccounts": []
  },
  "moduleSchemaRelease": {
    "issueKey": "WWHN-151",
    "status": "PENDING",
    "version": null,
    "backendCommitSha": null,
    "artifactPath": null,
    "artifactSha256": null
  },
  "qa1Review": {
    "issueKey": "WWHN-152",
    "status": "PENDING",
    "reviewerAccount": null,
    "reviewedArtifacts": [],
    "dimensions": {
      "constraints": "PENDING",
      "errorContract": "PENDING",
      "testability": "PENDING"
    }
  },
  "independentConfirmation": {
    "issueKey": "WWHN-180",
    "status": "PENDING",
    "confirmerAccount": null,
    "artifactSha256": null
  },
  "qa2Runtime": {
    "issueKey": "WWHN-182",
    "status": "PENDING",
    "sourceSha": null,
    "buildId": null,
    "environment": null,
    "qa2Account": null,
    "artifactDigest": null,
    "sha256SumsPath": null,
    "sha256SumsSha256": null,
    "summaryPath": null,
    "scenarios": []
  },
  "baG1Minutes": {
    "issueKey": "WWHN-183",
    "status": "PENDING",
    "decision": null,
    "sourceSha": null,
    "artifactDigest": null,
    "openP0": null,
    "openP1": null,
    "minutesPath": null,
    "minutesSha256": null,
    "baAccount": null
  },
  "finalPolicy": {
    "mode": "DERIVED_FAIL_CLOSED",
    "requiredDecision": "GO",
    "rejectConditionalGo": true,
    "requireOpenP0": 0,
    "requireOpenP1": 0
  }
};

export const PENDING_PERMISSION_APPROVAL = {
  "schemaVersion": "3.0.0",
  "task": "WWHN-153",
  "issueKey": "WWHN-153",
  "status": "PENDING",
  "approverAccounts": [],
  "approverRoles": [],
  "runtimeLink": {
    "sourceSha": null,
    "buildId": null,
    "environment": null,
    "artifactDigest": null,
    "summaryPath": null,
    "sha256SumsPath": null
  },
  "runtimeCatalogSnapshot": {
    "path": null,
    "sha256": null,
    "requestId": null,
    "missingCanonicalCodes": []
  },
  "backendPermissionCatalog": {
    "path": null,
    "sha256": null,
    "version": null,
    "backendCommitSha": null
  },
  "endpointPermissionRoleMapping": [
    {
      "endpointAction": "POST /inbound-documents/:id/post-receipt",
      "permission": "inbound.post",
      "roles": [
        "ADMIN",
        "SUPER_ADMIN",
        "WAREHOUSE_APPROVER",
        "WAREHOUSE_KEEPER",
        "WAREHOUSE_MANAGER"
      ],
      "approved": false
    },
    {
      "endpointAction": "POST /outbound-documents/:id/post-issue",
      "permission": "outbound.post",
      "roles": [
        "ADMIN",
        "SUPER_ADMIN",
        "WAREHOUSE_APPROVER",
        "WAREHOUSE_KEEPER",
        "WAREHOUSE_MANAGER"
      ],
      "approved": false
    },
    {
      "endpointAction": "GET /reports/inventory-xnt/export-excel",
      "permission": "report.export",
      "roles": [
        "ADMIN",
        "SUPER_ADMIN",
        "WAREHOUSE_MANAGER"
      ],
      "approved": false
    },
    {
      "endpointAction": "POST /warranty-cases/:id/temp-only",
      "permission": "warranty.temp_only",
      "roles": [
        "SUPER_ADMIN",
        "WAREHOUSE_MANAGER"
      ],
      "approved": false
    },
    {
      "endpointAction": "POST /scan-batches/classify",
      "permission": "scan.execute|scan.classify",
      "roles": [
        "ADMIN",
        "SUPER_ADMIN",
        "WAREHOUSE_KEEPER",
        "WAREHOUSE_MANAGER",
        "WAREHOUSE_STAFF",
        "WARRANTY_STAFF"
      ],
      "approved": false
    }
  ],
  "sourceOfMapping": {
    "note": "roles/permission lấy nguyên văn từ endpoint_permission_role_matrix runtime (route:list + backend_enforced=true), không suy diễn.",
    "path": "docs/api-contract/HN-BE-API-003_ENDPOINT_PERMISSION_MATRIX.json",
    "field": "endpoint_permission_role_matrix",
    "beRepo": "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE"
  },
  "rules": [
    "Backend remains authorization authority; FE guard is defense-in-depth only.",
    "Runtime catalog response hash must equal PERMISSION_CATALOG response artifact hash in WWHN-182 package.",
    "BE/RBAC, BA and FE approvers must be three distinct accounts.",
    "REQ-SRS-037 (WWHN-230 Option B): không permission/route/entity stocktake.* nào được xuất hiện trong mapping hoặc trong runtime catalog; đây là bề mặt bị cấm hoàn toàn khỏi MVP, không phải quan hệ manage/adjust cần tách quyền."
  ]
};

export const PENDING_SOURCE_PROVENANCE = {
  "schemaVersion": "1.0.0",
  "task": "WWHN-153",
  "repository": "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  "branch": "m1",
  "resolutionStrategy": "CI_HEAD",
  "preRemediationHead": "e36750ae5a6163f6a8c0bfb6f5a0259c6c306829",
  "expectedParentSha": "e36750ae5a6163f6a8c0bfb6f5a0259c6c306829",
  "authoritativeSourceRules": {
    "sourceShaFrom": "GITHUB_SHA",
    "mustEqualExecutionSha": true,
    "mustEqualCheckedOutHead": true,
    "mustHaveExpectedParent": true,
    "mustRecordTreeSha": true,
    "mustRecordWorkflowRunUrl": true,
    "artifactNamePattern": "wwhn-153-signoff-integrity-<SOURCE_SHA>"
  },
  "supersededReferences": [
    {
      "ref": "f6e137d01ed7afec5d30e8fecde6a2cc31bb7c8b",
      "reason": "Baseline trước các thay đổi tiếp theo trên m1; không còn là HEAD authoritative."
    },
    {
      "ref": "eade7f...",
      "reason": "SHA rút gọn trong assessment cũ; bị superseded bởi pre-remediation HEAD đã xác minh qua GitHub API."
    }
  ],
  "closureRule": "Không hard-code SHA của chính commit vào nội dung commit. CI phải derive exact source/parent/tree/run/artifact từ checkout immutable."
};
