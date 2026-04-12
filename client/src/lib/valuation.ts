import type { Property } from "@shared/schema";

export interface ValuationMetrics {
  pricePerSqFt: number | null;
  capRate: number | null;
  grm: number | null;
}

export interface CompScore {
  total: number;         // 0–100
  recency: number;       // 0–33: how recently sold
  sizeMatch: number;     // 0–33: how close in SF to subject
  dataQuality: number;   // 0–34: completeness of key fields
  isOutlier: boolean;    // adjusted $/SF > 1 std dev from mean
}

export interface AdjustedComp {
  comp: Property;
  metrics: ValuationMetrics;
  adjustments: CompAdjustment;
  adjustedPrice: number | null;
  weight: number; // 0–100
  score?: CompScore;
}

export interface CompAdjustment {
  sizeAdj: number;
  ageAdj: number;
  locationAdj: number;
  conditionAdj: number;
  timeAdj: number;
  totalAdj: number;
}

export interface ValuationSummary {
  avgPricePerSqFt: number | null;
  medianPricePerSqFt: number | null;
  avgCapRate: number | null;
  avgGRM: number | null;
  estimatedValueBySqFt: number | null;
  estimatedValueByCapRate: number | null;
  estimatedValueByGRM: number | null;
  recommendedRange: { low: number; high: number } | null;
  reconciledValue: number | null;
  adjustedComps: AdjustedComp[];
  methodWeights: MethodWeights;
}

export interface MethodWeights {
  sqft: number;  // 0–100
  capRate: number;
  grm: number;
}

export interface CompOverrides {
  locationAdj: number;
  conditionAdj: number;
  weight: number; // 0–100, default 100
}

/** Annual market appreciation rate → monthly time adjustment */
export function calcTimeAdj(saleDate: string | null, annualRatePct: number): number {
  if (!saleDate || annualRatePct === 0) return 0;
  const sale = new Date(saleDate);
  const now = new Date();
  const monthsDiff = (now.getFullYear() - sale.getFullYear()) * 12 + (now.getMonth() - sale.getMonth());
  // positive months = comp sold in the past = needs upward adjustment
  return (annualRatePct / 12) * monthsDiff;
}

export function calcMetrics(p: Property): ValuationMetrics {
  const price = p.salePrice ?? p.listPrice;
  return {
    pricePerSqFt: price && p.squareFeet ? price / p.squareFeet : null,
    capRate: p.noi && price ? (p.noi / price) * 100 : null,
    grm: p.grossRent && price ? price / p.grossRent : null,
  };
}

export function calcAdjustments(
  subject: Property,
  comp: Property,
  locationAdj: number = 0,
  conditionAdj: number = 0,
  annualAppreciationRate: number = 0
): CompAdjustment {
  const sizeDiff = subject.squareFeet && comp.squareFeet
    ? ((subject.squareFeet - comp.squareFeet) / comp.squareFeet) * 100
    : 0;
  const sizeAdj = -sizeDiff * 0.5;

  const ageDiff = subject.yearBuilt && comp.yearBuilt
    ? comp.yearBuilt - subject.yearBuilt
    : 0;
  const ageAdj = ageDiff * 0.5;

  const timeAdj = calcTimeAdj(comp.saleDate, annualAppreciationRate);

  const totalAdj = sizeAdj + ageAdj + locationAdj + conditionAdj + timeAdj;

  return { sizeAdj, ageAdj, locationAdj, conditionAdj, timeAdj, totalAdj };
}

