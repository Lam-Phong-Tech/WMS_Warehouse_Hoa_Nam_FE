/**
 * Test useClientSort — thứ tự sau khi sắp xếp và VỊ TRÍ GỐC của dòng (nguồn số
 * cho cột STT).
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useClientSort } from "./useClientSort";

interface Row {
  id: string;
  name: string;
}

const ROWS: Row[] = [
  { id: "c", name: "Cam" },
  { id: "a", name: "Anh" },
  { id: "b", name: "Bình" },
];

function Host() {
  const { sortedRows, requestSort, originalIndexOf } = useClientSort(ROWS, {
    name: (row) => row.name,
  });
  return (
    <>
      <button type="button" onClick={() => requestSort("name")}>
        Sắp xếp tên
      </button>
      <ul>
        {sortedRows.map((row) => (
          <li key={row.id} data-testid={`row-${row.id}`}>
            {originalIndexOf(row) + 1} · {row.name}
          </li>
        ))}
      </ul>
    </>
  );
}

describe("useClientSort", () => {
  it("STT lấy vị trí GỐC nên số đi theo dòng khi sắp xếp lại", () => {
    render(<Host />);

    expect(screen.getByTestId("row-c")).toHaveTextContent("1 · Cam");
    expect(screen.getByTestId("row-a")).toHaveTextContent("2 · Anh");
    expect(screen.getByTestId("row-b")).toHaveTextContent("3 · Bình");

    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp tên" }));

    // Thứ tự hiển thị đổi (A → Z) nhưng mỗi dòng giữ nguyên số của nó.
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "2 · Anh",
      "3 · Bình",
      "1 · Cam",
    ]);
  });
});
