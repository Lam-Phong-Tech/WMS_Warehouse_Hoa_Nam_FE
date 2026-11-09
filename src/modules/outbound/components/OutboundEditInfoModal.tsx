import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Box,
  Grid,
  Stack,
  UiAddressField,
  UiAlert,
  UiAutocomplete,
  UiDrawer,
  UiFormField,
  UiTextField,
  UiVuexyDateField,
} from "@/shared/ui";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useT } from "@/shared/i18n/useT";
import { useMvpAgencies } from "@/modules/master-data/hooks/use-mvp-master";
import type { AgencyRecord } from "@/modules/master-data/types/mvp-master.types";
import {
  fetchOutboundDetail,
  updateOutboundDocument,
  type OutboundLineRecord,
} from "@/modules/outbound/services/alignedOutboundService";
import { DocumentAttachmentsPanel } from "@/shared/components/DocumentAttachmentsPanel";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { validatePhone } from "@/shared/constants/validation.constants";
import { checkDate, pastDateBounds } from "@/shared/validation/date-rules";

import "./outbound-dialog.css";

export interface OutboundEditInfoModalProps {
  documentId: string;
  canAttach: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface FieldErrors {
  recipientName?: string;
  recipientPhone?: string;
  requestDate?: string;
}

/**
 * Sửa header phiếu xuất DRAFT — cùng phạm vi với form sửa phiếu nhập: người
 * nhận/địa chỉ/SĐT/đại lý/ngày yêu cầu/ghi chú + chứng từ. Dòng SKU chỉ đọc vì
 * được chốt từ toa nguồn (SOURCE_REQUEST_IMMUTABLE).
 */
export function OutboundEditInfoModal({
  documentId,
  canAttach,
  onClose,
  onSaved,
}: OutboundEditInfoModalProps) {
  const t = useT();
  const lineColumns: ResponsiveTableColumn<OutboundLineRecord>[] = [
    {
      key: "sku",
      header: t("outbound.edit.colSku"),
      render: (row) => row.skuCode || row.productId,
    },
    {
      key: "name",
      header: t("outbound.edit.colName"),
      render: (row) => row.skuName || "-",
    },
    {
      key: "qty",
      header: t("outbound.edit.colQty"),
      width: 90,
      render: (row) => row.expected,
    },
  ];
  const dialog = useDialogExit(onClose);
  const detailQuery = useQuery({
    queryKey: ["mvp-outbound", "detail", documentId],
    queryFn: () => fetchOutboundDetail(documentId),
  });
  const detail = detailQuery.data;
  const doc = detail?.document;
  const initializedRef = useRef(false);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [note, setNote] = useState("");
  const [agencyKeyword, setAgencyKeyword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const defaultAgencyQuery = useMvpAgencies({
    status: "ACTIVE",
    per_page: 100,
  });
  const agencySearchQuery = useMvpAgencies({
    status: "ACTIVE",
    keyword: agencyKeyword.trim(),
    per_page: 50,
  });
  const agencyRows: AgencyRecord[] = [
    ...(defaultAgencyQuery.data?.data ?? []),
    ...(agencySearchQuery.data?.data ?? []),
  ];
  const agencyOptions = agencyRows.map((agency) => ({
    value: agency.agency_id,
    label: `${agency.agency_code} · ${agency.agency_name}`,
  }));
  if (
    agencyId &&
    !agencyOptions.some((option) => option.value === agencyId) &&
    doc
  ) {
    agencyOptions.unshift({
      value: agencyId,
      label:
        [doc.agencyCode, doc.agencyName].filter(Boolean).join(" · ") ||
        agencyId,
    });
  }

  useEffect(() => {
    if (initializedRef.current || !doc) return;
    initializedRef.current = true;
    setAgencyId(doc.agencyId ?? null);
    setRecipientName(doc.recipientName === "-" ? "" : doc.recipientName);
    setRecipientPhone(doc.recipientPhone ?? "");
    setRecipientAddress(
      doc.recipientAddress === "-" ? "" : doc.recipientAddress,
    );
    setRequestDate((doc.requestDate ?? doc.date ?? "").slice(0, 10));
    setNote(doc.note ?? "");
  }, [doc]);

  const parsedRequestDate = dayjs(requestDate);
  const requestDateValue =
    parsedRequestDate.isValid() &&
    parsedRequestDate.format("YYYY-MM-DD") === requestDate
      ? parsedRequestDate
      : null;

  const clearError = (field: keyof FieldErrors) =>
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );

  const validate = () => {
    const errors: FieldErrors = {};
    if (!recipientName.trim()) {
      errors.recipientName = t("outbound.edit.errRecipient");
    }
    if (recipientPhone) {
      const phone = validatePhone(recipientPhone);
      if (!phone.isValid) {
        errors.recipientPhone =
          phone.errorMessage ?? t("outbound.edit.errPhone");
      }
    }
    if (!requestDate) {
      errors.requestDate = t("outbound.edit.errRequestDate");
    } else {
      const dateCheck = checkDate(requestDate, pastDateBounds());
      if (!dateCheck.ok) {
        errors.requestDate = dateCheck.message;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!doc) throw new Error(t("outbound.edit.saveError"));
      return updateOutboundDocument(
        documentId,
        {
          recipient_name: recipientName.trim(),
          recipient_address: recipientAddress.trim() || null,
          recipient_contact_phone: recipientPhone.trim() || null,
          agency_id: agencyId,
          request_date: requestDate,
          note: note.trim() || null,
        },
        doc.version,
      );
    },
    onSuccess: () => {
      toast.success(t("outbound.edit.saved"));
      onSaved();
    },
    onError: () => {
      // 412/409: nạp lại version mới để lần lưu sau không gửi tiếp bản cũ.
      void detailQuery.refetch();
    },
  });

