import { Component, type ReactNode } from "react";
import {
  equalSkeletonGeometry,
  measureSkeletonGeometry,
  type SkeletonGeometry,
} from "./content-skeleton-geometry";
import "./loading-skeleton.css";
import "./content-loading-skeleton.css";

export interface ContentLoadingSkeletonProps {
  contentRef: { readonly current: HTMLDivElement | null };
  fallback: ReactNode;
  label: string;
}

/**
 * A presentation-only mirror of the live content's geometry. There is no copied
 * DOM, form value or second chart instance. It never owns a loading ticket; the
 * existing page/dialog gate still releases ALL content together.
 */
export class ContentLoadingSkeleton extends Component<
  ContentLoadingSkeletonProps,
  { geometry: SkeletonGeometry | null }
> {
  state: { geometry: SkeletonGeometry | null } = { geometry: null };
  private mutations?: MutationObserver;
  private resize?: ResizeObserver;
  private frame?: number;
  private alive = false;
  private observedRoot: HTMLDivElement | null = null;

  componentDidMount() {
    this.alive = true;
    this.connect();
  }
  componentDidUpdate(previous: ContentLoadingSkeletonProps) {
    if (previous.contentRef !== this.props.contentRef) {
      this.disconnect();
      this.connect();
    }
  }
  componentWillUnmount() {
    this.alive = false;
    this.disconnect();
  }
  private measure = () => {
    this.frame = undefined;
    if (!this.alive) return;
    const root = this.props.contentRef.current;
    const geometry = root ? measureSkeletonGeometry(root) : null;
    this.setState((previous) => equalSkeletonGeometry(previous.geometry, geometry) ? null : { geometry });
  };
  private schedule = () => {
    if (!this.alive || this.frame !== undefined) return;
    this.frame = window.requestAnimationFrame(this.measure);
  };
  private connect() {
    const root = this.props.contentRef.current;
    if (!root) return;
    this.observedRoot = root;
    // componentDidMount state is flushed before paint: the first mounted page
    // uses its own field/card geometry, not a generic report silhouette.
    this.measure();
    if (typeof MutationObserver !== "undefined") {
      this.mutations = new MutationObserver(this.schedule);
      this.mutations.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ["class", "style", "hidden", "open", "data-view", "data-state", "aria-expanded"] });
    }
    if (typeof ResizeObserver !== "undefined") {
      this.resize = new ResizeObserver(this.schedule);
      this.resize.observe(root);
    }
    window.addEventListener("resize", this.schedule);
    // Scrollable tables can move their cells without changing the outer size.
    root.addEventListener("scroll", this.schedule, true);
    root.ownerDocument.fonts?.addEventListener("loadingdone", this.schedule);
    void root.ownerDocument.fonts?.ready.then(this.schedule);
  }
  private disconnect() {
    this.mutations?.disconnect();
    this.resize?.disconnect();
    if (this.frame !== undefined) window.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    window.removeEventListener("resize", this.schedule);
    this.observedRoot?.removeEventListener("scroll", this.schedule, true);
    this.observedRoot?.ownerDocument.fonts?.removeEventListener("loadingdone", this.schedule);
    this.observedRoot = null;
  }
  render() {
    const { geometry } = this.state;
    if (!geometry) return this.props.fallback;
    return (
      <div className="hn-skeleton hn-content-skeleton" data-skeleton-layout="content-matched"
        data-testid="content-matched-skeleton" data-ui-state="loading"
        role="status" aria-live="polite" aria-atomic="true">
        <span className="hn-skeleton__status">{this.props.label}</span>
        <div className="hn-skeleton__shapes hn-content-skeleton__shapes"
          aria-hidden="true" style={{ height: geometry.height }}>
          {geometry.shapes.map((shape, index) => (
            <span key={index} className={`hn-content-skeleton__shape hn-content-skeleton__shape--${shape.kind}`}
              style={{ left: shape.x, top: shape.y, width: shape.width,
                height: shape.height, borderRadius: shape.radius }} />
          ))}
        </div>
      </div>
    );
  }
}
