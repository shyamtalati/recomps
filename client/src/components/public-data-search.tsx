import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatNumber } from "@/lib/valuation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Globe, Plus, Loader2, AlertCircle, Info, SlidersHorizontal, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PublicSearchResult {
  address: string;
  city: string;
  state: string;
  zip: string;
  squareFeet?: number;
  yearBuilt?: number;
  bedrooms?: number;
  bathrooms?: number;
  salePrice?: number;
  listPrice?: number;
  saleDate?: string;
  propertyType?: string;
  source: string;
}

interface PublicDataSearchProps {
  projectId: number;
  onSuccess: () => void;
  subjectSqFt?: number;  // passed from home for size ±% filter
  subjectZip?: string;   // passed from home for distance radius filter
}

// Haversine distance in miles between two lat/lng pairs
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// Geocode a US ZIP centroid; returns [lat, lng] or null
async function geocodeZip(zip: string): Promise<[number, number] | null> {
  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(zip + ", USA")}&format=json&limit=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

export function PublicDataSearch({ projectId, onSuccess, subjectSqFt, subjectZip }: PublicDataSearchProps) {
  const [zipCode, setZipCode] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [results, setResults] = useState<PublicSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);

  // MLS-style filters (applied client-side to results)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSizePct, setFilterSizePct] = useState<number>(0); // 0 = no filter, 25 = ±25%
  const [filterRadiusMi, setFilterRadiusMi] = useState<number>(0); // 0 = no filter

  // Geocoded coordinates for distance filter
  const [subjectLatLng, setSubjectLatLng] = useState<[number, number] | null>(null);
  // Map of zip -> [lat, lng] for result geocoding (cached to avoid repeated calls)
  const zipGeoCache = useRef<Record<string, [number, number] | null>>({});
  const [resultGeo, setResultGeo] = useState<Record<string, [number, number] | null>>({});
  const geocodingRef = useRef(false);

  // Geocode subject zip whenever it changes
  useEffect(() => {
    if (!subjectZip) return;
    let cancelled = false;
    geocodeZip(subjectZip).then((coords) => {
      if (!cancelled) setSubjectLatLng(coords);
    });
    return () => { cancelled = true; };
  }, [subjectZip]);

  // Geocode unique result ZIPs with Nominatim rate limiting (1.1s between requests)
  useEffect(() => {
    if (filterRadiusMi === 0 || results.length === 0 || geocodingRef.current) return;
    const uniqueZips = [...new Set(results.map((r) => r.zip).filter(Boolean))].filter(
      (z) => !(z in zipGeoCache.current)
    );
    if (uniqueZips.length === 0) return;
    geocodingRef.current = true;
    let idx = 0;
    const next = async () => {
      if (idx >= uniqueZips.length) { geocodingRef.current = false; return; }
      const zip = uniqueZips[idx++];
      const coords = await geocodeZip(zip);
      zipGeoCache.current[zip] = coords;
      setResultGeo((prev) => ({ ...prev, [zip]: coords }));
      setTimeout(next, 1100);
    };
    next();
  }, [filterRadiusMi, results]);

  const searchMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setSearched(false);
      const params = new URLSearchParams({
        zip: zipCode,
        ...(apiKey && { apiKey }),
        ...(filterType !== "all" && { propertyType: filterType }),
        ...(filterDateFrom && { saleDateFrom: filterDateFrom }),
        ...(filterDateTo && { saleDateTo: filterDateTo }),
      });
      const res = await fetch(`/api/public-search?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message || "Search failed");
      }
      return res.json() as Promise<PublicSearchResult[]>;
    },
    onSuccess: (data) => {
      setResults(data);
      setSearched(true);
    },
    onError: (err: Error) => {
      setError(err.message);
      setResults([]);
      setSearched(true);
    },
  });

  // Client-side filter pass
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      // Property type filter
      if (filterType !== "all" && r.propertyType && r.propertyType !== filterType) return false;

      // Date range filter
      if (filterDateFrom && r.saleDate && r.saleDate < filterDateFrom) return false;
      if (filterDateTo && r.saleDate && r.saleDate > filterDateTo) return false;

      // Size ±% filter (only when subjectSqFt is available and filter is set)
      if (filterSizePct > 0 && subjectSqFt && r.squareFeet) {
        const ratio = r.squareFeet / subjectSqFt;
        const bound = filterSizePct / 100;
        if (ratio < 1 - bound || ratio > 1 + bound) return false;
      }

      // Distance radius filter using ZIP centroids via Nominatim
      if (filterRadiusMi > 0 && subjectLatLng && r.zip) {
        const resultCoords = resultGeo[r.zip] ?? zipGeoCache.current[r.zip];
        if (resultCoords) {
          const dist = haversine(subjectLatLng[0], subjectLatLng[1], resultCoords[0], resultCoords[1]);
          if (dist > filterRadiusMi) return false;
        }
        // If coords not yet geocoded, include by default (don't hide while loading)
      }

      return true;
    });
  }, [results, filterType, filterDateFrom, filterDateTo, filterSizePct, subjectSqFt,
      filterRadiusMi, subjectLatLng, resultGeo]);

  const activeFilterCount = [
    filterType !== "all",
    !!filterDateFrom || !!filterDateTo,
    filterSizePct > 0,
    filterRadiusMi > 0,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterType("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterSizePct(0);
    setFilterRadiusMi(0);
  };

  const addMutation = useMutation({
    mutationFn: async ({ result, index }: { result: PublicSearchResult; index: number }) => {
      setAddingId(index);
      await apiRequest("POST", "/api/properties", {
        projectId,
        address: result.address,
        city: result.city,
        state: result.state,
        zip: result.zip,
        propertyType: result.propertyType || "residential",
        squareFeet: result.squareFeet ?? 0,
        lotSize: null,
        yearBuilt: result.yearBuilt ?? null,
        bedrooms: result.bedrooms ?? null,
        bathrooms: result.bathrooms ?? null,
        units: null,
        listPrice: result.listPrice ?? null,
        salePrice: result.salePrice ?? null,
        noi: null,
        grossRent: null,
        saleDate: result.saleDate ?? null,
        notes: `Imported from ${result.source}`,
        isSubject: false,
      });
    },
    onSuccess: () => {
      setAddingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "properties"] });
      onSuccess();
    },
    onError: () => setAddingId(null),
  });

  return (
    <div className="space-y-4">
      {/* API Key Notice */}
      <div className="rounded-md bg-muted/50 border border-border p-3 flex gap-2">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Uses{" "}
            <a
              href="https://apify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              Apify
            </a>{" "}
            to fetch recent sales data from Zillow. Get a free API token at{" "}
            <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="underline text-primary">apify.com</a>. Leave blank to use demo results.
          </p>
        </div>
      </div>

      {/* Search Form */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label htmlFor="zip-search" className="text-xs">ZIP Code</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="zip-search"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="e.g. 19103"
              className="w-36"
              data-testid="input-zip-search"
              onKeyDown={(e) => e.key === "Enter" && zipCode && searchMutation.mutate()}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Label htmlFor="rapid-key" className="text-xs">Apify API Token</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>Optional — leave blank for demo mode</TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="rapid-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your Apify token (optional)"
            data-testid="input-api-key"
          />
        </div>

        {/* MLS Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-2 justify-between" data-testid="button-toggle-filters">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Search Filters
                {activeFilterCount > 0 && (
                  <Badge className="text-[10px] h-4 px-1.5">{activeFilterCount}</Badge>
                )}
              </span>
              <span className="text-muted-foreground">{filtersOpen ? "▲" : "▼"}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3 border rounded-md p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MLS Filters</p>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="w-3 h-3" /> Clear all
                </Button>
              )}
            </div>

            {/* Property type */}
            <div>
              <Label className="text-xs">Property Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-filter-type">
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

            {/* Date range */}
            <div>
              <Label className="text-xs">Sale Date Range</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">From</p>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-8 text-xs"
                    data-testid="input-filter-date-from"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">To</p>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-8 text-xs"
                    data-testid="input-filter-date-to"
                  />
                </div>
              </div>
            </div>

            {/* Size ±% filter */}
            <div>
              <Label className="text-xs">
                Size Range{subjectSqFt ? ` (relative to subject: ${formatNumber(subjectSqFt)} SF)` : ""}
              </Label>
              <Select value={String(filterSizePct)} onValueChange={(v) => setFilterSizePct(Number(v))}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-filter-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No size filter</SelectItem>
                  <SelectItem value="10">±10% of subject</SelectItem>
                  <SelectItem value="25">±25% of subject</SelectItem>
                  <SelectItem value="50">±50% of subject</SelectItem>
                </SelectContent>
              </Select>
              {filterSizePct > 0 && !subjectSqFt && (
                <p className="text-[10px] text-amber-600 mt-0.5">Add a subject property first to use size filtering</p>
              )}
            </div>

            {/* Distance radius filter */}
            <div>
              <Label className="text-xs">
                Distance from Subject{subjectZip ? ` (ZIP ${subjectZip})` : ""}
              </Label>
              <Select value={String(filterRadiusMi)} onValueChange={(v) => setFilterRadiusMi(Number(v))}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-filter-radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any distance</SelectItem>
                  <SelectItem value="5">Within 5 miles</SelectItem>
                  <SelectItem value="10">Within 10 miles</SelectItem>
                  <SelectItem value="25">Within 25 miles</SelectItem>
                  <SelectItem value="50">Within 50 miles</SelectItem>
                </SelectContent>
              </Select>
              {filterRadiusMi > 0 && !subjectZip && (
                <p className="text-[10px] text-amber-600 mt-0.5">Add a subject property first to use distance filtering</p>
              )}
              {filterRadiusMi > 0 && subjectZip && !subjectLatLng && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Geocoding subject location…</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          onClick={() => searchMutation.mutate()}
          disabled={!zipCode || searchMutation.isPending}
          className="w-full"
          data-testid="button-search-public"
        >
          {searchMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          Search Recent Sales
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive rounded-md border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {searched && results.length === 0 && !error && (
        <p className="text-xs text-muted-foreground text-center py-4">No results found for ZIP {zipCode}.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {filteredResults.length} of {results.length} result{results.length !== 1 ? "s" : ""}
              {activeFilterCount > 0 && " (filtered)"}
            </p>
            <Badge variant="secondary" className="text-xs gap-1">
              <Globe className="w-3 h-3" />
              {results[0]?.source}
            </Badge>
          </div>
          <Separator />
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No results match the active filters.</p>
            ) : (
              filteredResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/30 transition-colors"
                  data-testid={`result-property-${i}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.city}, {r.state} {r.zip}
                      {r.saleDate && <span> · {r.saleDate}</span>}
                      {r.propertyType && <span> · {r.propertyType}</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {r.salePrice && (
                        <span className="text-xs tabular-nums font-medium">{formatCurrency(r.salePrice)}</span>
                      )}
                      {r.squareFeet && (
                        <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(r.squareFeet)} SF</span>
                      )}
                      {r.squareFeet && r.salePrice && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(r.salePrice / r.squareFeet)}/SF
                        </span>
                      )}
                      {r.yearBuilt && (
                        <span className="text-xs text-muted-foreground">Built {r.yearBuilt}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs"
                    onClick={() => addMutation.mutate({ result: r, index: i })}
                    disabled={addMutation.isPending && addingId === i}
                    data-testid={`button-add-result-${i}`}
                  >
                    {addMutation.isPending && addingId === i ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
