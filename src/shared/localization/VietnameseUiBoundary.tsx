import { useLayoutEffect, type ReactNode } from "react";

import {
  exactBusinessLabel,
  translateUserFacingText,
} from "@/shared/localization/translateUserFacingText";

const LOCALIZED_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;
const SKIP_SELECTOR =
  'script,style,code,pre,[data-no-vietnamese-localization="true"],[data-testid="pv-product-card"]';
const UI_CONTROL_SELECTOR =
  'button,label,th,option,[role="button"],[role="tab"],.ant-tag,.pill,.ant-alert,.ant-modal-title,.ant-card-head-title,.ant-descriptions-item-label,.ant-tabs-tab';

function shouldSkip(element: Element | null): boolean {
  return Boolean(element?.closest(SKIP_SELECTOR));
}

function isPlainTableData(parent: Element): boolean {
  return Boolean(parent.closest("td")) && !parent.closest(UI_CONTROL_SELECTOR);
}

function localizeTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || shouldSkip(parent)) return;
  const current = node.nodeValue ?? "";

  // Không dịch tự do dữ liệu nghiệp vụ trong cell. Chỉ exact enum/status đã biết mới
  // được map. Nhờ vậy tên khách/SKU như "Tool Box" hay "Item Pro" không bị thay chữ.
  const next = isPlainTableData(parent)
    ? (exactBusinessLabel(current) ?? current)
    : translateUserFacingText(current);

  if (next !== current) node.nodeValue = next;
}

function localizeAttributes(element: Element): void {
  if (shouldSkip(element)) return;
  for (const attribute of LOCALIZED_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const next = translateUserFacingText(current);
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function localizeSubtree(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    localizeTextNode(node as Text);
    return;
  }
  if (!(node instanceof Element)) return;
  if (shouldSkip(node)) return;

  localizeAttributes(node);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    localizeTextNode(current as Text);
    current = walker.nextNode();
  }

  node.querySelectorAll("*").forEach(localizeAttributes);
}

export function VietnameseUiBoundary({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    // Ant Design render Modal/Drawer/Dropdown/notification bằng portal dưới body,
    // không nhất thiết nằm trong #root. Observe toàn body để safety net áp dụng đồng
    // nhất cho cả page thường và overlay/portal.
    const root = document.body;
    if (!root) return;

    localizeSubtree(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          localizeTextNode(mutation.target as Text);
          continue;
        }
        if (
          mutation.type === "attributes" &&
          mutation.target instanceof Element
        ) {
          localizeAttributes(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach(localizeSubtree);
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...LOCALIZED_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
