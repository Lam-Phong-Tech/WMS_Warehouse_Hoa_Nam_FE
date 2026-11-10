import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionButton } from "@/shared/components/actions";
import { SearchOutlined } from "@/shared/components/icons";
import { UiDialog, UiPagination, UiSelect, UiTextField } from "@/shared/ui";
import { usePageVisible } from "@/shared/ui/page-visibility";
import { getApiErrorMessage, resolveFormErrors } from "@/shared/api/api-error";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import {
  createSupplier,
  listSuppliers,
  SUPPLIER_DESCRIPTION_MAX_LENGTH,
  updateSupplier,
  type Supplier,
  type SupplierPayload,
  type SupplierStatus,
} from "../services/supplier.service";
import { useSupplierCopy } from "./supplier-copy";
import "./supplier-list.css";

const supplierKeys = ["mvp-master", "suppliers"] as const;
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
function UpdatedAt({ value, locale }: { value: string; locale: string }) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (
    <span>—</span>
  ) : (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)}
    </time>
  );
}

export default function SupplierListPage() {
  const visible = usePageVisible();
  const { copy, locale } = useSupplierCopy();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const canRead = hasAnyWmsPermission(
    permissionCodes,
    [P.SUPPLIER_VIEW],
    isSuperAdmin,
  );
  const canCreate = hasAnyWmsPermission(
    permissionCodes,
    [P.SUPPLIER_CREATE],
    isSuperAdmin,
  );
  const canUpdate = hasAnyWmsPermission(
    permissionCodes,
    [P.SUPPLIER_UPDATE],
    isSuperAdmin,
  );
  const online = useOnline();
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SupplierStatus>("ACTIVE");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [form, setForm] = useState<{ supplier?: Supplier } | null>(null);
  const client = useQueryClient();
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);
  const params = { q: search || undefined, status, page, per_page: perPage };
  const query = useQuery({
    queryKey: [...supplierKeys, params],
    queryFn: ({ signal }) => listSuppliers(params, signal),
    enabled: visible && canRead && online,
    staleTime: 0,
  });
  const result = query.data;
  useEffect(() => {
    if (result && page > result.lastPage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reconcile an out-of-range page after server mutations.
      setPage(result.lastPage);
    }
  }, [result, page]);
  const rows = result?.rows ?? [];
  const busy = query.isFetching || keyword.trim() !== search;
  const canOpenEditor = canUpdate && online;
  const hasFilters = keyword !== "" || status !== "ACTIVE";
  const clearFilters = () => {
    setKeyword("");
    setStatus("ACTIVE");
    setPage(1);
  };
  const refresh = () => {
    void query.refetch();
  };
  const closeAndRefresh = (checkCreation?: SupplierPayload) => {
    setForm(null);
    if (checkCreation) {
      setKeyword(checkCreation.name);
      setStatus(checkCreation.status);
      setPage(1);
    }
    void client.invalidateQueries({ queryKey: supplierKeys });
  };
  const onSaved = (supplier: Supplier, created: boolean) => {
    setForm(null);
    if (created) {
      setKeyword(supplier.code ?? supplier.name);
      setStatus(supplier.status);
      setPage(1);
    }
    void client.invalidateQueries({ queryKey: supplierKeys });
    toast.success(created ? copy.created : copy.edited);
  };
  if (!canRead)
    return (
      <div role="alert" className="hn-ncc-notice">
        {copy.denied}
      </div>
    );

  return (
    <div className="hn-ncc-screen">
      <header className="hn-ncc-header">
        <h1>{copy.title}</h1>
        <div className="hn-ncc-actions">
          {canCreate ? (
            <ActionButton
              kind="create"
              className="hn-ncc-primary"
              onClick={() => setForm({})}
              disabled={!online}
            >
              {copy.create}
            </ActionButton>
          ) : !canUpdate ? (
            <span className="hn-ncc-muted">{copy.readonly}</span>
          ) : null}
        </div>
      </header>
      {!online && (
        <div role="status" className="hn-ncc-notice">
          {copy.offline}
        </div>
      )}
      <section className="hn-ncc-filters" aria-label={copy.filters}>
        <UiTextField
          fullWidth
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder={copy.searchPlaceholder}
          slotProps={{
            htmlInput: { "aria-label": copy.search, maxLength: 200 },
            input: {
              startAdornment: <SearchOutlined className="hn-ncc-search-icon" />,
            },
          }}
        />
        <UiSelect
          fullWidth
          aria-label={copy.status}
          value={status}
          onChange={(value) => {
            setStatus(value as SupplierStatus);
            setPage(1);
          }}
          options={[
            { value: "ACTIVE", label: `${copy.status}: ${copy.active}` },
            { value: "INACTIVE", label: `${copy.status}: ${copy.inactive}` },
          ]}
        />
        {hasFilters && (
          <ActionButton kind="reset" appearance="tonal" onClick={clearFilters}>
            {copy.reset}
          </ActionButton>
        )}
      </section>
      {query.isError ? (
        <div role="alert" className="hn-ncc-notice hn-ncc-error">
          <strong>{copy.error}</strong>
          <p>{getApiErrorMessage(query.error)}</p>
          <ActionButton kind="refresh" onClick={refresh} disabled={!online}>
            {copy.retry}
          </ActionButton>
        </div>
      ) : (
        <section className="hn-ncc-list" aria-label={copy.title}>
          <div
            className="hn-ncc-scroll"
            role="region"
            aria-label={copy.title}
            tabIndex={0}
            aria-busy={busy}
          >
            <table className="hn-ncc-table">
              <colgroup>
                <col className="hn-ncc-col-number" />
                <col className="hn-ncc-col-code" />
                <col className="hn-ncc-col-name" />
                <col className="hn-ncc-col-description" />
                <col className="hn-ncc-col-status" />
                <col className="hn-ncc-col-updated" />
                <col className="hn-ncc-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{copy.code}</th>
                  <th scope="col">{copy.name}</th>
                  <th scope="col">{copy.description}</th>
                  <th scope="col">{copy.status}</th>
                  <th scope="col">{copy.updated}</th>
                  <th scope="col">
                    <span className="hn-ncc-sr-only">{copy.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.isPending ? (
                  <tr>
                    <td colSpan={7}>
                      <div role="status" className="hn-ncc-empty">
                        {copy.loading}
                      </div>
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((supplier, index) => (
                    <tr
                      key={supplier.id}
                      data-clickable={canOpenEditor ? "true" : undefined}
                      tabIndex={canOpenEditor ? 0 : undefined}
                      onClick={(event) => {
                        if (
                          !canOpenEditor ||
                          (event.target instanceof Element &&
                            event.target.closest(
                              "a, button, input, select, textarea, [role='button']",
                            ))
                        ) {
                          return;
                        }
                        setForm({ supplier });
                      }}
                      onKeyDown={(event) => {
                        if (
                          !canOpenEditor ||
                          event.target !== event.currentTarget
                        ) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setForm({ supplier });
                        }
                      }}
                    >
                      <td>
                        {((result?.page ?? page) - 1) *
                          (result?.perPage ?? perPage) +
                          index +
                          1}
                      </td>
                      <td>
                        <strong
                          className="hn-ncc-code"
                          title={supplier.code ?? undefined}
                        >
                          {supplier.code ?? copy.unknownCode}
                        </strong>
                      </td>
                      <td>
                        <span className="hn-ncc-name" title={supplier.name}>
                          {supplier.name}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            supplier.description
                              ? "hn-ncc-description"
                              : "hn-ncc-muted"
                          }
                          title={supplier.description ?? undefined}
                        >
                          {supplier.description ?? copy.noDescription}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`hn-ncc-status${supplier.status === "ACTIVE" ? " is-active" : ""}`}
                        >
                          <span aria-hidden="true" />
                          {supplier.status === "ACTIVE"
                            ? copy.active
                            : copy.inactive}
                        </span>
                      </td>
                      <td className="hn-ncc-updated">
                        <UpdatedAt
                          value={supplier.updated_at}
                          locale={locale}
                        />
                      </td>
                      <td>
                        {canUpdate && (
                          <ActionButton
                            kind="edit"
                            appearance="flat"
                            aria-label={`${copy.editAction} ${supplier.code ?? supplier.name}`}
                            onClick={() => setForm({ supplier })}
                            disabled={!online || busy}
                          >
                            {copy.editAction}
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="hn-ncc-empty">
                        <strong>
                          {hasFilters ? copy.noResults : copy.empty}
                        </strong>
                        <p>
                          {hasFilters ? copy.noResultsHelp : copy.emptyHelp}
                        </p>
                        {hasFilters && (
                          <ActionButton kind="reset" onClick={clearFilters}>
                            {copy.reset}
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="hn-ncc-pagination">
            <div className="hn-ncc-page-info">
              <span>
                {result ? (
                  <>
                    {copy.showing}{" "}
                    {result.total ? (result.page - 1) * result.perPage + 1 : 0}–
                    {Math.min(result.page * result.perPage, result.total)} /{" "}
                    {result.total.toLocaleString(locale)} NCC
                  </>
                ) : online ? (
                  copy.loading
                ) : (
                  copy.offline
                )}
              </span>
              <UiSelect
                aria-label={copy.size}
                value={perPage}
                onChange={(value) => {
                  setPerPage(Number(value));
                  setPage(1);
                }}
                options={TABLE_PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: `${size} / ${copy.page}`,
                }))}
              />
            </div>
            <UiPagination
              page={result?.page ?? page}
              pageSize={perPage}
              total={result?.total ?? 0}
              onPageChange={setPage}
              showTotal={false}
              disabled={busy || !online}
            />
          </footer>
        </section>
      )}
      {form && (form.supplier ? canUpdate : canCreate) && (
        <SupplierForm
          key={form.supplier?.id ?? "new"}
          supplier={form.supplier}
          online={online}
          onClose={() => setForm(null)}
          onReload={closeAndRefresh}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function SupplierForm({
  supplier,
  online,
  onClose,
  onReload,
  onSaved,
}: {
  supplier?: Supplier;
  online: boolean;
  onClose: () => void;
  onReload: (checkCreation?: SupplierPayload) => void;
  onSaved: (row: Supplier, created: boolean) => void;
}) {
  const { copy } = useSupplierCopy();
  const [name, setName] = useState(supplier?.name ?? "");
  const [description, setDescription] = useState(supplier?.description ?? "");
  const [status, setStatus] = useState<SupplierStatus>(
    supplier?.status ?? "ACTIVE",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const mutation = useMutation({
    retry: false,
    onError: () => {
      /* The form owns persistent error feedback. */
    },
    mutationFn: () =>
      supplier
        ? updateSupplier(supplier.id, supplier.version, {
            name: name.trim(),
            status,
            description: description.trim() || null,
          })
        : createSupplier({
            name: name.trim(),
            status,
            description: description.trim() || null,
          }),
  });
  const dirty =
    name !== (supplier?.name ?? "") ||
    description !== (supplier?.description ?? "") ||
    status !== (supplier?.status ?? "ACTIVE");
  const close = () => {
    if (!mutation.isPending && (!dirty || window.confirm(copy.discard)))
      onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isPending || blocked || !online) return;
    if (!name.trim() || [...name.trim()].length > 200) {
      setErrors({ name: !name.trim() ? copy.nameRequired : copy.nameLong });
      return;
    }
    if ([...description.trim()].length > SUPPLIER_DESCRIPTION_MAX_LENGTH) {
      setErrors({ description: copy.descriptionLong });
      return;
    }
    setErrors({});
    setMessage(null);
    try {
      onSaved(await mutation.mutateAsync(), !supplier);
    } catch (error) {
      const statusCode = (error as { response?: { status?: number } } | null)
        ?.response?.status;
      if (statusCode === 412) {
        setBlocked(true);
        setMessage(copy.stale);
      } else if (!supplier && (statusCode === undefined || statusCode >= 500)) {
        setBlocked(true);
        setMessage(copy.ambiguous);
      } else {
        const resolved = resolveFormErrors(error, [
          "name",
          "description",
          "status",
        ]);
        setErrors(resolved.fieldErrors);
        setMessage(resolved.message);
      }
    }
  };
  return (
    <UiDialog
      open
      title={supplier ? copy.edit : copy.create}
      onClose={close}
      className="hn-ncc-dialog"
      actions={
        <>
          <ActionButton
            kind="cancel"
            appearance="tonal"
            onClick={close}
            disabled={mutation.isPending}
          >
            {copy.cancel}
          </ActionButton>
          {blocked && (
            <ActionButton
              kind="refresh"
              onClick={() =>
                onReload(
                  supplier
                    ? undefined
                    : {
                        name: name.trim(),
                        status,
                        description: description.trim() || null,
                      },
                )
              }
            >
              {copy.reloadClose}
            </ActionButton>
          )}
          <ActionButton
            kind="save"
            className="hn-ncc-primary"
            type="submit"
            form="supplier-form"
            loading={mutation.isPending}
            disabled={!online || blocked}
          >
            {supplier ? copy.saveEdit : copy.saveCreate}
          </ActionButton>
        </>
      }
    >
      <form
        id="supplier-form"
        className="hn-ncc-form"
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
      >
        {message && (
          <div className="hn-ncc-notice hn-ncc-error" role="alert">
            {message}
          </div>
        )}
        {!online && (
          <div className="hn-ncc-notice" role="status">
            {copy.offline}
          </div>
        )}
        <UiTextField
          label={copy.code}
          value={
            supplier ? (supplier.code ?? copy.unknownCode) : copy.automatic
          }
          fullWidth
          slotProps={{ input: { readOnly: true } }}
          helperText={copy.codeHelp}
        />
        <UiTextField
          autoFocus
          required
          label={copy.name}
          value={name}
          fullWidth
          onChange={(event) => {
            setName(event.target.value);
            setErrors((previous) => ({ ...previous, name: "" }));
          }}
          error={Boolean(errors.name)}
          helperText={errors.name}
          disabled={mutation.isPending}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
        <UiTextField
          label={copy.description}
          value={description}
          fullWidth
          multiline
          rows={3}
          onChange={(event) => {
            setDescription(event.target.value);
            setErrors((previous) => ({ ...previous, description: "" }));
          }}
          error={Boolean(errors.description)}
          helperText={errors.description || copy.descriptionHelp}
          disabled={mutation.isPending}
          slotProps={{
            htmlInput: { maxLength: SUPPLIER_DESCRIPTION_MAX_LENGTH },
          }}
        />
        <UiSelect
          label={copy.status}
          value={status}
          onChange={(value) => setStatus(value as SupplierStatus)}
          fullWidth
          disabled={mutation.isPending}
          error={Boolean(errors.status)}
          helperText={errors.status}
          options={[
            { value: "ACTIVE", label: copy.active },
            { value: "INACTIVE", label: copy.inactive },
          ]}
        />
      </form>
    </UiDialog>
  );
}