  const handleSave = () => {
    if (!doc || doc.status !== "DRAFT" || updateMutation.isPending) return;
    if (!validate()) return;
    updateMutation.mutate();
  };

  const header = (
    <Box
      component="span"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      {t("outbound.edit.title")}
      <ActionIconButton
        kind="close"
        label={t("common.close")}
        onClick={dialog.close}
        disabled={updateMutation.isPending}
      />
    </Box>
  );

  if (detailQuery.isLoading) {
    return (
      <UiDrawer
        className="hn-outbound-dialog hn-outbound-edit-drawer"
        {...dialog.dialogProps}
        width={600}
        title={header}
      >
        {t("common.loadingData")}
      </UiDrawer>
    );
  }

  if (detailQuery.isError || !detail || !doc) {
    return (
      <UiDrawer
        className="hn-outbound-dialog hn-outbound-edit-drawer"
        {...dialog.dialogProps}
        width={600}
        title={header}
      >
        <ApiErrorAlert
          error={detailQuery.error}
          title={t("outbound.edit.saveError")}
        />
      </UiDrawer>
    );
  }

  const isDraft = doc.status === "DRAFT";

  return (
    <UiDrawer
      className="hn-outbound-dialog hn-outbound-edit-drawer"
      {...dialog.dialogProps}
      width={600}
      title={header}
      actions={
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: "flex-end" }}
        >
          <ActionButton kind="close" onClick={dialog.close}>
            {t("common.close")}
          </ActionButton>
          {isDraft ? (
            <ActionButton
              kind="save"
              disabled={updateMutation.isPending}
              onClick={handleSave}
            >
              {updateMutation.isPending
                ? t("outbound.edit.saving")
                : t("outbound.edit.save")}
            </ActionButton>
          ) : null}
        </Stack>
      }
    >
      <Stack spacing={2}>
        {!isDraft ? (
          <UiAlert tone="warning">{t("outbound.edit.onlyDraft")}</UiAlert>
        ) : null}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiAutocomplete
              fullWidth
              options={agencyOptions}
              value={agencyId}
              onChange={(next) => {
                const id = next === null ? null : String(next);
                setAgencyId(id);
                if (!id) return;
                const agency = agencyRows.find(
                  (entry) => entry.agency_id === id,
                );
                if (!agency) return;
                setRecipientName(agency.agency_name);
                setRecipientAddress(agency.address ?? "");
              }}
              onInputChange={setAgencyKeyword}
              loading={agencySearchQuery.isFetching}
              noOptionsText={
                agencyKeyword.trim()
                  ? t("outbound.intake.agencyNoMatch")
                  : t("outbound.intake.agencyTypeToSearch")
              }
              label={t("outbound.intake.fieldAgency")}
              placeholder={t("outbound.intake.fieldAgencyPlaceholder")}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiTextField
              required
              fullWidth
              label={t("outbound.intake.fieldRecipient")}
              value={recipientName}
              onChange={(event) => {
                setRecipientName(event.target.value);
                clearError("recipientName");
              }}
              error={Boolean(fieldErrors.recipientName)}
              helperText={fieldErrors.recipientName}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiTextField
              fullWidth
              label={t("outbound.intake.fieldPhone")}
              placeholder="VD: 0901234567"
              value={recipientPhone}
              onChange={(event) => {
                setRecipientPhone(
                  event.target.value.replace(/\D/g, "").slice(0, 10),
                );
                clearError("recipientPhone");
              }}
              error={Boolean(fieldErrors.recipientPhone)}
              helperText={fieldErrors.recipientPhone}
              slotProps={{
                htmlInput: { maxLength: 10, inputMode: "numeric" },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiFormField
              label={t("outbound.intake.fieldRequestDate")}
              htmlFor="outbound-edit-request-date"
              error={Boolean(fieldErrors.requestDate)}
              helperText={
                fieldErrors.requestDate ?? t("outbound.intake.dateHelper")
              }
            >
              <UiVuexyDateField
                id="outbound-edit-request-date"
                field="outbound-edit-request-date"
                aria-label={t("outbound.intake.fieldRequestDate")}
                value={requestDateValue}
                onChange={(next) => {
                  setRequestDate(next?.format("YYYY-MM-DD") ?? "");
                  clearError("requestDate");
                }}
                minDate={pastDateBounds().minDate}
                maxDate={pastDateBounds().maxDate}
              />
            </UiFormField>
          </Grid>
          <Grid size={12}>
            <UiAddressField
              label={t("outbound.intake.fieldAddress")}
              value={recipientAddress}
              onChange={setRecipientAddress}
              maxDetailLength={300}
            />
          </Grid>
          <Grid size={12}>
            <UiTextField
              fullWidth
              multiline
              minRows={3}
              label={t("outbound.edit.fieldNote")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              helperText={`${note.length}/1000`}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Grid>
        </Grid>

        <UiAlert tone="info">{t("outbound.edit.linesLocked")}</UiAlert>

        <Box>
          <Box
            component="h3"
            sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}
          >
            {t("outbound.edit.linesTitle")}
          </Box>
          <ResponsiveDataTable<OutboundLineRecord>
            columns={lineColumns}
            rows={detail.lines}
            rowKey={(line) => line.id}
            emptyText="-"
          />
        </Box>

        <DocumentAttachmentsPanel
          documentType="OUTBOUND"
          documentId={documentId}
          disabled={!canAttach}
        />

        <ApiErrorAlert
          error={updateMutation.error}
          title={t("outbound.edit.saveError")}
        />
      </Stack>
    </UiDrawer>
  );
}
