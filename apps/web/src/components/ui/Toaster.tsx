import * as React from "react";
import * as Toast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ToastData {
  id: string;
  title: string;
  description?: string;
  type?: "default" | "success" | "error";
}

interface ToasterContextValue {
  toast: (data: Omit<ToastData, "id">) => void;
}

const ToasterContext = React.createContext<ToasterContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToasterContext);
  if (!context) {
    throw new Error("useToast must be used within a Toaster");
  }
  return context;
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = React.useCallback((data: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...data, id }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToasterContext.Provider value={{ toast }}>
      {children}
      <Toast.Provider swipeDirection="right">
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            className={cn(
              "group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
              "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=open]:animate-slide-up data-[state=closed]:animate-fade-out",
              t.type === "error"
                ? "border-destructive bg-destructive text-destructive-foreground"
                : t.type === "success"
                  ? "border-green-500 bg-green-500/10 text-green-500"
                  : "border-border bg-card text-card-foreground"
            )}
            onOpenChange={(open) => {
              if (!open) removeToast(t.id);
            }}
          >
            <div className="grid gap-1">
              <Toast.Title className="text-sm font-semibold">
                {t.title}
              </Toast.Title>
              {t.description && (
                <Toast.Description className="text-sm opacity-90">
                  {t.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close className="rounded-md p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100">
              <X className="h-4 w-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]" />
      </Toast.Provider>
    </ToasterContext.Provider>
  );
}
