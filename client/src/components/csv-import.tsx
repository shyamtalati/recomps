import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatNumber } from "@/lib/valuation";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";

interface ParsedRow {
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  squareFeet: number;
  yearBuilt: number | null;
  listPrice: number | null;
  salePrice: number | null;
  saleDate: string | null;
  noi: number | null;
  grossRent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  notes: string | null;
  valid: boolean;
  error?: string;
}

interface CsvImportProps {
  projectId: number;
  onSuccess: () => void;
}

function parseNum(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v.replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}

function parseRow(headers: string[], values: string[]): ParsedRow {
  const get = (key: string) => {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/[\s_]/g, "") === key.toLowerCase());
    return idx >= 0 ? values[idx]?.trim() ?? "" : "";
  };

  const address = get("address");
  const city = get("city");
  const state = get("state");
  const zip = get("zip");
  const squareFeetStr = get("squarefeet") || get("sqft") || get("sf");
  const squareFeet = parseNum(squareFeetStr) ?? 0;

  const valid = !!(address && city && state && zip && squareFeet > 0);

  return {
    address,
    city,
    state,
    zip,
    propertyType: get("propertytype") || get("type") || "residential",
    squareFeet,
    yearBuilt: parseNum(get("yearbuilt") || get("year")) ? Math.round(parseNum(get("yearbuilt") || get("year"))!) : null,
    listPrice: parseNum(get("listprice") || get("list")),
    salePrice: parseNum(get("saleprice") || get("sale") || get("price")),
    saleDate: get("saledate") || get("date") || null,
    noi: parseNum(get("noi")),
    grossRent: parseNum(get("grossrent") || get("rent")),
    bedrooms: parseNum(get("bedrooms") || get("beds")) ? Math.round(parseNum(get("bedrooms") || get("beds"))!) : null,
    bathrooms: parseNum(get("bathrooms") || get("baths")),
    notes: get("notes") || null,
    valid,
    error: valid ? undefined : "Missing required fields: address, city, state, zip, squareFeet",
  };
}

const TEMPLATE_CSV = `address,city,state,zip,propertyType,squareFeet,yearBuilt,salePrice,listPrice,saleDate,noi,grossRent,bedrooms,bathrooms,notes
150 Example Ave,Philadelphia,PA,19103,commercial,12000,1990,2050000,,2025-11-15,155000,210000,,,"Corner location"
300 Sample St,Philadelphia,PA,19106,residential,1800,2005,450000,,2025-10-01,,,3,2,"Good condition"`;

export function CsvImport({ projectId, onSuccess }: CsvImportProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setImportedCount(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return;
      const headers = lines[0].split(",");
      const parsed = lines.slice(1).map((line) => {
        // Handle quoted commas
        const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(",");
        const cleaned = values.map(v => v.replace(/^"|"$/g, ""));
        return parseRow(headers, cleaned);
      });
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.valid);
    setImporting(true);
    let count = 0;
    for (const row of validRows) {
      try {
        await apiRequest("POST", "/api/properties", { ...row, projectId, isSubject: false });
        count++;
      } catch {
        // skip failed rows
      }
    }
    setImporting(false);
    setImportedCount(count);
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "properties"] });
    if (count > 0) onSuccess();
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recomps-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  return (
    <div className="space-y-4">
      {/* Download template */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Import multiple comps at once from a CSV file.
        </p>
        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={downloadTemplate} data-testid="button-download-template">
          <Download className="w-3 h-3" />
          Template
        </Button>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        data-testid="dropzone-csv"
      >
        <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        {fileName ? (
          <div>
            <p className="text-sm font-medium flex items-center justify-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              {fileName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {rows.length} row{rows.length !== 1 ? "s" : ""} parsed
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium">Drop a CSV file here</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          data-testid="input-file-csv"
        />
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              {validRows.length} valid
            </Badge>
            {invalidRows.length > 0 && (
              <Badge variant="secondary" className="text-xs gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <AlertCircle className="w-3 h-3" />
                {invalidRows.length} invalid
              </Badge>
            )}
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs border ${
                  row.valid
                    ? "border-border bg-card"
                    : "border-destructive/20 bg-destructive/5"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{row.address || "(no address)"}</p>
                  <p className="text-muted-foreground">
                    {row.city}, {row.state} {row.zip}
                    {row.salePrice && <span> · {formatCurrency(row.salePrice)}</span>}
                    {row.squareFeet > 0 && <span> · {formatNumber(row.squareFeet)} SF</span>}
                  </p>
                </div>
                {!row.valid && (
                  <div className="shrink-0 flex items-center gap-1 text-destructive">
                    <AlertCircle className="w-3 h-3" />
                    <span className="hidden sm:inline">{row.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {importedCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              {importedCount} propert{importedCount !== 1 ? "ies" : "y"} imported successfully
            </div>
          )}

          {validRows.length > 0 && (
            <Button
              className="w-full"
              onClick={handleImport}
              disabled={importing}
              data-testid="button-import-csv"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import {validRows.length} Propert{validRows.length !== 1 ? "ies" : "y"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
