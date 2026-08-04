import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { z } from "zod";
import { useFormPattern } from "./useFormPattern";

const schema = z.object({
  code: z.string().min(2, "Mã phải có ít nhất 2 ký tự"),
  name: z.string().min(1, "Tên là bắt buộc"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Component tối giản dựng useFormPattern + input thường (không phụ thuộc
 * FormInput/antd) — đủ để lái toàn bộ vòng đời qua DOM thật (submit, lỗi
 * validate client, lỗi server 422) mà không kéo theo phụ thuộc UI framework.
 */
function TestForm({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (data: FormValues) => void | Promise<void>;
  defaultValues?: Partial<FormValues>;
}) {
  const { register, submitForm, errors, isSubmitting, applyServerErrors } =
    useFormPattern<FormValues>({
      schema,
      defaultValues: { code: "", name: "", ...defaultValues },
      onSubmit: async (data) => {
        try {
          await onSubmit(data);
        } catch (err) {
          applyServerErrors(err);
        }
      },
    });

  return (
    <form>
      <input aria-label="code" {...register("code")} />
      {errors.code && <span role="alert">{errors.code.message}</span>}
      <input aria-label="name" {...register("name")} />
      {errors.name && <span role="alert">{errors.name.message}</span>}
      <button type="button" onClick={submitForm} disabled={isSubmitting}>
        {isSubmitting ? "Đang lưu..." : "Lưu"}
      </button>
    </form>
  );
}

function axiosError422(data: unknown) {
  return { isAxiosError: true, response: { status: 422, data } };
}

describe("useFormPattern — submit contract", () => {
  it("submitForm gọi onSubmit với dữ liệu hợp lệ, không cần handleSubmit thủ công", async () => {
    const onSubmit = vi.fn();
    render(
      <TestForm
        onSubmit={onSubmit}
        defaultValues={{ code: "AB", name: "X" }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ code: "AB", name: "X" });
    });
  });

  it("submitForm chặn submit và hiện lỗi Zod khi dữ liệu không hợp lệ", async () => {
    const onSubmit = vi.fn();
    render(
      <TestForm onSubmit={onSubmit} defaultValues={{ code: "", name: "" }} />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(
      await screen.findByText("Mã phải có ít nhất 2 ký tự"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("isSubmitting bật true trong lúc onSubmit async đang chạy, tắt lại sau khi xong", async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(
      <TestForm
        onSubmit={onSubmit}
        defaultValues={{ code: "AB", name: "X" }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await screen.findByText("Đang lưu...");
    expect(screen.getByRole("button")).toBeDisabled();

    resolveSubmit();

    await waitFor(() => {
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });
});

describe("useFormPattern — applyServerErrors (P0.2)", () => {
  it("map lỗi 422 dạng flat root-level `errors` xuống đúng field", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      axiosError422({
        status: "error",
        error_code: "VALIDATION_FAILED",
        message: "Dữ liệu đầu vào không hợp lệ",
        errors: { code: ["Mã đã tồn tại"] },
      }),
    );
    render(
      <TestForm
        onSubmit={onSubmit}
        defaultValues={{ code: "AB", name: "X" }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Mã đã tồn tại")).toBeInTheDocument();
  });

  it("map lỗi 422 dạng nested `error.details` xuống đúng field", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      axiosError422({
        success: false,
        message: "Dữ liệu đầu vào không hợp lệ",
        error: {
          code: "VALIDATION_FAILED",
          details: { name: ["Tên đã tồn tại"] },
        },
      }),
    );
    render(
      <TestForm
        onSubmit={onSubmit}
        defaultValues={{ code: "AB", name: "X" }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Tên đã tồn tại")).toBeInTheDocument();
  });

  it("fieldMap redirect field khi tên form khác tên field BE (đúng layer: key SAU khi extractFieldErrors đã snake_case→camelCase)", async () => {
    // BE trả lỗi cho `manager_employee_id` — extractFieldErrors() tự động
    // chuyển thành `managerEmployeeId` (không có trong FIELD_MAP dùng chung ở
    // api-error.ts) TRƯỚC khi tới applyServerErrors. fieldMap ở đây vì vậy phải
    // khai báo bằng key `managerEmployeeId` (đã camelCase), không phải
    // `manager_employee_id` (snake_case gốc) — dùng nhầm key gốc là bug thật đã
    // gặp ở DepartmentFormModal (lỗi field bị rơi mất trong im lặng).
    const onSubmit = vi.fn().mockRejectedValue(
      axiosError422({
        message: "Lỗi",
        errors: { manager_employee_id: ["Trưởng phòng không hợp lệ"] },
      }),
    );

    function TestFormWithFieldMap() {
      const { register, submitForm, errors, applyServerErrors } =
        useFormPattern<FormValues & { code: string }>({
          schema,
          defaultValues: { code: "AB", name: "X" },
          onSubmit: async (data) => {
            try {
              await onSubmit(data);
            } catch (err) {
              // Redirect sang `code` (field có sẵn trong form test này) để không
              // phải tạo thêm field managerId chỉ cho mục đích test.
              applyServerErrors(err, { managerEmployeeId: "code" });
            }
          },
        });
      return (
        <form>
          <input aria-label="code" {...register("code")} />
          {errors.code && <span role="alert">{errors.code.message}</span>}
          <button type="button" onClick={submitForm}>
            Lưu
          </button>
        </form>
      );
    }

    render(<TestFormWithFieldMap />);
    fireEvent.click(screen.getByRole("button"));

    expect(
      await screen.findByText("Trưởng phòng không hợp lệ"),
    ).toBeInTheDocument();
  });

  it("trả false và không set lỗi field nào khi error không phải validation theo field", async () => {
    const onSubmit = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: "Lỗi server" } },
    });
    render(
      <TestForm
        onSubmit={onSubmit}
        defaultValues={{ code: "AB", name: "X" }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("useFormPattern — resetForm/setValues (dùng khi nạp dữ liệu edit)", () => {
  it("resetForm() đưa form về defaultValues, setValues() ghi đè field cần nạp", () => {
    function TestFormWithReset() {
      const { register, resetForm, setValues } = useFormPattern<FormValues>({
        schema,
        defaultValues: { code: "", name: "" },
        onSubmit: vi.fn(),
      });
      return (
        <form>
          <input aria-label="code" {...register("code")} />
          <button
            type="button"
            onClick={() => {
              resetForm();
              setValues({ code: "EDIT1", name: "Đang sửa" });
            }}
          >
            Load edit
          </button>
        </form>
      );
    }

    render(<TestFormWithReset />);
    fireEvent.click(screen.getByRole("button", { name: "Load edit" }));

    expect(screen.getByLabelText("code")).toHaveValue("EDIT1");
  });
});
