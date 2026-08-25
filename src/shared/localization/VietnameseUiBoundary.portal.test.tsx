import { useState } from "react";
import { createPortal } from "react-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VietnameseUiBoundary } from "@/shared/localization/VietnameseUiBoundary";

function PortalFixture() {
  const [text, setText] = useState("Packing Label chưa PRINTED");

  return (
    <VietnameseUiBoundary>
      <button type="button" onClick={() => setText("Quét & Full Post Receipt")}>
        Đổi nội dung
      </button>
      {createPortal(<div data-testid="portal-copy">{text}</div>, document.body)}
    </VietnameseUiBoundary>
  );
}

describe("VietnameseUiBoundary", () => {
  it("localizes portal content and later text mutations", async () => {
    render(<PortalFixture />);

    await waitFor(() =>
      expect(screen.getByTestId("portal-copy")).toHaveTextContent(
        "Nhãn đóng gói chưa được in",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Đổi nội dung" }));

    await waitFor(() =>
      expect(screen.getByTestId("portal-copy")).toHaveTextContent(
        "Quét & hoàn tất nhập kho",
      ),
    );
  });

  it("does not modify data attributes used by API/test contracts", async () => {
    render(
      <VietnameseUiBoundary>
        <div
          data-testid="contract-node"
          data-ui-state="POSTED"
          data-permission="inbound.post"
        >
          POSTED
        </div>
      </VietnameseUiBoundary>,
    );

    const node = screen.getByTestId("contract-node");
    await waitFor(() => expect(node).toHaveTextContent("Đã ghi nhận"));
    expect(node).toHaveAttribute("data-ui-state", "POSTED");
    expect(node).toHaveAttribute("data-permission", "inbound.post");
  });
});
