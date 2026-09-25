import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, UserPlus } from "lucide-react";
import { useKiosk } from "../contexts/KioskContext";
import { Card, CardContent } from "../components/ui/Card";
import { api } from "../services/api";
import { appBasePath } from "../lib/cloud";

export function KioskJoinPage() {
  const { token, settings } = useKiosk();

  // The QR carries a join code, never the kiosk's token: the token can be
  // exchanged for the owner's API key, so anyone who scanned it would control
  // the household's account. A join code only lets them ask to join.
  const { data: joinCode, isError } = useQuery({
    queryKey: ["kiosk-join-code", token],
    queryFn: () => api.getKioskJoinCode(token!),
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const baseUrl = settings.externalUrl?.replace(/\/+$/, "") || `${window.location.origin}${appBasePath}`;
  const joinUrl = joinCode ? `${baseUrl}/join/${encodeURIComponent(joinCode)}` : null;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Join This Kiosk</h2>
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your phone to request access to this kiosk's calendar, tasks, and more.
            </p>
          </div>
          <div className="flex h-[252px] w-[252px] items-center justify-center rounded-xl bg-white p-4">
            {joinUrl ? (
              <QRCodeSVG value={joinUrl} size={220} />
            ) : isError ? (
              <p className="text-center text-sm text-gray-600">Couldn't load the join code. Try again later.</p>
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            After scanning, sign in or create an account. The kiosk owner will be notified of your request.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
