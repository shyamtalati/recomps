import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/valuation";
import type { Property } from "@shared/schema";
import type { ValuationSummary } from "@/lib/valuation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, BarChart3, Layers, Scale, Calendar, Eye, Home } from "lucide-react";

interface SnapshotData {
  id: number;
  token: string;
  projectId: number;
  projectName: string;
  createdAt: string;
  subjectJson: string;
  compsJson: string;
  valuationJson: string;
  settingsJson: string;
  label: string | null;
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function SnapshotViewer() {
  const { token } = useParams<{ token: string }>();

  const { data: snap, isLoading, isError } = useQuery<SnapshotData>({
    queryKey: ["/api/snapshots", token],
    queryFn: () => apiRequest("GET", `/api/snapshots/${token}`).then((r) => r.json()),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading report…</p>
        </div>
      </div>
    );
  }

  if (isError || !snap) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Eye className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-foreground mb-1">Snapshot not found</h2>
            <p className="text-sm text-muted-foreground">
              This report link may have expired or does not exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subject: Property = JSON.parse(snap.subjectJson);
  const comps: Property[] = JSON.parse(snap.compsJson);
  const valuation: ValuationSummary = JSON.parse(snap.valuationJson);
  const settings = JSON.parse(snap.settingsJson);
  const createdDate = new Date(snap.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ReComps logo mark */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-label="ReComps" className="shrink-0">
              <rect x="1" y="1" width="9" height="9" rx="2" fill="hsl(var(--primary))" />
              <rect x="12" y="1" width="9" height="9" rx="2" fill="hsl(var(--primary) / 0.55)" />
              <rect x="1" y="12" width="9" height="9" rx="2" fill="hsl(var(--primary) / 0.55)" />
              <rect x="12" y="12" width="9" height="9" rx="2" fill="hsl(var(--primary) / 0.3)" />
            </svg>
            <span className="font-semibold text-sm text-foreground">ReComps</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs gap-1.5 py-1">
              <Eye className="w-3 h-3" />
              View only · Saved {createdDate}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Report title */}
        <div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Comparable Analysis Report
              </p>
              <h1 className="text-xl font-bold text-foreground">
                {snap.label || snap.projectName}
              </h1>
              {snap.label && (
                <p className="text-sm text-muted-foreground mt-0.5">{snap.projectName}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {createdDate}
            </div>
          </div>
        </div>

        {/* Subject property card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Home className="w-4 h-4 text-primary" />
              Subject Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium">{subject.address}</p>
                <p className="text-xs text-muted-foreground">{subject.city}, {subject.state} {subject.zip}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium capitalize">{subject.propertyType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Size</p>
                <p className="text-sm font-medium tabular-nums">{formatNumber(subject.squareFeet)} SF</p>
                {subject.yearBuilt && (
                  <p className="text-xs text-muted-foreground">Built {subject.yearBuilt}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">List Price</p>
                <p className="text-sm font-medium tabular-nums">{formatCurrency(subject.listPrice)}</p>
                {subject.noi && (
                  <p className="text-xs text-muted-foreground tabular-nums">NOI: {formatCurrency(subject.noi)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI row */}
        {valuation.reconciledValue && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={<Scale className="w-4 h-4" />}
              label="Reconciled Value"
              value={formatCurrency(valuation.reconciledValue)}
              sub={
                valuation.recommendedRange
                  ? `${formatCurrency(valuation.recommendedRange.low)}–${formatCurrency(valuation.recommendedRange.high)}`
                  : undefined
              }
              highlight
            />
            <KpiCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Est. Value ($/SF)"
              value={formatCurrency(valuation.estimatedValueBySqFt)}
              sub={valuation.avgPricePerSqFt ? `${formatCurrency(valuation.avgPricePerSqFt)}/SF avg` : undefined}
            />
            <KpiCard
              icon={<BarChart3 className="w-4 h-4" />}
              label="Est. Value (Cap Rate)"
              value={formatCurrency(valuation.estimatedValueByCapRate)}
              sub={valuation.avgCapRate ? `${formatPercent(valuation.avgCapRate)} avg cap` : "No NOI data"}
            />
            <KpiCard
              icon={<Layers className="w-4 h-4" />}
              label="Est. Value (GRM)"
              value={formatCurrency(valuation.estimatedValueByGRM)}
              sub={valuation.avgGRM ? `${formatNumber(valuation.avgGRM, 1)}x avg GRM` : "No rent data"}
            />
          </div>
        )}

        {/* Method weights summary */}
        {valuation.methodWeights && (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Method weights — $/SF: <strong className="text-foreground">{valuation.methodWeights.sqft}%</strong>
            </span>
            <span>
              Cap Rate: <strong className="text-foreground">{valuation.methodWeights.capRate}%</strong>
            </span>
            <span>
              GRM: <strong className="text-foreground">{valuation.methodWeights.grm}%</strong>
            </span>
            {settings?.annualAppreciationRate != null && (
              <span>
                Time adj. rate: <strong className="text-foreground">{settings.annualAppreciationRate}%/yr</strong>
              </span>
            )}
          </div>
        )}

        {/* Comps table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Comparable Sales ({comps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs pl-6">Address</TableHead>
                    <TableHead className="text-xs text-right">Sale Price</TableHead>
                    <TableHead className="text-xs text-right">$/SF</TableHead>
                    <TableHead className="text-xs text-right">SF</TableHead>
                    <TableHead className="text-xs text-right">Year</TableHead>
                    <TableHead className="text-xs text-right pr-6">Sale Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comps.map((comp, i) => {
                    const pricePerSqFt =
                      comp.salePrice && comp.squareFeet
                        ? comp.salePrice / comp.squareFeet
                        : null;
                    return (
                      <TableRow key={i}>
                        <TableCell className="pl-6">
                          <p className="text-xs font-medium">{comp.address}</p>
                          <p className="text-xs text-muted-foreground">
                            {comp.city}, {comp.state} {comp.zip}
                          </p>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatCurrency(comp.salePrice)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {pricePerSqFt ? `${formatCurrency(pricePerSqFt)}/SF` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {comp.squareFeet ? formatNumber(comp.squareFeet) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {comp.yearBuilt ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums pr-6">
                          {comp.saleDate ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Separator />
        <div className="text-center text-xs text-muted-foreground pb-4">
          This is a read-only report snapshot generated by{" "}
          <span className="font-medium text-foreground">ReComps</span>. Data
          reflects valuation as of {createdDate}.
        </div>
      </main>
    </div>
  );
}
