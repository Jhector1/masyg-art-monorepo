// components/animation/VeveDrawFromSvg.tsx
"use client";
import { useEffect, useState } from "react";
import VeveDraw, { PathItem } from "./VeveDraw";

function collectTransform(node: Element | null) {
  let t = "";
  let el: Element | null = node;
  while (el && el.tagName.toLowerCase() !== "svg") {
    const part = el.getAttribute("transform");
    if (part) t = `${part} ${t}`;
    el = el.parentElement;
  }
  return t.trim();
}

type Props = Omit<
  React.ComponentProps<typeof VeveDraw>,
  "paths" | "viewBox"
> & {
  src: string;
  selector?: string;
  sortByAttr?: string;
  reverse?: boolean;
};

export default function VeveDrawFromSvg({
  src,
  selector = "path",
  sortByAttr,
  reverse = false,
  ...rest
}: Props) {
  const [items, setItems] = useState<PathItem[] | null>(null);
  const [viewBox, setViewBox] = useState<string>("0 0 1024 1024");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();
        const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
        const svg = doc.querySelector("svg");
        const vb = svg?.getAttribute("viewBox");
        if (vb) setViewBox(vb);

        const nodes = Array.from(doc.querySelectorAll<SVGPathElement>(selector));
        if (sortByAttr) {
          nodes.sort(
            (a, b) =>
              Number(a.getAttribute(sortByAttr) ?? Infinity) -
              Number(b.getAttribute(sortByAttr) ?? Infinity)
          );
        }
        let arr: PathItem[] = nodes
          .map((n) => {
            const d = n.getAttribute("d");
            if (!d) return null;
            const transform = collectTransform(n) || undefined;
            return { d, transform };
          })
          .filter(Boolean) as PathItem[];

        if (!alive) return;
        if (reverse) arr = arr.reverse();

        if (arr.length === 0) setErr("SVG has no <path> elements.");
        else setItems(arr);
      } catch (e: any) {
        setErr(e.message || "Failed to load SVG.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [src, selector, sortByAttr, reverse]);

  if (err) return <div className="text-red-400 text-sm">Error: {err}</div>;
  if (!items) return <div className="text-neutral-400 text-sm">Loading…</div>;

  return <VeveDraw paths={items} viewBox={viewBox} {...rest} />;
}
