import type { ComponentProps } from "react";

type BrandMarkProps = Omit<ComponentProps<"img">, "src"> & {
  size?: number;
};

/** One brand mark for the app UI; PWA PNGs are generated from this same SVG. */
export function BrandMark({
  size = 32,
  alt = "",
  style,
  ...props
}: BrandMarkProps) {
  return (
    <img
      {...props}
      src="/favicon.svg"
      alt={alt}
      style={{
        display: "block",
        width: size,
        height: size,
        objectFit: "contain",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
