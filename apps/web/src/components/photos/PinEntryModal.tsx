import { useState, useCallback } from "react";
import { X, Delete } from "lucide-react";

interface PinEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin: string;
}

export function PinEntryModal({ isOpen, onClose, onSuccess, correctPin }: PinEntryModalProps) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = useCallback((d: string) => {
    setError(false);
    setDigits((prev) => {
      const next = prev + d;
      if (next.length === correctPin.length) {
        if (next === correctPin) {
          // Delay slightly so the last dot renders before modal closes
          setTimeout(() => {
            setDigits("");
            onSuccess();
          }, 150);
        } else {
          setTimeout(() => {
            setError(true);
            setDigits("");
          }, 150);
        }
      }
      return next.length <= correctPin.length ? next : prev;
    });
  }, [correctPin, onSuccess]);

  const handleBackspace = useCallback(() => {
    setError(false);
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  const handleClose = useCallback(() => {
    setDigits("");
    setError(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Enter PIN</h2>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-accent transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-4 py-8">
          {Array.from({ length: correctPin.length }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all ${
                error
                  ? "border-destructive bg-destructive animate-[shake_0.3s_ease-in-out]"
                  : i < digits.length
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-destructive -mt-4 mb-2">Incorrect PIN</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 px-8 pb-8">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="h-16 rounded-xl bg-accent/50 text-2xl font-semibold text-foreground hover:bg-primary/20 active:bg-primary/30 transition-colors"
            >
              {d}
            </button>
          ))}
          <div /> {/* empty cell */}
          <button
            onClick={() => handleDigit("0")}
            className="h-16 rounded-xl bg-accent/50 text-2xl font-semibold text-foreground hover:bg-primary/20 active:bg-primary/30 transition-colors"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-16 rounded-xl bg-accent/50 flex items-center justify-center text-muted-foreground hover:bg-primary/20 active:bg-primary/30 transition-colors"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
