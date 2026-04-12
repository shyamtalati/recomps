import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MethodWeights } from "@/lib/valuation";
import { Calendar, Scale, RotateCcw, TrendingUp, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ValuationSettingsProps {
  annualAppreciationRate: number;
  onAppreciationRateChange: (rate: number) => void;
  methodWeights: MethodWeights;
  onMethodWeightsChange: (weights: MethodWeights) => void;
  subjectState?: string;
}

export function ValuationSettings({
  annualAppreciationRate,
  onAppreciationRateChange,
  methodWeights,
  onMethodWeightsChange,
  subjectState,
}: ValuationSettingsProps) {
  const [hpiLoading, setHpiLoading] = useState(false);
  const [hpiInfo, setHpiInfo] = useState<{ source: string; asOf: string } | null>(null);
  const [hpiError, setHpiError] = useState<string | null>(null);

  const fetchHpi = async () => {
    if (!subjectState) return;
    setHpiLoading(true);
    setHpiError(null);
    setHpiInfo(null);
    try {
      const res = await apiRequest("GET", `/api/hpi?state=${encodeURIComponent(subjectState)}`);
      const data = await res.json();
      if (data.rate !== undefined) {
        onAppreciationRateChange(data.rate);
        setHpiInfo({ source: data.source, asOf: data.asOf });
      } else {
        setHpiError(data.message ?? "Unknown error");
      }
    } catch {
      setHpiError("Failed to fetch HPI data");
    } finally {
      setHpiLoading(false);
    }
  };

  const setWeight = (key: keyof MethodWeights, value: number) => {
    // Clamp remaining to sum to 100 across all three
    const others = (Object.keys(methodWeights) as (keyof MethodWeights)[]).filter(k => k !== key);
    const remaining = 100 - value;
    const currentOthersTotal = others.reduce((s, k) => s + methodWeights[k], 0);
    const newWeights = { ...methodWeights, [key]: value } as MethodWeights;
    if (currentOthersTotal > 0) {
      others.forEach(k => {
        newWeights[k] = Math.round((methodWeights[k] / currentOthersTotal) * remaining);
      });
      // Fix rounding drift
      const newTotal = (Object.values(newWeights) as number[]).reduce((a, b) => a + b, 0);
      if (newTotal !== 100) {
        const last = others[others.length - 1];
        newWeights[last] = newWeights[last] + (100 - newTotal);
      }
    }
    onMethodWeightsChange(newWeights);
  };

  const resetWeights = () => {
    onMethodWeightsChange({ sqft: 34, capRate: 33, grm: 33 });
    onAppreciationRateChange(0);
  };

  const totalWeight = methodWeights.sqft + methodWeights.capRate + methodWeights.grm;

  return (
    <div className="space-y-5">
      {/* Time Adjustment */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-xs font-semibold">Time-of-Sale Adjustment</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Annual market appreciation rate. Applied to each comp proportionally based on months elapsed since sale date.
        </p>
        {subjectState && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 w-full"
            onClick={fetchHpi}
            disabled={hpiLoading}
            data-testid="button-fetch-hpi"
          >
            {hpiLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            )}
            Auto-fill from FHFA HPI ({subjectState})
          </Button>
        )}
        {hpiInfo && (
          <p className="text-xs text-muted-foreground">
            Loaded: {hpiInfo.source} — {hpiInfo.asOf}
          </p>
        )}
        {hpiError && (
          <p className="text-xs text-destructive">{hpiError}</p>
        )}
        <div className="flex items-center gap-3">
          <Slider
            value={[annualAppreciationRate]}
            onValueChange={([v]) => onAppreciationRateChange(v)}
            min={-10}
            max={15}
            step={0.5}
            className="flex-1"
            data-testid="slider-appreciation"
          />
          <div className="flex items-center gap-1 w-20">
            <Input
              type="number"
              value={annualAppreciationRate}
              onChange={(e) => onAppreciationRateChange(parseFloat(e.target.value) || 0)}
              step={0.5}
              className="h-7 text-xs text-right tabular-nums px-2"
              data-testid="input-appreciation"
            />
            <span className="text-xs text-muted-foreground">%/yr</span>
          </div>
        </div>
        {annualAppreciationRate !== 0 && (
          <p className="text-xs text-muted-foreground">
            A comp sold 12 months ago gets a{" "}
            <span className={annualAppreciationRate > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
              {annualAppreciationRate > 0 ? "+" : ""}{annualAppreciationRate.toFixed(1)}%
            </span>{" "}
            adjustment. 6-month-old comp gets{" "}
            <span className="font-medium">
              {annualAppreciationRate > 0 ? "+" : ""}{(annualAppreciationRate / 2).toFixed(2)}%
            </span>.
          </p>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Method Weights */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold">Method Weights</h4>
          </div>
          <Badge
            variant="secondary"
            className={`text-xs tabular-nums ${totalWeight !== 100 ? "text-destructive" : ""}`}
          >
            {totalWeight}% total
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Weight each valuation approach for the reconciled value. Sales comparison is typically weighted highest for owner-occupied properties; income approaches for investment assets.
        </p>

        <div className="space-y-3">
          <WeightControl
            label="Sales Comparison ($/SF)"
            value={methodWeights.sqft}
            onChange={(v) => setWeight("sqft", v)}
            testId="slider-weight-sqft"
          />
          <WeightControl
            label="Income — Cap Rate"
            value={methodWeights.capRate}
            onChange={(v) => setWeight("capRate", v)}
            testId="slider-weight-caprate"
          />
          <WeightControl
            label="Income — GRM"
            value={methodWeights.grm}
            onChange={(v) => setWeight("grm", v)}
            testId="slider-weight-grm"
          />
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={resetWeights} className="w-full h-7 text-xs gap-1">
        <RotateCcw className="w-3 h-3" />
        Reset to defaults
      </Button>
    </div>
  );
}

function WeightControl({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums w-8 text-right">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={1}
        data-testid={testId}
      />
    </div>
  );
}
