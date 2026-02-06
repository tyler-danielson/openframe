import { useRef, useState, useEffect, useCallback } from "react";
import { X, Undo2, Trash2, Check, Loader2 } from "lucide-react";
import { recognizeWithAI, preloadWorker } from "../../services/handwriting";

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: Point[];
}

type TimeoutId = ReturnType<typeof setTimeout>;

interface HandwritingCanvasProps {
  onRecognized: (text: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
}

export function HandwritingCanvas({
  onRecognized,
  onCancel,
  placeholder = "Write here...",
  className = "",
}: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSubmitTimerRef = useRef<TimeoutId | null>(null);

  // Preload Tesseract worker when component mounts
  useEffect(() => {
    preloadWorker();
  }, []);

  // Set up canvas with proper DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    redrawCanvas();
  }, []);

  // Redraw canvas whenever strokes change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Set up stroke style
    ctx.strokeStyle = "#1f2937"; // text-foreground
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw all completed strokes
    for (const stroke of strokes) {
      drawStroke(ctx, stroke.points);
    }

    // Draw current stroke
    if (currentStroke.length > 0) {
      drawStroke(ctx, currentStroke);
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Draw a single stroke with smooth curves
  const drawStroke = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length === 0) return;

    const firstPoint = points[0];
    if (!firstPoint) return;

    if (points.length === 1) {
      // Single point - draw a dot
      const size = 4 + firstPoint.pressure * 6;
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Draw smooth curve using quadratic bezier
    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (!p1 || !p2) continue;

      // Line width based on pressure (doubled for larger strokes)
      ctx.lineWidth = 4 + p1.pressure * 8;

      // Calculate midpoint for smooth curve
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }

    // Draw to last point
    const last = points[points.length - 1];
    if (last) {
      ctx.lineWidth = 4 + last.pressure * 8;
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  };

  // Get pointer position relative to canvas
  const getPointerPos = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    };
  };

  // Handle pointer events
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRecognizing) return;

    e.preventDefault();
    setIsDrawing(true);
    setError(null);

    const point = getPointerPos(e);
    setCurrentStroke([point]);

    // Cancel auto-submit timer when starting new stroke
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || isRecognizing) return;

    e.preventDefault();
    const point = getPointerPos(e);
    setCurrentStroke((prev) => [...prev, point]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing || isRecognizing) return;

    e.preventDefault();
    setIsDrawing(false);

    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, { points: currentStroke }]);
      setCurrentStroke([]);

      // Start auto-submit timer (2 seconds of no drawing)
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
      autoSubmitTimerRef.current = setTimeout(() => {
        handleRecognize();
      }, 2000);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (isDrawing) {
      handlePointerUp(e);
    }
  };

  // Undo last stroke
  const handleUndo = () => {
    if (isRecognizing) return;
    setStrokes((prev) => prev.slice(0, -1));

    // Reset auto-submit timer
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  };

  // Clear all strokes
  const handleClear = () => {
    if (isRecognizing) return;
    setStrokes([]);
    setCurrentStroke([]);
    setError(null);

    // Reset auto-submit timer
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  };

  // Recognize text from canvas
  const handleRecognize = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // Cancel auto-submit timer
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }

    setIsRecognizing(true);
    setError(null);

    try {
      // Create a temporary canvas with white background for better OCR
      const tempCanvas = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;

      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("Could not get canvas context");

      // White background
      tempCtx.fillStyle = "#ffffff";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw strokes in black for better contrast
      tempCtx.scale(dpr, dpr);
      tempCtx.strokeStyle = "#000000";
      tempCtx.fillStyle = "#000000";
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";

      for (const stroke of strokes) {
        drawStrokeOnContext(tempCtx, stroke.points);
      }

      const imageDataUrl = tempCanvas.toDataURL("image/png");
      const result = await recognizeWithAI(imageDataUrl);

      if (!result.text || result.text.length === 0) {
        setError("Could not recognize text. Please try again.");
        setIsRecognizing(false);
        return;
      }

      onRecognized(result.text);
    } catch (err) {
      console.error("Recognition error:", err);
      setError("Recognition failed. Please try again.");
      setIsRecognizing(false);
    }
  };

  // Helper to draw stroke on any context
  const drawStrokeOnContext = (
    ctx: CanvasRenderingContext2D,
    points: Point[]
  ) => {
    if (points.length === 0) return;

    const firstPoint = points[0];
    if (!firstPoint) return;

    if (points.length === 1) {
      const size = 6 + firstPoint.pressure * 8;
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (!p1 || !p2) continue;

      ctx.lineWidth = 6 + p1.pressure * 10;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }

    const last = points[points.length - 1];
    if (last) {
      ctx.lineWidth = 6 + last.pressure * 10;
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
    };
  }, []);

  const hasContent = strokes.length > 0;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 rounded-lg border-2 border-dashed border-border bg-white overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerUp}
        />

        {/* Placeholder */}
        {!hasContent && !isRecognizing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground text-lg">{placeholder}</span>
          </div>
        )}

        {/* Loading overlay */}
        {isRecognizing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Recognizing...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-red-500 text-center">{error}</div>
      )}

      {/* Controls */}
      <div className="mt-4 flex items-center justify-between">
        {/* Left side: Cancel */}
        <button
          onClick={onCancel}
          disabled={isRecognizing}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
          <span>Cancel</span>
        </button>

        {/* Center: Clear & Undo */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            disabled={!hasContent || isRecognizing}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-5 w-5" />
            <span>Clear</span>
          </button>
          <button
            onClick={handleUndo}
            disabled={!hasContent || isRecognizing}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Undo2 className="h-5 w-5" />
            <span>Undo</span>
          </button>
        </div>

        {/* Right side: Done */}
        <button
          onClick={handleRecognize}
          disabled={!hasContent || isRecognizing}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
}
