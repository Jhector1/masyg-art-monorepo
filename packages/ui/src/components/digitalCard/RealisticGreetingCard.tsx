// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/RealisticGreetingCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";
import { useViewportScale } from "./DigitalCardCustomizer/hooks/useViewportScale";
import { BackgroundsPanel } from "./DigitalCardCustomizer/panels/BackgroundsPanel";
import { ElementsPanel } from "./DigitalCardCustomizer/panels/ElementsPanel";
import { SelectedPanel } from "./DigitalCardCustomizer/panels/SelectedPanel";
import { CardPanel } from "./DigitalCardCustomizer/panels/CardPanel";
import { Tabs } from "./DigitalCardCustomizer/Tabs";
import { Toolbar } from "./DigitalCardCustomizer/Toolbar";
import { DesignCanvas } from "./DigitalCardCustomizer/DesignCanvas";
import type {
  DesignEl,
  EmojiEl,
  FaceKey,
  ImageEl,
  RealisticGreetingCardProps,
  TextEl,
} from "./DigitalCardCustomizer/types";
import "./realisticCard.css";

function uid(prefix = "el"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function RealisticGreetingCard({
  width = 960,
  height = 580,
}: RealisticGreetingCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Export ref
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Angles
  const [openAngle, setOpenAngle] = useState<number>(-35);
  const [bookTilt, setBookTilt] = useState<number>(165);

  // Background images
  const [frontImageURL, setFrontImageURL] = useState<string | null>(null);
  const [backImageURL, setBackImageURL] = useState<string | null>(null);
  const [insideLeftImageURL, setInsideLeftImageURL] = useState<string | null>(
    null
  );
  const [insideRightImageURL, setInsideRightImageURL] = useState<string | null>(
    null
  );

  // Opacities
  const [frontImageOpacity, setFrontImageOpacity] = useState(1);
  const [backImageOpacity, setBackImageOpacity] = useState(1);
  const [insideLeftImageOpacity, setInsideLeftImageOpacity] = useState(1);
  const [insideRightImageOpacity, setInsideRightImageOpacity] = useState(1);

  // Static label text & fonts
  const [frontText] = useState("Happy Birthday");
  const [backText] = useState("© Your Brand");
  const [insideLeftText] = useState("To: You");
  const [insideRightText] = useState("Wishing you love and joy!");
  const [frontFont] = useState("Great Vibes, cursive");
  const [insideFont] = useState("Georgia, serif");
  const [backFont] = useState("Inter, system-ui, sans-serif");

  // Card stock / view state
  const [bgColor, setBgColor] = useState("#f7f5ef");
  const [designMode, setDesignMode] = useState<boolean>(true);
  const [activeFace, setActiveFace] = useState<FaceKey>("front");

  // Layers per face
  const [layers, setLayers] = useState<Record<FaceKey, DesignEl[]>>({
    front: [],
    back: [],
    inLeft: [],
    inRight: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Face refs (for drag math)
  const faceRefs = useRef<Record<FaceKey, HTMLDivElement | null>>({
    front: null,
    back: null,
    inLeft: null,
    inRight: null,
  });

  // Responsive + Zoom (encapsulated)
  const { wrapRef, displayScale, outerH, userScale, setUserScale, fit } =
    useViewportScale(width, height);

  // Upload helper
  const uploadFaceImage = (
    e: React.ChangeEvent<HTMLInputElement>,
    which: FaceKey
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (which === "front") setFrontImageURL(url);
    else if (which === "back") setBackImageURL(url);
    else if (which === "inLeft") setInsideLeftImageURL(url);
    else setInsideRightImageURL(url);
  };

  // View quick switcher
  const showFace = useCallback((face: FaceKey) => {
    setActiveFace(face);
    if (face === "front") {
      setIsFlipped(false);
      setIsOpen(false);
    } else if (face === "back") {
      setIsFlipped(true);
      setIsOpen(false);
    } else {
      setIsFlipped(false);
      setIsOpen(true);
    }
  }, []);

  // Dragging
type DragState =
  | { kind: "move"; id: string; face: FaceKey }
  | { kind: "resize"; id: string; face: FaceKey; startClientX: number; startWidthPct: number }
  | null;
  const drag = useRef<DragState>(null);
  const getFaceRect = (face: FaceKey) =>
    faceRefs.current[face]?.getBoundingClientRect() || null;
  const pctFromClient = (clientX: number, clientY: number, face: FaceKey) => {
    const rect = getFaceRect(face);
    if (!rect) return { xPct: 0, yPct: 0 };
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return { xPct: (x / rect.width) * 100, yPct: (y / rect.height) * 100 };
  };
  // const onPointerMove = useCallback((evt: PointerEvent) => {
  //   if (!drag.current) return;
  //   const { id, face } = drag.current;
  //   const { xPct, yPct } = pctFromClient(evt.clientX, evt.clientY, face);
  //   setLayers((prev) => {
  //     const next = { ...prev };
  //     next[face] = next[face].map((el) =>
  //       el.id === id ? { ...el, xPct, yPct } : el
  //     );
  //     return next;
  //   });
  // }, []);
  const onPointerMove = useCallback((evt: PointerEvent) => {
  if (!drag.current) return;

  const state = drag.current;
  if (state.kind === "move") {
    const { id, face } = state;
    const { xPct, yPct } = pctFromClient(evt.clientX, evt.clientY, face);
    setLayers(prev => {
      const next = { ...prev };
      next[face] = next[face].map(el => el.id === id ? { ...el, xPct, yPct } : el);
      return next;
    });
  } else if (state.kind === "resize") {
    const rect = getFaceRect(state.face);
    if (!rect) return;
    const deltaPct = ((evt.clientX - state.startClientX) / rect.width) * 100;
    const newWidth = Math.max(8, Math.min(100, (state.startWidthPct + deltaPct)));
    setLayers(prev => {
      const next = { ...prev };
      next[state.face] = next[state.face].map(el =>
        el.id === state.id && el.type === "text"
          ? ({ ...el, boxWidthPct: newWidth } as DesignEl)
          : el
      );
      return next;
    });
  }
}, []);const stopDragging = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove as any);
    window.removeEventListener("pointerup", stopDragging);
  }, [onPointerMove]);



const startDragging = (e: React.PointerEvent, id: string, face: FaceKey) => {
  if (!designMode) return;
  e.stopPropagation();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  drag.current = { kind: "move", id, face };
  window.addEventListener("pointermove", onPointerMove as any);
  window.addEventListener("pointerup", stopDragging);
};

// NEW: startResizing
const startResizing = (e: React.PointerEvent, id: string, face: FaceKey) => {
  if (!designMode) return;
  e.stopPropagation();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  const el = layers[face].find(x => x.id === id) as TextEl | undefined;
  const startWidthPct = el?.boxWidthPct ?? 40;
  drag.current = { kind: "resize", id, face, startClientX: e.clientX, startWidthPct };
  window.addEventListener("pointermove", onPointerMove as any);
  window.addEventListener("pointerup", stopDragging);
};
  // Selection & keyboard
  useEffect(() => {
    if (!designMode) return;
    function onKey(e: KeyboardEvent) {
      if (!selectedId) return;
      const list = layers[activeFace];
      const el = list.find((x) => x.id === selectedId);
      if (!el) return;
      const STEP = e.shiftKey ? 2 : 0.5;
      if (e.key === "Delete" || e.key === "Backspace") {
        setLayers((prev) => {
          const next = { ...prev };
          next[activeFace] = next[activeFace].filter(
            (x) => x.id !== selectedId
          );
          return next;
        });
        setSelectedId(null);
        e.preventDefault();
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        setLayers((prev) => {
          const next = { ...prev };
          next[activeFace] = next[activeFace].map((x) =>
            x.id === selectedId
              ? {
                  ...x,
                  xPct: Math.max(
                    0,
                    Math.min(
                      100,
                      x.xPct +
                        (e.key === "ArrowRight"
                          ? STEP
                          : e.key === "ArrowLeft"
                          ? -STEP
                          : 0)
                    )
                  ),
                  yPct: Math.max(
                    0,
                    Math.min(
                      100,
                      x.yPct +
                        (e.key === "ArrowDown"
                          ? STEP
                          : e.key === "ArrowUp"
                          ? -STEP
                          : 0)
                    )
                  ),
                }
              : x
          );
          return next;
        });
        e.preventDefault();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [designMode, selectedId, activeFace, layers]);

  const selected = layers[activeFace].find((x) => x.id === selectedId) || null;

  // Mutators
  const addText = () => {
    const id = uid("txt");
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = [
        ...next[activeFace],
        {
          id,
          type: "text",
          text: "Double-click to edit",
          xPct: 50,
          yPct: 50,
          rotation: 0,
          scale: 1,
          opacity: 1,
          z: Date.now(),
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 28,
          color: "#1f2937",
          fontWeight: 600,
          fontStyle: "normal",
          align: "center",
          shadow: false,
          bg: null,
          boxWidthPct: 40,

          pad: 6,
        } as TextEl,
      ];
      return next;
    });
    setSelectedId(id);
  };
  const addEmoji = (emoji?: string) => {
    const id = uid("emo");
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = [
        ...next[activeFace],
        {
          id,
          type: "emoji",
          emoji: emoji || "🎉",
          xPct: 40,
          yPct: 40,
          rotation: 0,
          scale: 1,
          opacity: 1,
          z: Date.now(),
          fontSize: 56,
        } as EmojiEl,
      ];
      return next;
    });
    setSelectedId(id);
  };
  const addStickerImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const id = uid("img");
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = [
        ...next[activeFace],
        {
          id,
          type: "image",
          url,
          xPct: 60,
          yPct: 50,
          rotation: 0,
          scale: 1,
          opacity: 1,
          z: Date.now(),
          widthPct: 30,
          aspect: null,
        } as ImageEl,
      ];
      return next;
    });
    setSelectedId(id);
  };
  const updateSelected = <K extends keyof DesignEl>(
    key: K,
    value: DesignEl[K]
  ) => {
    if (!selected) return;
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = next[activeFace].map((x) =>
        x.id === selected.id ? ({ ...(x as any), [key]: value } as any) : x
      );
      return next;
    });
  };
  const updateSelectedText = <K extends keyof TextEl>(
    key: K,
    value: TextEl[K]
  ) => {
    if (!selected || selected.type !== "text") return;
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = next[activeFace].map((x) =>
        x.id === selected.id ? ({ ...(x as any), [key]: value } as any) : x
      );
      return next;
    });
  };
  const bringFwd = () => selected && updateSelected("z", Date.now());
  const sendBack = () =>
    selected &&
    setLayers((prev) => {
      const next = { ...prev };
      const minZ = next[activeFace].length
        ? Math.min(...next[activeFace].map((x) => x.z))
        : 0;
      next[activeFace] = next[activeFace].map((x) =>
        x.id === selected!.id ? { ...x, z: minZ - 1 } : x
      );
      return next;
    });
  const duplicate = () => {
    if (!selected) return;
    const copy: DesignEl = {
      ...(selected as any),
      id: uid(selected.type),
      xPct: Math.min(100, selected.xPct + 4),
      yPct: Math.min(100, selected.yPct + 4),
      z: Date.now(),
    } as DesignEl;
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = [...next[activeFace], copy];
      return next;
    });
    setSelectedId(copy.id);
  };
  const deleteSel = () => {
    if (!selected) return;
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = next[activeFace].filter((x) => x.id !== selected.id);
      return next;
    });
    setSelectedId(null);
  };

  // Text content update from contentEditable
  const updateTextContent = (id: string, value: string) => {
    setLayers((prev) => {
      const next = { ...prev };
      next[activeFace] = next[activeFace].map((x) =>
        x.id === id && x.type === "text"
          ? ({ ...(x as any), text: value } as any)
          : x
      );
      return next;
    });
  };

  // Double-click to add text at cursor
  const onCanvasDblClick = (face: FaceKey, e: React.MouseEvent) => {
    if (!designMode) return;
    const rect = faceRefs.current[face]?.getBoundingClientRect();
    if (!rect) return;
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const id = uid("txt");
    setLayers((prev) => {
      const next = { ...prev };
      next[face] = [
        ...next[face],
        {
          id,
          type: "text",
          text: "Edit me",
          xPct,
          yPct,
          rotation: 0,
          scale: 1,
          opacity: 1,
          z: Date.now(),
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 26,
          color: "#111827",
          fontWeight: 600,
          fontStyle: "normal",
          align: "center",
          shadow: false,
          bg: null,
          pad: 6,
        } as TextEl,
      ];
      return next;
    });
    setSelectedId(id);
    setActiveFace(face);
  };

  const faceRef =
    (face: FaceKey): React.RefCallback<HTMLDivElement> =>
    (el) => {
      faceRefs.current[face] = el;
    };

  // Export current view
  const onExport = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      useCORS: true,
      scale: 2,
    });
    const data = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = data;
    a.download = isFlipped ? "card_outside.png" : "card_inside.png";
    a.click();
  };

  // Side panel tab
  const [propTab, setPropTab] = useState<
    "backgrounds" | "elements" | "selected" | "card"
  >("backgrounds");

  return (
    <div className="rc-root">
      <Toolbar
        designMode={designMode}
        setDesignMode={setDesignMode}
        activeFace={activeFace}
        setActiveFace={setActiveFace}
        showFace={showFace}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        isFlipped={isFlipped}
        setIsFlipped={setIsFlipped}
        userScale={userScale}
        setUserScale={setUserScale}
        fit={fit}
        onExport={onExport}
      />

      <div className="rc-layout">
        {/* Controls column */}
        <div className="rc-side">
        <Tabs current={propTab} setCurrent={setPropTab} hasSelected={!!selected} />

          {propTab === "backgrounds" && (
            <BackgroundsPanel
              frontOpacity={frontImageOpacity}
              setFrontOpacity={setFrontImageOpacity}
              backOpacity={backImageOpacity}
              setBackOpacity={setBackImageOpacity}
              inLeftOpacity={insideLeftImageOpacity}
              setInLeftOpacity={setInsideLeftImageOpacity}
              inRightOpacity={insideRightImageOpacity}
              setInRightOpacity={setInsideRightImageOpacity}
              upload={uploadFaceImage}
            />
          )}
          {propTab === "elements" && (
            <ElementsPanel
              addText={addText}
              addEmoji={addEmoji}
              addStickerImage={addStickerImage}
            />
          )}
          {propTab === "selected" && (
            <SelectedPanel
              selected={selected}
              bringFwd={bringFwd}
              sendBack={sendBack}
              deleteSel={deleteSel}
              updateSelected={updateSelected}
              updateSelectedText={updateSelectedText}
              setLayersForEmojiSize={(id, size) =>
                setLayers((prev) => {
                  const next = { ...prev };
                  next[activeFace] = next[activeFace].map((x) =>
                    x.id === id ? ({ ...(x as any), fontSize: size } as any) : x
                  );
                  return next;
                })
              }
              setLayersForEmojiChar={(id, value) =>
                setLayers((prev) => {
                  const next = { ...prev };
                  next[activeFace] = next[activeFace].map((x) =>
                    x.id === id ? ({ ...(x as any), emoji: value } as any) : x
                  );
                  return next;
                })
              }
              setLayersForImageWidth={(id, wp) =>
                setLayers((prev) => {
                  const next = { ...prev };
                  next[activeFace] = next[activeFace].map((x) =>
                    x.id === id ? ({ ...(x as any), widthPct: wp } as any) : x
                  );
                  return next;
                })
              }
            />
          )}
          {propTab === "card" && (
            <CardPanel
              bgColor={bgColor}
              setBgColor={(hex) => setBgColor(hex)}
              openAngle={openAngle}
              setOpenAngle={setOpenAngle}
              bookTilt={bookTilt}
              setBookTilt={setBookTilt}
            />
          )}
        </div>

        {/* Preview column */}
        <div className="rc-stage">
          <div
            className="p-10 rc-stagbe-inner "
            ref={wrapRef}
            style={{ height: outerH }}
          >
            <div
              id="card-preview"
              ref={cardRef}
              className={`realistic-carnd-container ${
                designMode ? "designing" : ""
              }`}
              style={{
                width,
                height,
                transform: `scale(${displayScale})`,
                transformOrigin: "top left",
              }}
              onClick={() => setIsOpen((o) => !o)}
              title="Click to peek open/close. In Design Mode, click a face to select; double-click to add text."
            >
              <div
                className={`realistic-card ${isOpen ? "open" : ""} ${
                  isFlipped ? "flipped" : ""
                }`}
                style={
                  {
                    ["--open-angle" as any]: `${openAngle}deg`,
                    ["--book-tilt" as any]: `${isFlipped ? bookTilt : 0}deg`,
                  } as React.CSSProperties
                }
              >
                <div className="card-spine" />

                {/* LEFT PANEL (outside-back / inside-left) */}
                <div
                  className="card-panel left"
                  style={{ backgroundColor: bgColor }}
                >
                  {/* OUTSIDE BACK */}
                  <div className="card-face face-outside-back">
                    <div className="face-content">
                      {backImageURL && (
                        <img
                          src={backImageURL}
                          alt="Outside Back"
                          style={{ opacity: backImageOpacity }}
                        />
                      )}
                      <div
                        className="face-text"
                        style={{ fontFamily: backFont }}
                      >
                        {backText}
                      </div>
                      {/* <div ref={faceRef("back") as any}> */}
                      <DesignCanvas
                        startResizing={startResizing}   // ← add

                        ref={faceRef("back")}
                        face="back"
                        label="Outside Back"
                        layers={layers.back}
                        activeFace={activeFace}
                        selectedId={selectedId}
                        designMode={designMode}
                        startDragging={startDragging}
                        setSelectedId={setSelectedId}
                        setActiveFace={setActiveFace}
                        onDoubleClick={onCanvasDblClick}
                        updateTextContent={updateTextContent}
                      />
                      {/* </div> */}
                    </div>
                    <div className="inner-falloff-left" />
                  </div>

                  {/* INSIDE LEFT */}
                  <div className="card-face face-inside-left">
                    <div className="face-content">
                      {insideLeftImageURL && (
                        <img
                          src={insideLeftImageURL}
                          alt="Inside Left"
                          style={{ opacity: insideLeftImageOpacity }}
                        />
                      )}
                      <div
                        className="face-text"
                        style={{ fontFamily: insideFont }}
                      >
                        {insideLeftText}
                      </div>
                      {/* <div ref={faceRef("inLeft") as any}> */}
                      <DesignCanvas
                        startResizing={startResizing}   // ← add

                        ref={faceRef("inLeft")}
                        face="inLeft"
                        label="Inside Left"
                        layers={layers.inLeft}
                        activeFace={activeFace}
                        selectedId={selectedId}
                        designMode={designMode}
                        startDragging={startDragging}
                        setSelectedId={setSelectedId}
                        setActiveFace={setActiveFace}
                        onDoubleClick={onCanvasDblClick}
                        updateTextContent={updateTextContent}
                      />
                      {/* </div> */}
                    </div>
                    <div className="inner-falloff-left" />
                  </div>
                </div>

                {/* RIGHT PANEL (outside-front / inside-right) */}
                <div
                  className="card-panel right"
                  style={{ backgroundColor: bgColor }}
                >
                  {/* OUTSIDE FRONT */}
                  <div className="card-face face-outside-front">
                    <div className="face-content">
                      {frontImageURL && (
                        <img
                          src={frontImageURL}
                          alt="Outside Front"
                          style={{ opacity: frontImageOpacity }}
                        />
                      )}
                      <div
                        className="face-text"
                        style={{ fontFamily: frontFont, fontSize: 24 }}
                      >
                        {frontText}
                      </div>
                      {/* <div ref={faceRef("front") as any}> */}
                      <DesignCanvas
                        startResizing={startResizing}   // ← add

                        ref={faceRef("front")}
                        face="front"
                        label="Outside Front"
                        layers={layers.front}
                        activeFace={activeFace}
                        selectedId={selectedId}
                        designMode={designMode}
                        startDragging={startDragging}
                        setSelectedId={setSelectedId}
                        setActiveFace={setActiveFace}
                        onDoubleClick={onCanvasDblClick}
                        updateTextContent={updateTextContent}
                      />
                      {/* </div> */}
                    </div>
                    <div className="inner-falloff-right" />
                  </div>

                  {/* INSIDE RIGHT */}
                  <div className="card-face face-inside-right">
                    <div className="face-content">
                      {insideRightImageURL && (
                        <img
                          src={insideRightImageURL}
                          alt="Inside Right"
                          style={{ opacity: insideRightImageOpacity }}
                        />
                      )}
                      <div
                        className="face-text"
                        style={{ fontFamily: insideFont }}
                      >
                        {insideRightText}
                      </div>
                      {/* <div ref={faceRef("inRight") as any}> */}
                      <DesignCanvas
                        startResizing={startResizing}   // ← add

                        ref={faceRef("inRight")}
                        face="inRight"
                        label="Inside Right"
                        layers={layers.inRight}
                        activeFace={activeFace}
                        selectedId={selectedId}
                        designMode={designMode}
                        startDragging={startDragging}
                        setSelectedId={setSelectedId}
                        setActiveFace={setActiveFace}
                        onDoubleClick={onCanvasDblClick}
                        updateTextContent={updateTextContent}
                      />
                      {/* </div> */}
                    </div>
                    <div className="inner-falloff-right" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <small className="rc-hint center">
            Tip: Ctrl/Cmd + trackpad pinch to zoom. Drag to move items.
            Shift+Arrows = bigger nudge. ⌘/Ctrl+D = duplicate.
          </small>
        </div>
      </div>
    </div>
  );
}
