"use client";

import { useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "cn";

type Point = { x: number; y: number };

type SignaturePadProps = {
  /** Called with a PNG data URL after each stroke, or null when the pad is empty. */
  onChange: (dataUrl: string | null) => void;
  height?: number;
  className?: string;
};

const STROKE_WIDTH = 2.5;
const STROKE_COLOR = "#111111";

export function SignaturePad({ onChange, height = 220, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const activePointerRef = useRef<number | null>(null);

  const prepareContext = useCallback((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return null;

    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = STROKE_WIDTH;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = STROKE_COLOR;
    context.fillStyle = STROKE_COLOR;
    return context;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = prepareContext(canvas);
    if (!context) return;

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();

    for (const stroke of strokesRef.current) {
      if (stroke.length === 1) {
        context.beginPath();
        context.arc(stroke[0].x, stroke[0].y, STROKE_WIDTH / 2, 0, Math.PI * 2);
        context.fill();
        continue;
      }

      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) {
        context.lineTo(point.x, point.y);
      }
      context.stroke();
    }
  }, [prepareContext]);

  // Keep the backing store in sync with the displayed size (and device pixel ratio).
  // Resizing clears a canvas, so the strokes are replayed afterwards.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(height * ratio);
      redraw();
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [height, redraw]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== null) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    strokesRef.current.push([pointFromEvent(event)]);
    redraw();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) return;

    const stroke = strokesRef.current[strokesRef.current.length - 1];
    const previous = stroke[stroke.length - 1];
    const next = pointFromEvent(event);
    stroke.push(next);

    const context = prepareContext(event.currentTarget);
    if (!context) return;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(next.x, next.y);
    context.stroke();
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) return;

    activePointerRef.current = null;
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function handleClear() {
    strokesRef.current = [];
    redraw();
    onChange(null);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative overflow-hidden rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          style={{ height }}
          className="block w-full cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          aria-label="Area per la firma"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-neutral-300" />
        <span className="pointer-events-none absolute bottom-2 left-6 text-xs text-neutral-400">
          Firma qui
        </span>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Pulisci
        </Button>
      </div>
    </div>
  );
}
