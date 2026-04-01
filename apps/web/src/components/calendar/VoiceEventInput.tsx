import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "../../lib/utils";

interface VoiceEventInputProps {
  onTranscript: (text: string) => void;
  className?: string;
}

// Check if SpeechRecognition is available
const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function isVoiceInputAvailable(): boolean {
  return !!SpeechRecognition;
}

type VoiceState = "idle" | "listening" | "error";

export function VoiceEventInput({ onTranscript, className }: VoiceEventInputProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Voice input not supported in this browser");
      setState("error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setState("listening");
      setTranscript("");
      setError(null);
      finalTranscriptRef.current = "";
    };

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) finalTranscriptRef.current = final;
      setTranscript(final || interim);
    };

    recognition.onend = () => {
      const finalText = finalTranscriptRef.current.trim();
      setState("idle");
      if (finalText) {
        onTranscript(finalText);
        setTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setState("idle");
        return;
      }
      setError(`Voice error: ${event.error}`);
      setState("error");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const handleToggle = () => {
    if (state === "listening") {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3 py-4", className)}>
      {/* Mic button */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full transition-all touch-manipulation",
          state === "listening" && "bg-red-500 text-white shadow-lg shadow-red-500/30",
          state === "idle" && "bg-primary/10 text-primary hover:bg-primary/20",
          state === "error" && "bg-red-500/10 text-red-500 hover:bg-red-500/20"
        )}
      >
        {state === "listening" ? (
          <MicOff className="h-8 w-8" />
        ) : (
          <Mic className="h-8 w-8" />
        )}

        {/* Pulse ring while listening */}
        {state === "listening" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
        )}
      </button>

      {/* Status text */}
      <p className="text-sm text-muted-foreground text-center min-h-[1.25rem]">
        {state === "idle" && !error && "Tap to speak"}
        {state === "listening" && "Listening... tap to stop"}
        {state === "error" && (error || "Something went wrong")}
      </p>

      {/* Live transcript */}
      {transcript && state === "listening" && (
        <div className="w-full rounded-lg bg-muted/50 p-3 text-sm text-center italic text-muted-foreground">
          &ldquo;{transcript}&rdquo;
        </div>
      )}

      {/* Hint */}
      {state === "idle" && !error && (
        <p className="text-xs text-muted-foreground/60 text-center max-w-[260px]">
          Speak your event title — e.g. "Dentist appointment" or "Team lunch at noon"
        </p>
      )}

      {/* Retry on error */}
      {state === "error" && (
        <button
          type="button"
          onClick={() => { setState("idle"); setError(null); }}
          className="text-xs text-primary hover:underline touch-manipulation"
        >
          Try again
        </button>
      )}
    </div>
  );
}
