import { useState, useCallback, useEffect } from "react";

interface VerticalSplitterProps {
  onDrag: (deltaPixels: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function VerticalSplitter({ onDrag, onDragStart, onDragEnd }: VerticalSplitterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
    onDragStart?.();
  }, [onDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setStartX(e.clientX);
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
  }, [isDragging, startX, onDrag, onDragEnd]);

  return (
    <div
      className="flex-shrink-0 relative group cursor-col-resize print:hidden"
      style={{ width: 8 }}
      onMouseDown={handleMouseDown}
    >
      {/* Visible handle */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors ${
          isDragging
            ? "bg-blue-500"
            : "bg-gray-300 group-hover:bg-gray-400"
        }`}
      />
      {/* Invisible hit area */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
