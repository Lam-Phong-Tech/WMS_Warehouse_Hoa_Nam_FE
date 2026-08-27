import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimatedList, AnimatedListItem } from "./AnimatedList";
import { createRowKey } from "./row-key";
import { MOTION_ENABLED } from "./motion-tokens";

/**
 * Hai điều kiện phải giữ, nếu vỡ thì cả bộ test FE vỡ theo hoặc người dùng
 * mất dữ liệu đang gõ:
 *
 * 1. Ở môi trường test (và khi người dùng bật "giảm chuyển động"), dòng phải
 *    biến mất NGAY trong lần render kế tiếp. Nếu để hiệu ứng thoát chạy, phần
 *    tử còn nán lại trong DOM vài trăm ms và mọi assert kiểu
 *    `not.toBeInTheDocument()` ngay sau click sẽ đỏ oan.
 * 2. Khóa dòng phải ổn định qua các lần render — đây là điều kiện để React
 *    không dựng lại ô nhập của các dòng phía sau khi xóa một dòng ở giữa.
 */

function LineEditor() {
  const [lines, setLines] = useState(() => [
    { key: createRowKey("line"), label: "Dòng A" },
    { key: createRowKey("line"), label: "Dòng B" },
    { key: createRowKey("line"), label: "Dòng C" },
  ]);

  return (
    <AnimatedList data-testid="lines">
      {lines.map((line, index) => (
        <AnimatedListItem key={line.key}>
          <label>
            {line.label}
            <input defaultValue={line.label} />
          </label>
          <button
            type="button"
            onClick={() =>
              setLines((current) => current.filter((_, i) => i !== index))
            }
          >
            {`Xóa ${line.label}`}
          </button>
        </AnimatedListItem>
      ))}
    </AnimatedList>
  );
}

describe("AnimatedList", () => {
  it("tắt chuyển động trong môi trường test để DOM đổi đồng bộ", () => {
    expect(MOTION_ENABLED).toBe(false);
  });

  it("render đủ mọi dòng", () => {
    render(<LineEditor />);
    expect(screen.getByText("Dòng A")).toBeInTheDocument();
    expect(screen.getByText("Dòng B")).toBeInTheDocument();
    expect(screen.getByText("Dòng C")).toBeInTheDocument();
  });

  it("xóa dòng giữa thì dòng đó biến mất ngay và các dòng khác giữ nguyên giá trị đang nhập", async () => {
    const user = userEvent.setup();
    render(<LineEditor />);

    // Người dùng đang gõ dở ở dòng cuối — giá trị này phải sống sót.
    const lastInput = screen.getByLabelText("Dòng C");
    await user.clear(lastInput);
    await user.type(lastInput, "đang gõ dở");

    await user.click(screen.getByRole("button", { name: "Xóa Dòng B" }));

    expect(screen.queryByText("Dòng B")).not.toBeInTheDocument();
    expect(screen.getByText("Dòng A")).toBeInTheDocument();
    // Khóa ổn định ⇒ React không dựng lại ô nhập của dòng phía sau ⇒ không mất
    // nội dung đang gõ. Dùng key theo chỉ số thì assert này sẽ đỏ.
    expect(screen.getByLabelText("Dòng C")).toHaveValue("đang gõ dở");
  });
});

describe("createRowKey", () => {
  it("sinh khóa khác nhau cho từng dòng", () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => createRowKey("line")),
    );
    expect(keys.size).toBe(50);
  });
});
