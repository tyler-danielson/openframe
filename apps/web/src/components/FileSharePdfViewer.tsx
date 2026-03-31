import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Use the CDN worker matching the installed pdfjs-dist version
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  currentPage: number;
  pageCount?: number;
  onLoaded?: () => void;
}

export default function FileSharePdfViewer({
  fileUrl,
  currentPage,
  pageCount,
  onLoaded,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(pageCount ?? 0);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
      onLoaded?.();
    },
    [onLoaded]
  );

  return (
    <div className="flex items-center justify-center w-full h-full overflow-hidden">
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="text-white text-lg">Loading PDF...</div>
        }
        error={
          <div className="text-red-400 text-lg">Failed to load PDF</div>
        }
      >
        <Page
          pageNumber={Math.min(currentPage, numPages || currentPage)}
          height={window.innerHeight}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}
