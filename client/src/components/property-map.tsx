import { useEffect, useRef, useState } from "react";
import type { Property } from "@shared/schema";
import type { AdjustedComp } from "@/lib/valuation";
import { formatCurrency, formatNumber } from "@/lib/valuation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

interface PropertyMapProps {
  subject: Property | null;
  comps: Property[];
  adjustedComps: AdjustedComp[];
}

interface GeoResult {
  lat: number;
  lon: number;
}

// Nominatim geocoder — free, no API key, rate limit 1 req/sec
async function geocodeAddress(address: string, city: string, state: string, zip: string): Promise<GeoResult | null> {
  const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "ReComps/1.0" } }
    );
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// Stagger requests to respect Nominatim's 1 req/sec rate limit
async function geocodeAll(properties: Property[]): Promise<Map<number, GeoResult>> {
  const results = new Map<number, GeoResult>();
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 1100)); // 1.1s gap
    const geo = await geocodeAddress(p.address, p.city, p.state, p.zip);
    if (geo) results.set(p.id, geo);
  }
  return results;
}

export function PropertyMap({ subject, comps, adjustedComps }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geocoded, setGeocoded] = useState(0);
  const [total, setTotal] = useState(0);

  const allProperties = [...(subject ? [subject] : []), ...comps];

  useEffect(() => {
    if (!mapRef.current || allProperties.length === 0) return;

    let cancelled = false;

    async function initMap() {
      setLoading(true);
      setError(null);

      // Dynamic import of Leaflet (avoids SSR issues)
      const L = (await import("leaflet")).default;

      // Fix default icon paths (Leaflet + bundlers break without this)
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Init map if not already created
      if (!leafletMapRef.current) {
        leafletMapRef.current = L.map(mapRef.current!, {
          center: [39.5, -98.35],
          zoom: 4,
          scrollWheelZoom: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(leafletMapRef.current);
      }

      // Clear old markers
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      setTotal(allProperties.length);

      // Geocode all properties with rate limiting
      const geoMap = new Map<number, GeoResult>();
      for (let i = 0; i < allProperties.length; i++) {
        if (cancelled) return;
        const p = allProperties[i];
        if (i > 0) await new Promise((r) => setTimeout(r, 1100));
        const geo = await geocodeAddress(p.address, p.city, p.state, p.zip);
        if (geo) geoMap.set(p.id, geo);
        setGeocoded(i + 1);
      }

      if (cancelled) return;

      // Place markers
      const bounds: [number, number][] = [];

      for (const p of allProperties) {
        const geo = geoMap.get(p.id);
        if (!geo) continue;
        bounds.push([geo.lat, geo.lon]);

        const isSubj = p.isSubject;
        const ac = adjustedComps.find((c) => c.comp.id === p.id);
        const isOutlier = ac?.score?.isOutlier;
        const score = ac?.score?.total ?? null;

        // Color: subject = blue, outlier = amber, high score = green, mid = teal, low = gray
        const color = isSubj
          ? "#1e40af"
          : isOutlier
          ? "#d97706"
          : score != null && score >= 75
          ? "#16a34a"
          : score != null && score >= 50
          ? "#0891b2"
          : "#64748b";

        const icon = L.divIcon({
          className: "",
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -28],
          html: `<div style="
            width:28px;height:28px;border-radius:50% 50% 50% 0;
            background:${color};border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.35);
            transform:rotate(-45deg);
          "></div>`,
        });

        const price = p.salePrice ?? p.listPrice;
        const adjPrice = ac?.adjustedPrice;
        const popupContent = `
          <div style="font-family:sans-serif;font-size:12px;min-width:180px">
            <div style="font-weight:700;margin-bottom:4px;color:${color}">${isSubj ? "📍 Subject" : "Comparable"}</div>
            <div style="font-weight:600;margin-bottom:2px">${p.address}</div>
            <div style="color:#64748b;margin-bottom:6px">${p.city}, ${p.state} ${p.zip}</div>
            ${p.squareFeet ? `<div><span style="color:#64748b">Size: </span>${formatNumber(p.squareFeet)} SF</div>` : ""}
            ${price ? `<div><span style="color:#64748b">Sale Price: </span>${formatCurrency(price)}</div>` : ""}
            ${adjPrice && !isSubj ? `<div><span style="color:#64748b">Adj. Price: </span><strong>${formatCurrency(adjPrice)}</strong></div>` : ""}
            ${ac?.score != null && !isSubj ? `<div style="margin-top:4px"><span style="color:#64748b">Score: </span><strong>${isOutlier ? "⚠ Outlier" : `${ac.score.total}/100`}</strong></div>` : ""}
          </div>
        `;

        const marker = L.marker([geo.lat, geo.lon], { icon })
          .addTo(leafletMapRef.current)
          .bindPopup(popupContent);
        markersRef.current.push(marker);
      }

      if (bounds.length > 0) {
        leafletMapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }

      setLoading(false);
    }

    initMap().catch((e) => {
      setError(e.message);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [subject?.id, comps.map((c) => c.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const geocodedCount = markersRef.current.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Map View</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#1e40af" }} />
                Subject
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#16a34a" }} />
                High score
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#d97706" }} />
                Outlier
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#64748b" }} />
                Low score
              </span>
            </div>
            {loading && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Geocoding {geocoded}/{total}…
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <div
          ref={mapRef}
          className="w-full rounded-md border border-border overflow-hidden"
          style={{ height: 380 }}
          data-testid="map-container"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Addresses geocoded via{" "}
          <a
            href="https://nominatim.openstreetmap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Nominatim / OpenStreetMap
          </a>
          . Click a pin for details.
        </p>
      </CardContent>
    </Card>
  );
}
