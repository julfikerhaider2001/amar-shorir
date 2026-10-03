"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Crosshair, Maximize2, RotateCcw, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { format, t, toBanglaDigits, type Hotspot, type Organ } from "../i18n";
import type { AnatomyViewer } from "../lib/three/viewer";

type Props = {
  organ: Organ;
  autoRotate: boolean;
  onAutoRotate: (enabled: boolean) => void;
  onOrganTap: () => void;
  onHotspotTap: (hotspot: Hotspot) => void;
};

/** `?authoring=1` is read from the URL without a hydration mismatch. */
function useAuthoringFlag() {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("authoring") === "1",
    () => false,
  );
}

export function OrganViewer({ organ, autoRotate, onAutoRotate, onOrganTap, onHotspotTap }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const organRef = useRef(organ);
  const autoRotateRef = useRef(autoRotate);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);

  // Opt-in coordinate probe for placing hotspots — a developer tool, not a
  // user-facing feature, so its strings are deliberately not translated.
  const authoring = useAuthoringFlag();
  const authoringRef = useRef(authoring);
  const [authorPoint, setAuthorPoint] = useState<{ x: number; y: number; z: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // The viewer captures its callbacks once, so live handlers go through refs.
  const organTapRef = useRef(onOrganTap);
  const hotspotTapRef = useRef(onHotspotTap);
  const authorRef = useRef<(point: { x: number; y: number; z: number }) => void>(() => {});
  useEffect(() => {
    organTapRef.current = onOrganTap;
    hotspotTapRef.current = onHotspotTap;
  });
  useEffect(() => {
    authorRef.current = setAuthorPoint;
  }, []);
  useEffect(() => {
    authoringRef.current = authoring;
  }, [authoring]);

  // A typical organ is ready well inside a second — flashing a loading panel for
  // that reads as jank. It only appears if the fetch is genuinely slow; the flag
  // is cleared by onLoading when the next load starts.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 900);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    organRef.current = organ;
  }, [organ]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("../lib/three/viewer").then(({ AnatomyViewer: Viewer }) => {
      if (cancelled || !mountRef.current) return;
      viewer = new Viewer(mountRef.current, {
        onSelect: setSelected,
        onLoading: (isLoading, value) => {
          setLoading(isLoading);
          setProgress(value);
          if (isLoading) setSlowLoad(false);
        },
        onHotspotTap: (hotspot) => hotspotTapRef.current(hotspot),
        onOrganTap: () => organTapRef.current(),
        onAuthorPoint: (point) => authorRef.current(point),
      });
      viewerRef.current = viewer;
      viewer.setCanvasLabel(t.viewer.canvas);
      viewer.setAutoRotate(autoRotateRef.current);
      viewer.setAuthoring(authoringRef.current);
      const current = organRef.current;
      viewer.setOrgan(current.model, current.hotspots, current.accent).catch(() => {
        setLoading(false);
        setProgress(0);
      });
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.setOrgan(organ.model, organ.hotspots, organ.accent).catch(() => {
      setLoading(false);
      setProgress(0);
    });
  }, [organ]);

  useEffect(() => viewerRef.current?.setAutoRotate(autoRotate), [autoRotate]);
  useEffect(() => viewerRef.current?.setAuthoring(authoring), [authoring]);

  // The viewer drives the callout's position directly, so a spinning model
  // never costs a React render.
  const calloutRef = useCallback((node: HTMLDivElement | null) => {
    viewerRef.current?.attachCallout(node);
  }, []);

  const handleTool = (tool: string) => {
    const viewer = viewerRef.current;
    if (tool === "rotate") onAutoRotate(!autoRotate);
    if (tool === "zoom-in") viewer?.zoom(-1);
    if (tool === "zoom-out") viewer?.zoom(1);
    if (tool === "reset") viewer?.reset();
  };

  const tools = [
    { id: "rotate", label: t.tools.rotate, icon: RefreshCw, pressed: autoRotate },
    { id: "zoom-in", label: t.tools.zoomIn, icon: ZoomIn },
    { id: "zoom-out", label: t.tools.zoomOut, icon: ZoomOut },
    { id: "reset", label: t.tools.reset, icon: RotateCcw },
  ];

  return (
    <section className="viewer-shell" aria-label={format(t.viewer.title, { organ: organ.name })} data-state={loading ? "loading" : "ready"}>
      <div className="viewer-glow" style={{ "--organ-accent": organ.accent } as React.CSSProperties} />
      <div ref={mountRef} className="three-mount" data-testid="model" />

      <div className="viewer-tools" role="toolbar" aria-label={t.tools.label}>
        {tools.map(({ id, label, icon: Icon, pressed }) => (
          <button
            key={id}
            type="button"
            className={`tool-button ${pressed ? "active" : ""}`}
            onClick={() => handleTool(id)}
            aria-pressed={pressed}
            aria-label={label}
            title={label}
          >
            <Icon size={24} strokeWidth={2.2} aria-hidden />
            <span aria-hidden>{label}</span>
          </button>
        ))}
      </div>

      <ul className="tip-note" aria-hidden>
        <li><span>👆</span>{t.viewer.tipDrag}</li>
        <li><span>🤏</span>{t.viewer.tipPinch}</li>
        <li><span>👉</span>{t.viewer.tipTap}</li>
      </ul>

      {selected && (
        <div className="hotspot-callout" ref={calloutRef} data-side="right">
          <div className="callout-body" style={{ "--hotspot-color": selected.color } as React.CSSProperties} role="status">
            <button className="callout-close" type="button" onClick={() => viewerRef.current?.clearSelection()} aria-label={t.viewer.close}>
              <X size={18} />
            </button>
            <b>{selected.label}</b>
            <small>{selected.detail}</small>
          </div>
        </div>
      )}

      {/* Keyboard and screen-reader route to every labelled spot, which in the
          canvas are only reachable by pointer. Visually hidden. */}
      <ul className="hotspot-index" aria-label={t.viewer.structures}>
        {organ.hotspots.map((hotspot) => (
          <li key={hotspot.id}>
            <button type="button" onClick={() => onHotspotTap(hotspot)}>{hotspot.label}: {hotspot.detail}</button>
          </li>
        ))}
      </ul>

      {authoring && (
        <div className="authoring-panel">
          <span><Crosshair size={13} /> authoring</span>
          {authorPoint ? (
            <>
              <code>{`{ id: "", ta: "", position: [${authorPoint.x}, ${authorPoint.y}, ${authorPoint.z}], color: "#ee7c6a" },`}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`{ id: "", ta: "", position: [${authorPoint.x}, ${authorPoint.y}, ${authorPoint.z}], color: "#ee7c6a" },`)
                    .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200); });
                }}
              >
                {copied ? "copied" : "copy"}
              </button>
            </>
          ) : (
            <code>click the model to sample a point</code>
          )}
        </div>
      )}

      {loading && slowLoad && (
        <div className="model-loader" role="status" aria-live="polite">
          <div className="loader-orbit"><Maximize2 size={24} /></div>
          <strong>{format(t.viewer.loading, { organ: organ.name })}</strong>
          <span>{toBanglaDigits(Math.max(8, Math.round(progress * 100)))}%</span>
        </div>
      )}
    </section>
  );
}
