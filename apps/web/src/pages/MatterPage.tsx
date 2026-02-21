import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Plus,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { MatterDeviceCard } from "../components/matter/MatterDeviceCard";
import { CommissionModal } from "../components/matter/CommissionModal";
import { api } from "../services/api";

export function MatterPage() {
  const queryClient = useQueryClient();
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Fetch controller status
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["matter-status"],
    queryFn: api.getMatterStatus.bind(api),
  });

  // Fetch devices
  const {
    data: devices = [],
    isLoading: isLoadingDevices,
  } = useQuery({
    queryKey: ["matter-devices"],
    queryFn: api.getMatterDevices.bind(api),
    refetchInterval: 10000,
  });

  // Decommission mutation
  const decommissionMutation = useMutation({
    mutationFn: (id: string) => api.decommissionMatterDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matter-devices"] });
      queryClient.invalidateQueries({ queryKey: ["matter-status"] });
      setConfirmDelete(null);
    },
  });

  const isLoading = isLoadingStatus || isLoadingDevices;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Matter Devices</h1>
            <p className="text-sm text-muted-foreground">
              Control smart home devices directly via Matter protocol
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowCommissionModal(true)}
          disabled={!status?.initialized}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </div>

      {/* Status Banner */}
      {status && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
            status.initialized
              ? "bg-primary/5 border-primary/20 text-primary"
              : "bg-accent/5 border-accent/20 text-accent-foreground"
          }`}
        >
          {status.initialized ? (
            <Wifi className="w-4 h-4 flex-shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm">
            {status.initialized
              ? `Matter controller online — ${status.deviceCount} device${status.deviceCount !== 1 ? "s" : ""} commissioned`
              : "Matter controller offline — IPv6 or mDNS may not be available on this network"}
          </span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && devices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Cpu className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-primary mb-2">No Matter Devices</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Commission your first Matter device to start controlling smart home devices
            directly from OpenFrame — no hub required.
          </p>
          {status?.initialized && (
            <Button onClick={() => setShowCommissionModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Device
            </Button>
          )}
        </div>
      )}

      {/* Device Grid */}
      {!isLoading && devices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map((device) => (
            <div key={device.id} className="relative group">
              <MatterDeviceCard device={device} />

              {/* Delete button */}
              <button
                onClick={() => setConfirmDelete(device.id)}
                className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                title="Remove device"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Commission Modal */}
      <CommissionModal
        open={showCommissionModal}
        onClose={() => setShowCommissionModal(false)}
      />

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(null);
          }}
        >
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary">Remove Device?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will decommission the device from your Matter fabric and remove it
                  from OpenFrame. The device will need to be factory reset before re-pairing.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={decommissionMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => decommissionMutation.mutate(confirmDelete)}
                disabled={decommissionMutation.isPending}
              >
                {decommissionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
