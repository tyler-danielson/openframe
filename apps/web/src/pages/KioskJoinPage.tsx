import { QRCodeSVG } from "qrcode.react";
import { UserPlus } from "lucide-react";
import { useKiosk } from "../contexts/KioskContext";
import { Card, CardContent } from "../components/ui/Card";

export function KioskJoinPage() {
  const { token, settings } = useKiosk();
  const baseUrl = settings.externalUrl?.replace(/\/+$/, "") || window.location.origin;
  const joinUrl = `${baseUrl}/join/${token}`;

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
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={joinUrl} size={220} />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            After scanning, sign in or create an account. The kiosk owner will be notified of your request.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
