import React, { useState, useMemo } from "react";
import type { Property } from "@shared/schema";
import type { ValuationSummary, CompOverrides } from "@/lib/valuation";
import { formatCurrency, formatNumber, formatPercent, calcMetrics, calcAdjustments } from "@/lib/valuation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BarChart3, Pencil, Trash2, MapPin, Wrench, Weight, AlertTriangle, Star, LayoutList, Grid3X3, Filter, X, ArrowUpDown } from "lucide-react";

interface CompsTableProps {
  comps: Property[];
  subject: Property | null;
  valuation: ValuationSummary | null;
  adjustmentOverrides: Record<number, CompOverrides>;
  onEdit: (property: Property) => void;
  onDelete: (id: number) => void;
  onAdjustmentChange: (compId: number, field: "locationAdj" | "conditionAdj" | "weight", value: number) => void;
  isLoading: boolean;
  annualAppreciationRate?: number;
}

// ─── Appraiser Grid View ──────────────────────────────────────────────────────

function AppraiserGrid({
  subject,
  comps,
  valuation,
  adjustmentOverrides,
  annualAppreciationRate = 0,
}: {
  subject: Property | null;
  comps: Property[];
  valuation: ValuationSummary | null;
  adjustmentOverrides: Record<number, CompOverrides>;
  annualAppreciationRate?: number;
}) {
  if (!subject) return (
    <p className="text-xs text-muted-foreground text-center py-6">Add a subject property to use the appraisal grid.</p>
  );

  const allProps = [subject, ...comps];

  // Row definitions — each row is a labeled field
  const rows: { label: string; getValue: (p: Property, isSubject: boolean, idx: number) => React.ReactNode }[] = [
    {
      label: "Address",
      getValue: (p) => (
        <div>
          <p className="font-medium text-xs leading-tight">{p.address}</p>
          <p className="text-[10px] text-muted-foreground">{p.city}, {p.state} {p.zip}</p>
        </div>
      ),
    },
    {
      label: "Sale Price",
      getValue: (p, isSubj) => isSubj
        ? <span className="text-muted-foreground text-xs">Subject</span>
        : <span className="text-xs tabular-nums font-medium">{formatCurrency(p.salePrice ?? p.listPrice)}</span>,
    },
    {
      label: "Sale Date",
      getValue: (p, isSubj) => isSubj
        ? <span className="text-muted-foreground text-xs">—</span>
        : <span className="text-xs tabular-nums">{p.saleDate ?? "—"}</span>,
    },
    {
      label: "Size (SF)",
      getValue: (p) => <span className="text-xs tabular-nums">{formatNumber(p.squareFeet)}</span>,
    },
    {
      label: "Year Built",
      getValue: (p) => <span className="text-xs tabular-nums">{p.yearBuilt ?? "—"}</span>,
    },
    {
      label: "$/SF (Unadj.)",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const m = calcMetrics(p);
        return <span className="text-xs tabular-nums font-medium">{formatCurrency(m.pricePerSqFt)}</span>;
      },
    },
    {
      label: "Cap Rate",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-xs tabular-nums">{p.noi ? formatPercent((p.noi / (p.listPrice ?? 1)) * 100) : "—"}</span>;
        const m = calcMetrics(p);
        return <span className="text-xs tabular-nums">{m.capRate != null ? formatPercent(m.capRate) : "—"}</span>;
      },
    },
    {
      label: "Size Adj.",
      getValue: (p, isSubj, idx) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const overrides = adjustmentOverrides[p.id] ?? { locationAdj: 0, conditionAdj: 0, weight: 100 };
        const adj = calcAdjustments(subject, p, overrides.locationAdj, overrides.conditionAdj, annualAppreciationRate);
        return <AdjCell value={adj.sizeAdj} />;
      },
    },
    {
      label: "Age Adj.",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const overrides = adjustmentOverrides[p.id] ?? { locationAdj: 0, conditionAdj: 0, weight: 100 };
        const adj = calcAdjustments(subject, p, overrides.locationAdj, overrides.conditionAdj, annualAppreciationRate);
        return <AdjCell value={adj.ageAdj} />;
      },
    },
    {
      label: "Time Adj.",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const overrides = adjustmentOverrides[p.id] ?? { locationAdj: 0, conditionAdj: 0, weight: 100 };
        const adj = calcAdjustments(subject, p, overrides.locationAdj, overrides.conditionAdj, annualAppreciationRate);
        return <AdjCell value={adj.timeAdj} />;
      },
    },
    {
      label: "Location Adj.",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const overrides = adjustmentOverrides[p.id] ?? { locationAdj: 0, conditionAdj: 0, weight: 100 };
        return <AdjCell value={overrides.locationAdj} />;
      },
    },
    {
      label: "Condition Adj.",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const overrides = adjustmentOverrides[p.id] ?? { locationAdj: 0, conditionAdj: 0, weight: 100 };
        return <AdjCell value={overrides.conditionAdj} />;
      },
    },
    {
      label: "Total Adj. %",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const overrides = adjustmentOverrides[p.id] ?? { locationAdj: 0, conditionAdj: 0, weight: 100 };
        const adj = calcAdjustments(subject, p, overrides.locationAdj, overrides.conditionAdj, annualAppreciationRate);
        return <AdjCell value={adj.totalAdj} bold />;
      },
    },
    {
      label: "Adj. $/SF",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const ac = valuation?.adjustedComps.find((a) => a.comp.id === p.id);
        if (!ac?.adjustedPrice || !p.squareFeet) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="text-xs tabular-nums font-semibold">{formatCurrency(ac.adjustedPrice / p.squareFeet)}</span>;
      },
    },
    {
      label: "Adj. Price",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const ac = valuation?.adjustedComps.find((a) => a.comp.id === p.id);
        return <span className="text-xs tabular-nums font-semibold text-primary">{formatCurrency(ac?.adjustedPrice)}</span>;
      },
    },
    {
      label: "Comp Score",
      getValue: (p, isSubj) => {
        if (isSubj) return <span className="text-muted-foreground text-xs">—</span>;
        const ac = valuation?.adjustedComps.find((a) => a.comp.id === p.id);
        if (!ac?.score) return <span className="text-muted-foreground text-xs">—</span>;
        return ac.score.isOutlier
          ? <span className="text-[10px] font-semibold text-amber-600">⚠ Outlier</span>
          : <span className="text-[10px] font-semibold text-green-600">{ac.score.total}/100</span>;
      },
    },
    {
      label: "Notes",
      getValue: (p) => p.notes
        ? <span className="text-xs text-muted-foreground truncate block max-w-[120px]" title={p.notes}>{p.notes}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" style={{ minWidth: `${allProps.length * 140 + 140}px` }}>
        <thead>
          <tr>
            <th className="text-left text-muted-foreground font-medium py-2 pr-3 text-[10px] uppercase tracking-wider sticky left-0 bg-card z-10 w-36 min-w-[144px]">
              Item
            </th>
            {allProps.map((p, i) => (
              <th
                key={p.id}
                className={`text-center py-2 px-3 text-[10px] uppercase tracking-wider font-semibold min-w-[140px] ${
                  i === 0
                    ? "bg-primary/10 text-primary border-b-2 border-primary/30"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {i === 0 ? "Subject" : `Comp ${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isSeparatorRow = ["Size Adj.", "Adj. $/SF", "Adj. Price"].includes(row.label);
            return (
              <tr
                key={row.label}
                className={`border-t border-border/40 ${
                  isSeparatorRow ? "border-t-2 border-border/70" : ""
                } ${ri % 2 === 0 ? "bg-transparent" : "bg-muted/20"}`}
              >
                <td className="py-2 pr-3 text-muted-foreground font-medium sticky left-0 bg-inherit z-10 whitespace-nowrap text-[11px]">
                  {row.label}
                </td>
                {allProps.map((p, i) => (
                  <td
                    key={p.id}
                    className={`py-2 px-3 text-center align-middle ${
                      i === 0 ? "bg-primary/[0.03]" : ""
                    }`}
                  >
                    {row.getValue(p, i === 0, i)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {/* Footer: Avg adj $/SF */}
        {valuation?.avgPricePerSqFt != null && (
          <tfoot>
            <tr className="border-t-2 border-primary/30 bg-primary/5">
              <td className="py-2 pr-3 font-semibold text-[11px] sticky left-0 bg-primary/5 z-10">Avg Adj. $/SF</td>
              <td className="py-2 px-3 text-center text-primary font-bold tabular-nums">
                {formatCurrency(valuation.avgPricePerSqFt)}
              </td>
              {comps.map((_, i) => (
                <td key={i} className="py-2 px-3 text-center text-muted-foreground text-[10px]">—</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      <p className="text-[10px] text-muted-foreground mt-2">
        Appraiser-style grid. Adjust location/condition via the list view. Scroll horizontally for more comps.
      </p>
    </div>
  );
}

function AdjCell({ value, bold }: { value: number; bold?: boolean }) {
  const cls = bold ? "font-bold" : "font-medium";
  if (value > 0) return <span className={`text-xs tabular-nums text-green-600 dark:text-green-400 ${cls}`}>+{value.toFixed(1)}%</span>;
  if (value < 0) return <span className={`text-xs tabular-nums text-red-600 dark:text-red-400 ${cls}`}>{value.toFixed(1)}%</span>;
  return <span className="text-xs tabular-nums text-muted-foreground">0.0%</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SortField = "default" | "adjSqft" | "saleDate" | "score" | "salePrice";
type SortDir = "asc" | "desc";

export function CompsTable({
  comps,
  subject,
  valuation,
  adjustmentOverrides,
  onEdit,
  onDelete,
  onAdjustmentChange,
  isLoading,
  annualAppreciationRate = 0,
}: CompsTableProps) {
  const [expandedComp, setExpandedComp] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Filter & sort state
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const activeFilterCount = [
    filterType !== "all",
    !!filterDateFrom || !!filterDateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterType("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSortField("default");
    setSortDir("asc");
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "saleDate" ? "desc" : "asc"); // newest first for date by default
    }
  };

  // Apply filters + sort
  const displayedComps = useMemo(() => {
    let filtered = comps.filter((c) => {
      if (filterType !== "all" && c.propertyType !== filterType) return false;
      if (filterDateFrom && c.saleDate && c.saleDate < filterDateFrom) return false;
      if (filterDateTo && c.saleDate && c.saleDate > filterDateTo) return false;
      return true;
    });

    if (sortField !== "default") {
      filtered = [...filtered].sort((a, b) => {
        let aVal = 0, bVal = 0;
        if (sortField === "saleDate") {
          aVal = a.saleDate ? new Date(a.saleDate).getTime() : 0;
          bVal = b.saleDate ? new Date(b.saleDate).getTime() : 0;
        } else if (sortField === "salePrice") {
          aVal = a.salePrice ?? a.listPrice ?? 0;
          bVal = b.salePrice ?? b.listPrice ?? 0;
        } else if (sortField === "adjSqft") {
          const aAdj = valuation?.adjustedComps.find((x) => x.comp.id === a.id);
          const bAdj = valuation?.adjustedComps.find((x) => x.comp.id === b.id);
          aVal = aAdj && a.squareFeet ? aAdj.adjustedPrice / a.squareFeet : 0;
          bVal = bAdj && b.squareFeet ? bAdj.adjustedPrice / b.squareFeet : 0;
        } else if (sortField === "score") {
          const aAdj = valuation?.adjustedComps.find((x) => x.comp.id === a.id);
          const bAdj = valuation?.adjustedComps.find((x) => x.comp.id === b.id);
          aVal = aAdj?.score?.isOutlier ? -1 : (aAdj?.score?.total ?? 0);
          bVal = bAdj?.score?.isOutlier ? -1 : (bAdj?.score?.total ?? 0);
        }
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [comps, filterType, filterDateFrom, filterDateTo, sortField, sortDir, valuation]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (comps.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-1">No Comparables Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add comparable sales from recent transactions in the market area. The more comps you add, the stronger your valuation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">
              Comparable Sales ({displayedComps.length}{displayedComps.length !== comps.length ? ` of ${comps.length}` : ""})
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {valuation && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                Avg {formatCurrency(valuation.avgPricePerSqFt)}/SF
              </Badge>
            )}
            {/* Sort control */}
            <Select
              value={`${sortField}:${sortDir}`}
              onValueChange={(v) => {
                const [f, d] = v.split(":") as [SortField, SortDir];
                setSortField(f);
                setSortDir(d);
              }}
            >
              <SelectTrigger className="h-7 text-xs w-44 gap-1" data-testid="select-sort">
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default:asc">Default order</SelectItem>
                <SelectItem value="adjSqft:desc">Adj $/SF — High to Low</SelectItem>
                <SelectItem value="adjSqft:asc">Adj $/SF — Low to High</SelectItem>
                <SelectItem value="saleDate:desc">Most Recent</SelectItem>
                <SelectItem value="saleDate:asc">Oldest First</SelectItem>
                <SelectItem value="score:desc">Score — Best First</SelectItem>
                <SelectItem value="salePrice:desc">Sale Price — High to Low</SelectItem>
                <SelectItem value="salePrice:asc">Sale Price — Low to High</SelectItem>
              </SelectContent>
            </Select>
            {/* Filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs gap-1.5 ${showFilters ? "bg-muted" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
              data-testid="button-toggle-comp-filters"
            >
              <Filter className="w-3 h-3" />
              Filter
              {activeFilterCount > 0 && <Badge className="text-[10px] h-4 px-1.5 ml-0.5">{activeFilterCount}</Badge>}
            </Button>
            {/* View toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-none border-0 ${viewMode === "list" ? "bg-muted" : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
                data-testid="button-view-list"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-none border-0 border-l border-border ${viewMode === "grid" ? "bg-muted" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Appraiser grid"
                data-testid="button-view-grid"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Type</p>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-7 text-xs w-36" data-testid="select-comp-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="multifamily">Multifamily</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Sale Date From</p>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-7 text-xs w-36"
                data-testid="input-comp-filter-date-from"
              />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Sale Date To</p>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-7 text-xs w-36"
                data-testid="input-comp-filter-date-to"
              />
            </div>
            {(activeFilterCount > 0) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" /> Clear filters
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {viewMode === "grid" ? (
          <AppraiserGrid
            subject={subject}
            comps={displayedComps}
            valuation={valuation}
            adjustmentOverrides={adjustmentOverrides}
            annualAppreciationRate={annualAppreciationRate}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Address</TableHead>
                  <TableHead className="text-xs text-right">Size (SF)</TableHead>
                  <TableHead className="text-xs text-right">Sale Price</TableHead>
                  <TableHead className="text-xs text-right">$/SF</TableHead>
                  <TableHead className="text-xs text-right">Cap Rate</TableHead>
                  <TableHead className="text-xs text-right">GRM</TableHead>
                  <TableHead className="text-xs text-right">Adj %</TableHead>
                  <TableHead className="text-xs text-right">Adj Price</TableHead>
                  <TableHead className="text-xs w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedComps.map((comp) => {
                  const metrics = calcMetrics(comp);
                  const adjComp = valuation?.adjustedComps.find((a) => a.comp.id === comp.id);
                  const isExpanded = expandedComp === comp.id;
                  const overrides = adjustmentOverrides[comp.id] ?? { locationAdj: 0, conditionAdj: 0 };

                  return (
                    <React.Fragment key={comp.id}>
                      <TableRow
                        className="cursor-pointer hover-elevate"
                        onClick={() => setExpandedComp(isExpanded ? null : comp.id)}
                        data-testid={`row-comp-${comp.id}`}
                      >
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium">{comp.address}</p>
                              {adjComp?.score && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-default ${
                                      adjComp.score.isOutlier
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                        : adjComp.score.total >= 75
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                        : adjComp.score.total >= 50
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                                        : "bg-muted text-muted-foreground"
                                    }`}>
                                      {adjComp.score.isOutlier
                                        ? <><AlertTriangle className="w-2.5 h-2.5" /> Outlier</>
                                        : <><Star className="w-2.5 h-2.5" /> {adjComp.score.total}</>}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs max-w-[180px]">
                                    {adjComp.score.isOutlier && <p className="font-medium text-amber-600 mb-1">Outlier: adj $/SF is &gt;1 std dev from mean</p>}
                                    <p>Recency: {adjComp.score.recency}/33</p>
                                    <p>Size match: {adjComp.score.sizeMatch}/33</p>
                                    <p>Data quality: {adjComp.score.dataQuality}/34</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {comp.city}, {comp.state}
                              {comp.saleDate && ` \u00B7 ${comp.saleDate}`}
                            </p>
                            {comp.notes && (
                              <p className="text-xs text-muted-foreground/70 italic mt-0.5 truncate max-w-xs" title={comp.notes}>
                                {comp.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatNumber(comp.squareFeet)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCurrency(comp.salePrice ?? comp.listPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatCurrency(metrics.pricePerSqFt)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {metrics.capRate !== null ? formatPercent(metrics.capRate) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {metrics.grm !== null ? `${formatNumber(metrics.grm, 1)}x` : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {adjComp ? (
                            <span className={
                              adjComp.adjustments.totalAdj > 0
                                ? "text-green-600 dark:text-green-400"
                                : adjComp.adjustments.totalAdj < 0
                                ? "text-red-600 dark:text-red-400"
                                : ""
                            }>
                              {adjComp.adjustments.totalAdj > 0 ? "+" : ""}
                              {formatPercent(adjComp.adjustments.totalAdj, 1)}
                            </span>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {adjComp ? formatCurrency(adjComp.adjustedPrice) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); onEdit(comp); }}
                                  data-testid={`button-edit-comp-${comp.id}`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={(e) => { e.stopPropagation(); onDelete(comp.id); }}
                                  data-testid={`button-delete-comp-${comp.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && subject && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30 p-4">
                            <div className="space-y-4 max-w-md">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Manual Adjustments
                              </h4>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <MapPin className="w-3 h-3" />
                                      Location Adjustment
                                    </div>
                                    <span className="text-xs tabular-nums font-medium">
                                      {overrides.locationAdj > 0 ? "+" : ""}{overrides.locationAdj}%
                                    </span>
                                  </div>
                                  <Slider
                                    value={[overrides.locationAdj]}
                                    onValueChange={([v]) => onAdjustmentChange(comp.id, "locationAdj", v)}
                                    min={-20} max={20} step={1}
                                    data-testid={`slider-location-${comp.id}`}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Wrench className="w-3 h-3" />
                                      Condition Adjustment
                                    </div>
                                    <span className="text-xs tabular-nums font-medium">
                                      {overrides.conditionAdj > 0 ? "+" : ""}{overrides.conditionAdj}%
                                    </span>
                                  </div>
                                  <Slider
                                    value={[overrides.conditionAdj]}
                                    onValueChange={([v]) => onAdjustmentChange(comp.id, "conditionAdj", v)}
                                    min={-20} max={20} step={1}
                                    data-testid={`slider-condition-${comp.id}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Weight className="w-3 h-3" />
                                    Comp Weight
                                  </div>
                                  <span className="text-xs tabular-nums font-medium">
                                    {overrides.weight ?? 100}%
                                  </span>
                                </div>
                                <Slider
                                  value={[overrides.weight ?? 100]}
                                  onValueChange={([v]) => onAdjustmentChange(comp.id, "weight", v)}
                                  min={0} max={100} step={5}
                                  data-testid={`slider-weight-${comp.id}`}
                                />
                              </div>
                              {adjComp && (
                                <div className="grid grid-cols-5 gap-3 pt-2 border-t border-border">
                                  <AdjDetail label="Size" value={adjComp.adjustments.sizeAdj} />
                                  <AdjDetail label="Age" value={adjComp.adjustments.ageAdj} />
                                  <AdjDetail label="Time" value={adjComp.adjustments.timeAdj} />
                                  <AdjDetail label="Location" value={adjComp.adjustments.locationAdj} />
                                  <AdjDetail label="Condition" value={adjComp.adjustments.conditionAdj} />
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdjDetail({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xs font-medium tabular-nums ${
        value > 0 ? "text-green-600 dark:text-green-400" : value < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
      }`}>
        {value > 0 ? "+" : ""}{value.toFixed(1)}%
      </p>
    </div>
  );
}
