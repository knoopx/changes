import { useEffect, useRef, useState } from "react";
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

  if (!sides) {
    return (
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
  }

  const placeholder = (label: string) => (
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

  const cell = (label: string, src: string | undefined, missing: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
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
          placeholder(missing)
        )}
      </div>
    </div>
  );

  const hasOld = !!sides.old;
  const hasNext = !!sides.next;

  const size = sides.nextSize ?? sides.oldSize;
  const axis: "v" | "h" = size ? (size.width >= size.height ? "v" : "h") : "v";

  const single = (label: string, src: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        padding: 8,
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
        <img
          src={src}
          objectFit="contain"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );

  const side =
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
        {cell("before", sides.old, "")}
        {cell("after", sides.next, "")}
      </div>
    ) : hasNext ? (
      single("after", sides.next as string)
    ) : hasOld ? (
      single("before", sides.old as string)
    ) : null;

  const onion =
    hasOld && hasNext ? (
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
          {}
          <img
            src={sides.next}
            objectFit="contain"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          />
          {}
          <img
            src={sides.old}
            objectFit="contain"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: opacity / 100,
            }}
          />
        </div>
      </div>
    ) : hasNext ? (
      single("after", sides.next as string)
    ) : hasOld ? (
      single("before", sides.old as string)
    ) : null;

  const dividerX = split * w;
  const dividerY = split * h;
  const clipStyle =
    axis === "v"
      ? {
          position: "absolute" as const,
          top: 0,
          left: dividerX,
          width: (1 - split) * w,
          height: "100%",
          overflow: "hidden" as const,
        }
      : {
          position: "absolute" as const,
          left: 0,
          top: dividerY,
          width: "100%",
          height: (1 - split) * h,
          overflow: "hidden" as const,
        };
  const innerStyle =
    axis === "v"
      ? {
          position: "absolute" as const,
          top: 0,
          left: -dividerX,
          width: w,
          height: h,
        }
      : {
          position: "absolute" as const,
          left: 0,
          top: -dividerY,
          width: w,
          height: h,
        };

  const dividerStyle =
    axis === "v"
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
    axis === "v"
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
  const splitBody =
    hasOld && hasNext ? (
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
          ref={containerRef}
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
          {}
          <img
            src={sides.old}
            objectFit="contain"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          />
          {}
          {(axis === "v" ? w > 0 : h > 0) && (
            <div style={clipStyle}>
              <img src={sides.next} objectFit="contain" style={innerStyle} />
            </div>
          )}
          {}
          <div
            onMouseDown={(e: EventPayload) => {
              const b = measureBox();
              drag.current = {
                x: e.x ?? 0,
                y: e.y ?? 0,
                split,
                scaleW: b && b.width > 0 ? b.width : winW,
                scaleH: b && b.height > 0 ? b.height : winH,
              };
              setDragging(true);
            }}
            style={dividerStyle}
          >
            <div style={accentStyle} />
          </div>
          {}
          {dragging && (
            <div
              onMouseMove={(e: EventPayload) => {
                const d = drag.current;
                if (axis === "v") {
                  if (d.scaleW > 0)
                    setSplit(clamp01(d.split + ((e.x ?? 0) - d.x) / d.scaleW));
                } else if (d.scaleH > 0) {
                  setSplit(clamp01(d.split + ((e.y ?? 0) - d.y) / d.scaleH));
                }
              }}
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
        </div>
      </div>
    ) : hasNext ? (
      single("after", sides.next as string)
    ) : hasOld ? (
      single("before", sides.old as string)
    ) : null;

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
      {}
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
