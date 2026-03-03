import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
  Clock,
} from "lucide-react";
import type { SetupGuideData } from "../../data/setup-guides";

interface SetupGuideProps {
  guide: SetupGuideData;
  externalUrl?: string;
  defaultExpanded?: boolean;
}

export function SetupGuide({ guide, externalUrl, defaultExpanded = false }: SetupGuideProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copiedUri, setCopiedUri] = useState<string | null>(null);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedUri(text);
    setTimeout(() => setCopiedUri(null), 2000);
  }

  // Compute redirect URIs from external URL
  const computedRedirectUris = guide.redirectUris && externalUrl
    ? (() => {
        const base = externalUrl.replace(/\/+$/, "");
        const isPrivateIp = /^https?:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(base);

        const origins: { label: string; base: string }[] = [];
        if (isPrivateIp) {
          try {
            const parsed = new URL(base);
            const localhostBase = `${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ""}`;
            origins.push({ label: "Localhost", base: localhostBase });
          } catch {
            // ignore
          }
        } else if (/^https?:\/\/localhost/.test(base)) {
          origins.push({ label: "Localhost", base });
        } else {
          origins.push({ label: base.replace(/^https?:\/\//, ""), base });
          origins.push({ label: "Localhost (dev)", base: "http://localhost:5176" });
        }

        return { origins, isPrivateIp };
      })()
    : null;

  return (
    <div className="rounded-lg border border-primary/20 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary truncate">
            How to get your {guide.consoleName} credentials
          </span>
          {guide.estimatedTime && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary shrink-0">
              <Clock className="h-3 w-3" />
              {guide.estimatedTime}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-primary shrink-0" />
        )}
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4 border-t border-primary/10">
              {/* Numbered steps */}
              <ol className="space-y-3">
                {guide.steps.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    {/* Step number badge */}
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="space-y-1.5 min-w-0">
                      {/* Main instruction */}
                      <p className="text-sm text-foreground">
                        {step.instruction}
                        {step.url && (
                          <>
                            {" "}
                            <a
                              href={step.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary underline hover:text-primary/80"
                            >
                              {step.urlLabel || "Open"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </p>
                      {/* Sub-steps */}
                      {step.substeps && (
                        <ul className="space-y-0.5 ml-1">
                          {step.substeps.map((sub, subIdx) => (
                            <li
                              key={subIdx}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <span className="text-primary/50 mt-1.5 shrink-0">•</span>
                              {sub}
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* Hint */}
                      {step.hint && (
                        <p className="text-xs text-muted-foreground italic">
                          {step.hint}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {/* Redirect URIs */}
              {computedRedirectUris && guide.redirectUris && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-sm font-medium text-primary mb-2">
                    Redirect URI{guide.redirectUris.length > 1 ? "s" : ""} to register:
                  </p>
                  {computedRedirectUris.isPrivateIp && (
                    <p className="text-xs text-destructive mb-2 flex items-start gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      Private IP detected — using localhost URIs instead.
                    </p>
                  )}
                  <div className="space-y-2">
                    {computedRedirectUris.origins.map((origin) => (
                      <div key={origin.base}>
                        {computedRedirectUris.origins.length > 1 && (
                          <p className="text-xs font-medium text-primary/80 mb-1">
                            {origin.label}
                          </p>
                        )}
                        <div className="space-y-1">
                          {guide.redirectUris!.map((ru) => {
                            const uri = `${origin.base}${ru.path}`;
                            return (
                              <div key={uri} className="flex items-center gap-1">
                                <code className="text-xs bg-muted border border-border rounded px-2 py-1 truncate block flex-1">
                                  {uri}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(uri)}
                                  className="shrink-0 rounded p-1 text-primary hover:bg-primary/10"
                                  title={`Copy ${ru.label} redirect URI`}
                                >
                                  {copiedUri === uri ? (
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gotchas */}
              {guide.gotchas && guide.gotchas.length > 0 && (
                <div className="space-y-2">
                  {guide.gotchas.map((gotcha, idx) => (
                    <div
                      key={idx}
                      className={`rounded-md p-2.5 flex items-start gap-2 text-xs ${
                        gotcha.severity === "warning"
                          ? "bg-destructive/10 border border-destructive/20 text-destructive"
                          : "bg-primary/5 border border-primary/20 text-primary"
                      }`}
                    >
                      {gotcha.severity === "warning" ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      ) : (
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      )}
                      {gotcha.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
