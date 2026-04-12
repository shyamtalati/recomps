import { useState } from "react";
import type { Property } from "@shared/schema";
import type { ValuationSummary } from "@/lib/valuation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/valuation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, ArrowRight, Scale, ChevronDown, ChevronUp, Grid3X3 } from "lucide-react";

interface ValuationPanelProps {
  valuation: ValuationSummary;
  subject: Property;
}

/** Generate a 3×3 sensitivity grid: cap rate (rows) × appreciation rate (cols) */
function buildSensitivityGrid(
  valuation: ValuationSummary,
  subject: Property
) {
  // Cap rate axis: ±150bps around avg (or default 6%)
  const baseCap = valuation.avgCapRate ?? 6;
  const capRates = [baseCap - 1.5, baseCap, baseCap + 1.5];

  // Appreciation rate axis: ±2% around current avg $/SF derived rate (low=0, mid, high)
  // We express sensitivity via $/SF multiplier: −5%, base, +5%
  const baseSF = valuation.avgPricePerSqFt ?? 0;
  const sfMultipliers = [0.95, 1.0, 1.05];

  const sfValues = sfMultipliers.map((m) =>
    baseSF && subject.squareFeet ? baseSF * m * subject.squareFeet : null
  );

  // Cap rate sensitivity is independent — row = cap rate, col = SF multiplier
  // Cell = weighted blend of (SF value at multiplier) and (cap rate value at that rate)
  const sqftWeight = valuation.methodWeights.sqft;
  const capWeight = valuation.methodWeights.capRate;
  const grmWeight = valuation.methodWeights.grm;
  const totalW = sqftWeight + capWeight + grmWeight;

  const rows = capRates.map((cap) => {
    const capValue = subject.noi ? subject.noi / (cap / 100) : null;
    return sfMultipliers.map((sfMult, ci) => {
      const sfVal = baseSF && subject.squareFeet ? baseSF * sfMult * subject.squareFeet : null;
      const grmVal = valuation.estimatedValueByGRM; // GRM doesn't vary in this grid

      const parts: { v: number; w: number }[] = [];
      if (sfVal) parts.push({ v: sfVal, w: sqftWeight });
      if (capValue) parts.push({ v: capValue, w: capWeight });
      if (grmVal) parts.push({ v: grmVal, w: grmWeight });

      const tw = parts.reduce((s, p) => s + p.w, 0);
      return tw > 0 ? parts.reduce((s, p) => s + p.v * p.w, 0) / tw : null;
    });
  });

  return { rows, capRates, sfMultipliers };
}

