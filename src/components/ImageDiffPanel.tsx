import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useGpuixRequired,
  useWindowSize,
  type EventPayload,
  type PublicInstance,
} from "@gpuix/react";
import { T, Spinner, ViewSwitcher, Slider, useAdwaita } from "adwaita-gpuix";
import { getImageSides, type ImageSides } from "../images";

type Mode = "side" | "onion" | "split";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function ImageDiffPanel({
  changeId,
  path,
}: {
  changeId: string;
  path: string;
}) {
  const t = useAdwaita();
  const { colors } = t;
  const renderer = useGpuixRequired();

  const [sides, setSides] = useState<ImageSides | null>(null);
  const [mode, setMode] = useState<Mode>("side");
  const [opacity, setOpacity] = useState(50);
  const [split, setSplit] = useState(0.5);
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef<PublicInstance>(null);
  const { width: winW, height: winH } = useWindowSize();

  const drag = useRef<{
    x: number;
    y: number;
    split: number;
    scaleW: number;
    scaleH: number;
  }>({
    x: 0,
    y: 0,
    split: 0.5,
    scaleW: 0,
    scaleH: 0,
  });

  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    let alive = true;
    setSides(null);
    void getImageSides(changeId, path).then((s) => {
      if (alive) setSides(s);
    });
    return () => {
      alive = false;
    };
  }, [changeId, path]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = (attempts: number) => {
      if (cancelled) return;
      const b = renderer.getElementBounds?.(el.id);
      if (b && (b.width > 0 || b.height > 0)) {
        setBox({ w: b.width, h: b.height });
        return;
      }
      if (attempts > 0) timer = setTimeout(() => measure(attempts - 1), 50);
    };
    measure(20);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [renderer, winW, winH, mode, sides]);

  const measureBox = () => {
    const el = containerRef.current;
    if (!el) return null;
    return renderer.getElementBounds?.(el.id) ?? null;
  };

  const w = box.w;
  const h = box.h;

  const views = [
    { id: "side", label: "Side", icon: "panel" as const },
    { id: "onion", label: "Onion", icon: "layers" as const },
    { id: "split", label: "Split", icon: "eye" as const },
  ];

  const renderLoading = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.view_bg,
      }}
    >
      <Spinner size={32} />
      <T size="caption" color={colors.dim_fg} style={{ marginTop: 8 }}>
        loading…
      </T>
    </div>
  );

  if (!sides) {
    return renderLoading();
  }

  const renderPlaceholder = (label: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.headerbar_bg,
        borderRadius: 6,
      }}
    >
      <T size="caption" color={colors.dim_fg}>
        {label}
      </T>
    </div>
  );

  const imageCell = (
    label: string,
    src: string | undefined,
    missing: string,
    padded: boolean,
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
        ...(padded ? { padding: 8 } : null),
        gap: 6,
      }}
    >
      <T size="caption" color={colors.dim_fg} style={{ paddingLeft: 4 }}>
        {label}
      </T>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          minWidth: 0,
          backgroundColor: colors.headerbar_bg,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {src ? (
          <img
            src={src}
            objectFit="contain"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          renderPlaceholder(missing)
        )}
      </div>
    </div>
  );

  const renderCell = (label: string, src: string | undefined, missing: string) =>
    imageCell(label, src, missing, false);

  const hasOld = !!sides.old;
  const hasNext = !!sides.next;

  const size = sides.nextSize ?? sides.oldSize;
  const axis: "v" | "h" = size ? (size.width >= size.height ? "v" : "h") : "v";

  const renderSingle = (label: string, src: string) =>
    imageCell(label, src, "", true);

  const splitStyles = (
    ax: "v" | "h",
    sp: number,
    bw: number,
    bh: number,
  ) => {
    const dividerX = sp * bw;
    const dividerY = sp * bh;
    const clipStyle =
      ax === "v"
        ? {
            position: "absolute" as const,
            top: 0,
            left: dividerX,
            width: (1 - sp) * bw,
            height: "100%",
            overflow: "hidden" as const,
          }
        : {
            position: "absolute" as const,
            left: 0,
            top: dividerY,
            width: "100%",
            height: (1 - sp) * bh,
            overflow: "hidden" as const,
          };
    const innerStyle =
      ax === "v"
        ? {
            position: "absolute" as const,
            top: 0,
            left: -dividerX,
            width: bw,
            height: bh,
          }
        : {
            position: "absolute" as const,
            left: 0,
            top: -dividerY,
            width: bw,
            height: bh,
          };

    const dividerStyle =
      ax === "v"
        ? {
            position: "absolute" as const,
            top: 0,
            left: dividerX - 6,
            width: 12,
            height: "100%",
            backgroundColor: "transparent",
            cursor: "col-resize" as const,
          }
        : {
            position: "absolute" as const,
            left: 0,
            top: dividerY - 6,
            width: "100%",
            height: 12,
            backgroundColor: "transparent",
            cursor: "row-resize" as const,
          };
    const accentStyle =
      ax === "v"
        ? {
            position: "absolute" as const,
            top: 0,
            left: 4,
            width: 4,
            height: "100%",
            backgroundColor: colors.accent,
            pointerEvents: "none" as const,
          }
        : {
            position: "absolute" as const,
            left: 0,
            top: 4,
            width: "100%",
            height: 4,
            backgroundColor: colors.accent,
            pointerEvents: "none" as const,
          };
    return { clipStyle, innerStyle, dividerStyle, accentStyle };
  };

  const { clipStyle, innerStyle, dividerStyle, accentStyle } = splitStyles(
    axis,
    split,
    w,
    h,
  );

  const onSplitDragStart = (e: EventPayload) => {
    const b = measureBox();
    drag.current = {
      x: e.x ?? 0,
      y: e.y ?? 0,
      split,
      scaleW: b && b.width > 0 ? b.width : winW,
      scaleH: b && b.height > 0 ? b.height : winH,
    };
    setDragging(true);
  };

  const onSplitDragMove = (e: EventPayload) => {
    const d = drag.current;
    if (axis === "v") {
      if (d.scaleW > 0)
        setSplit(clamp01(d.split + ((e.x ?? 0) - d.x) / d.scaleW));
    } else if (d.scaleH > 0) {
      setSplit(clamp01(d.split + ((e.y ?? 0) - d.y) / d.scaleH));
    }
  };

  const renderSide = () =>
    hasOld && hasNext ? (
      <div
        style={{
          display: "flex",

          flexDirection: axis === "v" ? "column" : "row",
          flexGrow: 1,
          minHeight: 0,
          gap: 8,
          padding: 8,
        }}
      >
        {renderCell("before", sides.old, "")}
        {renderCell("after", sides.next, "")}
      </div>
    ) : hasNext ? (
      renderSingle("after", sides.next as string)
    ) : hasOld ? (
      renderSingle("before", sides.old as string)
    ) : null;

  const renderStage = (
    children: ReactNode,
    ref?: { current: PublicInstance | null },
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        padding: 8,
      }}
    >
      <div
        ref={ref}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          backgroundColor: colors.headerbar_bg,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );

  const renderFallback = () =>
    hasNext
      ? renderSingle("after", sides.next as string)
      : hasOld
        ? renderSingle("before", sides.old as string)
        : null;

  const overlayImg = (src: string | undefined, extra?: { opacity?: number }) => (
    <img
      src={src}
      objectFit="contain"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        ...(extra ? { opacity: extra.opacity } : null),
      }}
    />
  );

  const renderOnion = () =>
    hasOld && hasNext
      ? renderStage(
          <>
            {overlayImg(sides.next)}
            {overlayImg(sides.old, { opacity: opacity / 100 })}
          </>,
        )
      : renderFallback();

  const renderSplitBody = () =>
    hasOld && hasNext
      ? renderStage(
          <>
            {overlayImg(sides.old)}
            {(axis === "v" ? w > 0 : h > 0) && (
              <div style={clipStyle}>
                <img src={sides.next} objectFit="contain" style={innerStyle} />
              </div>
            )}
            <div onMouseDown={onSplitDragStart} style={dividerStyle}>
              <div style={accentStyle} />
            </div>
            {dragging && (
              <div
                onMouseMove={onSplitDragMove}
                onMouseUp={() => setDragging(false)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  backgroundColor: "transparent",
                }}
              />
            )}
          </>,
          containerRef,
        )
      : renderFallback();

  const side = renderSide();
  const onion = renderOnion();
  const splitBody = renderSplitBody();

  return (
    <div
      onMouseUp={() => setDragging(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        backgroundColor: colors.view_bg,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.headerbar_bg,
        }}
      >
        <ViewSwitcher
          items={views}
          value={mode}
          onChange={(id) => setMode(id as Mode)}
          showLabels={false}
        />
        <div style={{ flexGrow: 1 }} />
        {mode === "onion" && hasOld && hasNext && (
          <Slider
            value={opacity}
            min={0}
            max={100}
            step={1}
            width={120}
            onValueChange={(v) =>
              setOpacity(typeof v === "number" ? v : opacity)
            }
          />
        )}
      </div>

      {mode === "side" && side}
      {mode === "onion" && onion}
      {mode === "split" && splitBody}
    </div>
  );
}
