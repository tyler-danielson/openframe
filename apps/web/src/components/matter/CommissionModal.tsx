import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, AlertCircle, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { api } from "../../services/api";

interface CommissionModalProps {
  open: boolean;
  onClose: () => void;
}

export function CommissionModal({ open, onClose }: CommissionModalProps) {
  const queryClient = useQueryClient();
  const [pairingCode, setPairingCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commissionMutation = useMutation({
    mutationFn: () =>
      api.commissionMatterDevice({
        pairingCode: pairingCode.trim(),
        displayName: displayName.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matter-devices"] });
      queryClient.invalidateQueries({ queryKey: ["matter-status"] });
      setPairingCode("");
      setDisplayName("");
      setError(null);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to commission device");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pairingCode.trim()) {
      setError("Pairing code is required");
      return;
    }
    commissionMutation.mutate();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Add Matter Device</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pairing Code */}
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Pairing Code
            </label>
            <input
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              placeholder="Manual code (digits) or QR string (MT:...)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              disabled={commissionMutation.isPending}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter the 11/21-digit manual code or the QR code string from your device
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-primary/80 mb-1">
              Display Name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Living Room Light"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              disabled={commissionMutation.isPending}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={commissionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={commissionMutation.isPending || !pairingCode.trim()}
            >
              {commissionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Commissioning...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Device
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