export function ValuationPanel({ valuation, subject }: ValuationPanelProps) {
  const [showSensitivity, setShowSensitivity] = useState(false);
  const { methodWeights } = valuation;

  const methods = [
    {
      key: "sqft",
      name: "Sales Comparison ($/SF)",
      value: valuation.estimatedValueBySqFt,
      weight: methodWeights.sqft,
      detail: `${formatCurrency(valuation.avgPricePerSqFt)}/SF avg \u00D7 ${formatNumber(subject.squareFeet)} SF`,
      available: valuation.estimatedValueBySqFt !== null,
    },
    {
      key: "capRate",
      name: "Income (Cap Rate)",
      value: valuation.estimatedValueByCapRate,
      weight: methodWeights.capRate,
      detail: valuation.avgCapRate
        ? `${formatCurrency(subject.noi)} NOI \u00F7 ${formatPercent(valuation.avgCapRate)} cap`
        : "Requires NOI data on subject and comps",
      available: valuation.estimatedValueByCapRate !== null,
    },
    {
      key: "grm",
      name: "Income (GRM)",
      value: valuation.estimatedValueByGRM,
      weight: methodWeights.grm,
      detail: valuation.avgGRM
        ? `${formatNumber(valuation.avgGRM, 1)}x GRM \u00D7 ${formatCurrency(subject.grossRent)} rent`
        : "Requires gross rent data on subject and comps",
      available: valuation.estimatedValueByGRM !== null,
    },
  ];

  const availableMethods = methods.filter((m) => m.available);
  const totalMethodWeight = availableMethods.reduce((s, m) => s + m.weight, 0);

  const sensitivity = buildSensitivityGrid(valuation, subject);
  const baseValue = valuation.reconciledValue;

  // Color cell relative to base reconciled value
  function cellColor(val: number | null): string {
    if (!val || !baseValue) return "";
    const diff = (val - baseValue) / baseValue;
    if (diff > 0.05) return "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-semibold";
    if (diff > 0) return "bg-green-50/50 dark:bg-green-950/20 text-green-600 dark:text-green-500";
    if (diff < -0.05) return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-semibold";
    if (diff < 0) return "bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-500";
    return "bg-primary/5 font-semibold";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Valuation Methods</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Method cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {methods.map((method) => (
            <div
              key={method.name}
              className={`rounded-md border p-4 ${
                method.available ? "border-border" : "border-dashed border-border/50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{method.name}</span>
                </div>
                <span
                  className="text-xs tabular-nums text-muted-foreground font-medium"
                  title="Method weight"
                >
                  {method.weight}%
                </span>
              </div>
              <p
                className="text-lg font-semibold tabular-nums"
                data-testid={`text-value-${method.name.toLowerCase().replace(/[\s()\/]/g, "-")}`}
              >
                {method.available ? formatCurrency(method.value) : "Insufficient Data"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{method.detail}</p>
            </div>
          ))}
        </div>

        {/* Weighted reconciled value */}
        {valuation.reconciledValue !== null && (
          <div className="rounded-md bg-primary/[0.04] border border-primary/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className="text-xs font-semibold bg-primary/10 text-primary border-0"
              >
                <Scale className="w-3 h-3 mr-1" />
                Weighted Reconciled Value
              </Badge>
            </div>

            {/* Hero number */}
            <p
              className="text-2xl font-bold tabular-nums text-foreground mb-3"
              data-testid="text-reconciled-value"
            >
              {formatCurrency(valuation.reconciledValue)}
            </p>

            {/* Range */}
            {valuation.recommendedRange && (
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Low Estimate</p>
                  <p
                    className="text-base font-semibold tabular-nums"
                    data-testid="text-low-estimate"
                  >
                    {formatCurrency(valuation.recommendedRange.low)}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                <div>
                  <p className="text-xs text-muted-foreground">High Estimate</p>
                  <p
                    className="text-base font-semibold tabular-nums"
                    data-testid="text-high-estimate"
                  >
                    {formatCurrency(valuation.recommendedRange.high)}
                  </p>
                </div>
              </div>
            )}

            {/* Weight contribution breakdown */}
            {availableMethods.length > 1 && totalMethodWeight > 0 && (
              <div className="flex gap-3 flex-wrap pt-3 border-t border-primary/10">
                {availableMethods.map((m) => (
                  <div key={m.key} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {((m.weight / totalMethodWeight) * 100).toFixed(0)}%
                    </span>{" "}
                    {m.key === "sqft" ? "$/SF" : m.key === "capRate" ? "Cap Rate" : "GRM"}
                  </div>
                ))}
                <span className="text-xs text-muted-foreground">
                  · {availableMethods.length} method{availableMethods.length > 1 ? "s" : ""}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              Weighted average across available methods. Adjust method weights in Settings.
            </p>
          </div>
        )}

        {/* Sensitivity Analysis toggle */}
        {valuation.reconciledValue !== null && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground w-full justify-start px-2"
              onClick={() => setShowSensitivity((v) => !v)}
              data-testid="button-toggle-sensitivity"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Sensitivity Analysis
              {showSensitivity ? (
                <ChevronUp className="w-3.5 h-3.5 ml-auto" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-auto" />
              )}
            </Button>

            {showSensitivity && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Reconciled value across cap rate scenarios (rows) and $/SF market movement (cols).
                  Base scenario highlighted.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left text-muted-foreground font-medium py-1.5 pr-3 whitespace-nowrap">
                          Cap Rate ↓ / $/SF →
                        </th>
                        {sensitivity.sfMultipliers.map((m, ci) => (
                          <th
                            key={ci}
                            className="text-right font-medium text-muted-foreground py-1.5 px-2 whitespace-nowrap"
                          >
                            {m < 1 ? "−" : m > 1 ? "+" : "Base"}{m !== 1 ? ` ${Math.abs((m - 1) * 100).toFixed(0)}%` : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivity.rows.map((row, ri) => {
                        const capRate = sensitivity.capRates[ri];
                        const isBaseRow = ri === 1;
                        return (
                          <tr key={ri} className={isBaseRow ? "border-y border-border/50" : ""}>
                            <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap font-medium">
                              {formatPercent(capRate, 1)} cap
                              {isBaseRow && (
                                <span className="ml-1 text-primary text-[10px]">(base)</span>
                              )}
                            </td>
                            {row.map((val, ci) => {
                              const isBaseCell = ri === 1 && ci === 1;
                              return (
                                <td
                                  key={ci}
                                  className={`text-right py-1.5 px-2 rounded tabular-nums whitespace-nowrap ${
                                    isBaseCell
                                      ? "bg-primary/10 text-primary font-bold ring-1 ring-primary/30 rounded"
                                      : cellColor(val)
                                  }`}
                                  data-testid={`sensitivity-cell-${ri}-${ci}`}
                                >
                                  {val ? formatCurrency(val) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground">
                  Green = above base · Red = below base · ±5% threshold for bold.
                  Cap rate rows use current avg{" "}
                  {valuation.avgCapRate ? `(${formatPercent(valuation.avgCapRate, 1)})` : ""} ±150bps.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Comp Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <StatBox label="Comps Used" value={`${valuation.adjustedComps.length}`} />
          <StatBox label="Avg $/SF" value={formatCurrency(valuation.avgPricePerSqFt)} />
          <StatBox label="Median $/SF" value={formatCurrency(valuation.medianPricePerSqFt)} />
          <StatBox
            label="Avg Cap Rate"
            value={valuation.avgCapRate ? formatPercent(valuation.avgCapRate) : "N/A"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-md bg-muted/40">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
