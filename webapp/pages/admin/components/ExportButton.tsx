import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/exportUtils";

interface ExportButtonProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
  disabled?: boolean;
}

export default function ExportButton({ data, columns, filename, disabled }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const noData = !data || data.length === 0;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1.5"
        onClick={() => setOpen(!open)}
        disabled={disabled || noData}
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            onClick={() => {
              exportToCSV(data, columns, filename);
              setOpen(false);
            }}
          >
            Export as CSV
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            onClick={() => {
              exportToExcel(data, columns, filename);
              setOpen(false);
            }}
          >
            Export as Excel
          </button>
        </div>
      )}
    </div>
  );
}
