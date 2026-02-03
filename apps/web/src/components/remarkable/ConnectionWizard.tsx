import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Loader2, CheckCircle, XCircle } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface ConnectionWizardProps {
  onSuccess: () => void;
}

export function ConnectionWizard({ onSuccess }: ConnectionWizardProps) {
  const [code, setCode] = useState("");

  const connect = useMutation({
    mutationFn: (code: string) => api.connectRemarkable(code),
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 8) {
      connect.mutate(code);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">How to connect:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>
            Go to{" "}
            <a
              href="https://my.remarkable.com/device/desktop/connect"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              my.remarkable.com/device/desktop/connect
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>Sign in with your reMarkable account</li>
          <li>Copy the 8-character one-time code</li>
          <li>Paste the code below and click Connect</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium mb-1">
            One-time code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="ABCD1234"
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-center text-lg font-mono tracking-widest uppercase"
            maxLength={8}
            autoComplete="off"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1">
            8 characters, letters and numbers
          </p>
        </div>

        {connect.isError && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>
              {connect.error instanceof Error
                ? connect.error.message
                : "Failed to connect"}
            </span>
          </div>
        )}

        {connect.isSuccess && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>Successfully connected to reMarkable!</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={code.length !== 8 || connect.isPending}
        >
          {connect.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </form>
    </div>
  );
}
