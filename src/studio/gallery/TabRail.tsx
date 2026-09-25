"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GALLERY_TABS, type GalleryTab, useUiStore } from "@/stores/ui";

const LABELS: Record<GalleryTab, string> = {
  projects: "Projects",
  image: "Image",
  video: "Video",
  favorites: "Favorites",
};

type Props = {
  counts?: Partial<Record<GalleryTab, number>>;
};

export function TabRail({ counts }: Props) {
  const active = useUiStore((s) => s.galleryTab);
  const setActive = useUiStore((s) => s.setGalleryTab);
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<GalleryTab, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);

  const measure = useCallback(() => {
    const rail = railRef.current;
    const tab = tabRefs.current[active];
    if (!rail || !tab) return;
    const r = rail.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    setIndicator({ x: t.left - r.left, w: t.width });
  }, [active]);

  useEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail) return;
    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [measure]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = GALLERY_TABS.indexOf(active);
    let next: GalleryTab | null = null;
    if (e.key === "ArrowRight") next = GALLERY_TABS[(i + 1) % GALLERY_TABS.length] ?? null;
    else if (e.key === "ArrowLeft") next = GALLERY_TABS[(i - 1 + GALLERY_TABS.length) % GALLERY_TABS.length] ?? null;
    else if (e.key === "Home") next = GALLERY_TABS[0] ?? null;
    else if (e.key === "End") next = GALLERY_TABS[GALLERY_TABS.length - 1] ?? null;
    if (!next) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Gallery" ref={railRef} onKeyDown={onKeyDown}>
      {GALLERY_TABS.map((tab) => {
        const selected = tab === active;
        const count = counts?.[tab];
        return (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[tab] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={selected}
            aria-controls={`panel-${tab}`}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => setActive(tab)}
          >
            {LABELS[tab]}
            {count !== undefined && count > 0 ? <span className="count">{count}</span> : null}
          </button>
        );
      })}
      {indicator ? (
        <span
          className="tabs-indicator"
          aria-hidden="true"
          style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }}
        />
      ) : null}
    </div>
  );
}
