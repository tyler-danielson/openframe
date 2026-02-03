import { format, addDays, subDays } from "date-fns";
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface AgendaPreviewProps {
  date: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
}

export function AgendaPreview({ date, onDateChange, onClose }: AgendaPreviewProps) {
  const previewUrl = api.getRemarkableAgendaPreviewUrl(date);
  const currentDate = new Date(date);

  const goToPreviousDay = () => {
    const prev = subDays(currentDate, 1);
    onDateChange(format(prev, "yyyy-MM-dd"));
  };

  const goToNextDay = () => {
    const next = addDays(currentDate, 1);
    onDateChange(format(next, "yyyy-MM-dd"));
  };

  const goToToday = () => {
    onDateChange(format(new Date(), "yyyy-MM-dd"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl mx-4 h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Agenda Preview</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm font-medium hover:bg-muted rounded-md transition-colors"
              >
                {format(currentDate, "EEEE, MMMM d, yyyy")}
              </button>
              <Button variant="ghost" size="sm" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open PDF
            </a>
            <a
              href={previewUrl}
              download={`Agenda ${date}.pdf`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PDF Preview */}
        <div className="flex-1 min-h-0 p-4 bg-muted/50">
          <iframe
            src={previewUrl}
            className="w-full h-full rounded-lg border border-border bg-white"
            title="Agenda Preview"
          />
        </div>
      </div>
    </div>
  );
}