export function calcValuation(
  subject: Property,
  comps: Property[],
  adjustmentOverrides: Record<number, CompOverrides>,
  annualAppreciationRate: number = 0,
  methodWeights: MethodWeights = { sqft: 34, capRate: 33, grm: 33 }
): ValuationSummary {
  if (comps.length === 0) {
    return {
      avgPricePerSqFt: null,
      medianPricePerSqFt: null,
      avgCapRate: null,
      avgGRM: null,
      estimatedValueBySqFt: null,
      estimatedValueByCapRate: null,
      estimatedValueByGRM: null,
      recommendedRange: null,
      reconciledValue: null,
      adjustedComps: [],
      methodWeights,
    };
  }

  const adjustedComps: AdjustedComp[] = comps.map((comp) => {
    const metrics = calcMetrics(comp);
    const overrides: CompOverrides = adjustmentOverrides[comp.id] ?? { locationAdj: 0, conditionAdj: 0, weight: 100 };
    const adjustments = calcAdjustments(
      subject, comp,
      overrides.locationAdj,
      overrides.conditionAdj,
      annualAppreciationRate
    );

    const price = comp.salePrice ?? comp.listPrice;
    const adjustedPrice = price ? price * (1 + adjustments.totalAdj / 100) : null;

    return { comp, metrics, adjustments, adjustedPrice, weight: overrides.weight ?? 100, score: scoreComp(comp, subject) };
  });

  // Flag outliers based on adjusted $/SF std dev
  flagOutliers(adjustedComps);

  // Weighted price per sqft
  const sqftItems = adjustedComps.filter((c) => c.adjustedPrice && c.comp.squareFeet);
  const totalWeight = sqftItems.reduce((s, c) => s + c.weight, 0);
  const avgPricePerSqFt = totalWeight > 0
    ? sqftItems.reduce((s, c) => s + (c.adjustedPrice! / c.comp.squareFeet) * c.weight, 0) / totalWeight
    : null;

  const sqftValues = sqftItems.map((c) => c.adjustedPrice! / c.comp.squareFeet);
  const sorted = [...sqftValues].sort((a, b) => a - b);
  const medianPricePerSqFt = sorted.length
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    : null;

  const capRates = adjustedComps.filter((c) => c.metrics.capRate !== null).map((c) => c.metrics.capRate!);
  const avgCapRate = capRates.length ? capRates.reduce((a, b) => a + b, 0) / capRates.length : null;

  const grms = adjustedComps.filter((c) => c.metrics.grm !== null).map((c) => c.metrics.grm!);
  const avgGRM = grms.length ? grms.reduce((a, b) => a + b, 0) / grms.length : null;

  const estimatedValueBySqFt = avgPricePerSqFt && subject.squareFeet ? avgPricePerSqFt * subject.squareFeet : null;
  const estimatedValueByCapRate = avgCapRate && subject.noi ? subject.noi / (avgCapRate / 100) : null;
  const estimatedValueByGRM = avgGRM && subject.grossRent ? avgGRM * subject.grossRent : null;

  // Weighted reconciliation
  const availableMethods: { value: number; weight: number }[] = [];
  if (estimatedValueBySqFt) availableMethods.push({ value: estimatedValueBySqFt, weight: methodWeights.sqft });
  if (estimatedValueByCapRate) availableMethods.push({ value: estimatedValueByCapRate, weight: methodWeights.capRate });
  if (estimatedValueByGRM) availableMethods.push({ value: estimatedValueByGRM, weight: methodWeights.grm });

  const totalMethodWeight = availableMethods.reduce((s, m) => s + m.weight, 0);
  const reconciledValue = totalMethodWeight > 0
    ? availableMethods.reduce((s, m) => s + m.value * m.weight, 0) / totalMethodWeight
    : null;

  const estimates = availableMethods.map((m) => m.value);
  const recommendedRange = estimates.length > 0
    ? { low: Math.min(...estimates) * 0.95, high: Math.max(...estimates) * 1.05 }
    : null;

  return {
    avgPricePerSqFt, medianPricePerSqFt, avgCapRate, avgGRM,
    estimatedValueBySqFt, estimatedValueByCapRate, estimatedValueByGRM,
    recommendedRange, reconciledValue, adjustedComps, methodWeights,
  };
}

/** Score a comp 0–100 based on recency, size match, and data completeness */
export function scoreComp(comp: Property, subject: Property): CompScore {
  // Recency: full score if sold <6 months ago, zero if >36 months, linear in between
  let recency = 0;
  if (comp.saleDate) {
    const monthsAgo = (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    recency = Math.round(Math.max(0, Math.min(33, ((36 - monthsAgo) / 30) * 33)));
  }

  // Size match: full score if within 5%, zero if >50% different
  let sizeMatch = 0;
  if (comp.squareFeet && subject.squareFeet) {
    const pctDiff = Math.abs(comp.squareFeet - subject.squareFeet) / subject.squareFeet;
    sizeMatch = Math.round(Math.max(0, Math.min(33, (1 - pctDiff / 0.5) * 33)));
  }

  // Data quality: score based on presence of key fields
  const fields = [comp.salePrice, comp.saleDate, comp.squareFeet, comp.yearBuilt, comp.city];
  const filled = fields.filter((f) => f != null && f !== "").length;
  const dataQuality = Math.round((filled / fields.length) * 34);

  return { total: recency + sizeMatch + dataQuality, recency, sizeMatch, dataQuality, isOutlier: false };
}

/** Flag outliers: comps whose adjusted $/SF is >1 std dev from the mean */
function flagOutliers(adjustedComps: AdjustedComp[]): void {
  const sqftPrices = adjustedComps
    .filter((c) => c.adjustedPrice != null && c.comp.squareFeet)
    .map((c) => c.adjustedPrice! / c.comp.squareFeet);

  if (sqftPrices.length < 3) return; // need at least 3 to flag meaningfully

  const mean = sqftPrices.reduce((a, b) => a + b, 0) / sqftPrices.length;
  const variance = sqftPrices.reduce((a, b) => a + (b - mean) ** 2, 0) / sqftPrices.length;
  const stdDev = Math.sqrt(variance);

  for (const ac of adjustedComps) {
    if (ac.score && ac.adjustedPrice != null && ac.comp.squareFeet) {
      const psf = ac.adjustedPrice / ac.comp.squareFeet;
      ac.score.isOutlier = Math.abs(psf - mean) > stdDev;
    }
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "N/A";
  return `${value.toFixed(decimals)}%`;
}
