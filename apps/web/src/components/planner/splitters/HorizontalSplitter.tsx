import { useState, useCallback, useEffect } from "react";

interface HorizontalSplitterProps {
  onDrag: (deltaPixels: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function HorizontalSplitter({ onDrag, onDragStart, onDragEnd }: HorizontalSplitterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartY(e.clientY);
    onDragStart?.();
  }, [onDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY;
      setStartY(e.clientY);
      onDrag(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, startY, onDrag, onDragEnd]);

  return (
    <div
      className="flex-shrink-0 relative group cursor-row-resize print:hidden"
      style={{ height: 8 }}
      onMouseDown={handleMouseDown}
    >
      {/* Visible handle */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 rounded-full transition-colors ${
          isDragging
            ? "bg-blue-500"
            : "bg-gray-300 group-hover:bg-gray-400"
        }`}
      />
      {/* Invisible hit area */}
      <div className="absolute inset-x-0 -top-1 -bottom-1" />
    </div>
  );
}
