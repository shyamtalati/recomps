import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { Property } from "@shared/schema";
import type { ValuationSummary } from "@/lib/valuation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/valuation";

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a2e",
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    backgroundColor: "#ffffff",
  },
  // Header
  header: {
    marginBottom: 20,
    borderBottom: "1.5pt solid #1e40af",
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  // Logo pill
  logoPill: {
    backgroundColor: "#1e40af",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  logoPillText: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 0.5 },
  appName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1e40af" },
  appSub: { fontSize: 8, color: "#64748b", marginTop: 2 },
  projectName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1a1a2e", marginTop: 4 },
  reportDate: { fontSize: 8, color: "#64748b" },
  reportLabel: { fontSize: 7, color: "#94a3b8", marginBottom: 1 },
  // Section headers
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Subject property card
  subjectCard: {
    backgroundColor: "#f0f4ff",
    borderRadius: 4,
    padding: 10,
    marginBottom: 4,
  },
  subjectAddress: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subjectCity: { fontSize: 9, color: "#64748b", marginBottom: 8 },
  subjectGrid: { flexDirection: "row", gap: 16 },
  subjectItem: { flex: 1 },
  subjectLabel: { fontSize: 7.5, color: "#64748b", marginBottom: 1 },
  subjectValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  // KPI row
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 8,
    border: "0.5pt solid #e2e8f0",
  },
  kpiCardHighlight: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    padding: 8,
    border: "1pt solid #bfdbfe",
  },
  kpiLabel: { fontSize: 7, color: "#64748b", marginBottom: 3 },
  kpiValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1a1a2e" },
  kpiSub: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  // Table
  table: { width: "100%", marginBottom: 4 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a5f",
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 1,
  },
  tableHeaderCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: "0.5pt solid #f1f5f9",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "#f8fafc",
    borderBottom: "0.5pt solid #f1f5f9",
  },
  tableRowOutlier: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "#fffbeb",
    borderBottom: "0.5pt solid #fde68a",
  },
  cell: { fontSize: 8 },
  cellBold: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  cellGreen: { fontSize: 8, color: "#16a34a" },
  cellRed: { fontSize: 8, color: "#dc2626" },
  cellAmber: { fontSize: 8, color: "#d97706" },
  // Valuation methods
  methodRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  methodCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 8,
    border: "0.5pt solid #e2e8f0",
  },
  methodLabel: { fontSize: 7.5, color: "#64748b", marginBottom: 2 },
  methodValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  methodWeight: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  // Reconciled hero
  reconciled: {
    backgroundColor: "#1e3a5f",
    borderRadius: 4,
    padding: 12,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reconciledLabel: { fontSize: 9, color: "#93c5fd", marginBottom: 2 },
  reconciledValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  reconciledRange: { fontSize: 7.5, color: "#93c5fd", marginTop: 2 },
  reconciledRight: { alignItems: "flex-end" },
  reconciledMethodLabel: { fontSize: 7, color: "#93c5fd" },
  reconciledMethodValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", marginTop: 1 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: "#94a3b8" },
  // Score badge
  scoreBadge: { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
});

// ─── Column widths ─────────────────────────────────────────────────────────────

const COL = {
  address: "26%",
  size: "9%",
  price: "12%",
  psf: "9%",
  cap: "8%",
  grm: "7%",
  adj: "8%",
  adjPrice: "12%",
  score: "9%",
};

// ─── PDF Document ──────────────────────────────────────────────────────────────

interface ReportProps {
  subject: Property;
  comps: Property[];
  valuation: ValuationSummary;
  projectName: string;
}

function ReportDocument({ subject, comps, valuation, projectName }: ReportProps) {
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <Document>
      <Page size="LETTER" style={styles.page} orientation="landscape">
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.logoPill}>
              <Text style={styles.logoPillText}>ReComps</Text>
            </View>
            <Text style={styles.appSub}>Real Estate Comparable Analysis</Text>
            <Text style={styles.projectName}>{projectName}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.reportLabel}>Report Date</Text>
            <Text style={styles.reportDate}>{now}</Text>
            <Text style={[styles.reportLabel, { marginTop: 6 }]}>Confidential — For internal use only</Text>
          </View>
        </View>

        {/* Subject Property */}
        <Text style={styles.sectionTitle}>Subject Property</Text>
        <View style={styles.subjectCard}>
          <Text style={styles.subjectAddress}>{subject.address}</Text>
          <Text style={styles.subjectCity}>{subject.city}, {subject.state} {subject.zip}</Text>
          <View style={styles.subjectGrid}>
            <View style={styles.subjectItem}>
              <Text style={styles.subjectLabel}>Property Type</Text>
              <Text style={styles.subjectValue}>{subject.propertyType}</Text>
            </View>
            <View style={styles.subjectItem}>
              <Text style={styles.subjectLabel}>Size</Text>
              <Text style={styles.subjectValue}>{formatNumber(subject.squareFeet)} SF</Text>
            </View>
            <View style={styles.subjectItem}>
              <Text style={styles.subjectLabel}>Year Built</Text>
              <Text style={styles.subjectValue}>{subject.yearBuilt ?? "N/A"}</Text>
            </View>
            <View style={styles.subjectItem}>
              <Text style={styles.subjectLabel}>Asking Price</Text>
              <Text style={styles.subjectValue}>{formatCurrency(subject.listPrice)}</Text>
            </View>
            {subject.noi != null && (
              <View style={styles.subjectItem}>
                <Text style={styles.subjectLabel}>NOI</Text>
                <Text style={styles.subjectValue}>{formatCurrency(subject.noi)}/yr</Text>
              </View>
            )}
            {subject.grossRent != null && (
              <View style={styles.subjectItem}>
                <Text style={styles.subjectLabel}>Gross Rent</Text>
                <Text style={styles.subjectValue}>{formatCurrency(subject.grossRent)}/yr</Text>
              </View>
            )}
          </View>
        </View>

        {/* Valuation Summary KPIs */}
        <Text style={styles.sectionTitle}>Valuation Summary</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Est. Value ($/SF)</Text>
            <Text style={styles.kpiValue}>{formatCurrency(valuation.estimatedValueBySqFt)}</Text>
            <Text style={styles.kpiSub}>{formatCurrency(valuation.avgPricePerSqFt)}/SF avg</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Est. Value (Cap Rate)</Text>
            <Text style={styles.kpiValue}>{formatCurrency(valuation.estimatedValueByCapRate)}</Text>
            <Text style={styles.kpiSub}>{valuation.avgCapRate ? `${formatPercent(valuation.avgCapRate)} avg cap` : "No NOI data"}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Est. Value (GRM)</Text>
            <Text style={styles.kpiValue}>{formatCurrency(valuation.estimatedValueByGRM)}</Text>
            <Text style={styles.kpiSub}>{valuation.avgGRM ? `${formatNumber(valuation.avgGRM, 1)}x avg GRM` : "No rent data"}</Text>
          </View>
          <View style={styles.kpiCardHighlight}>
            <Text style={styles.kpiLabel}>Weighted Reconciled Value</Text>
            <Text style={[styles.kpiValue, { color: "#1e40af", fontSize: 13 }]}>{formatCurrency(valuation.reconciledValue)}</Text>
            {valuation.recommendedRange && (
              <Text style={styles.kpiSub}>
                Range: {formatCurrency(valuation.recommendedRange.low)} – {formatCurrency(valuation.recommendedRange.high)}
              </Text>
            )}
          </View>
        </View>

        {/* Comparables Table */}
        <Text style={styles.sectionTitle}>Comparable Sales ({comps.length})</Text>
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: COL.address }]}>Address</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.size, textAlign: "right" }]}>Size SF</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.price, textAlign: "right" }]}>Sale Price</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.psf, textAlign: "right" }]}>$/SF</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.cap, textAlign: "right" }]}>Cap Rate</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.grm, textAlign: "right" }]}>GRM</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.adj, textAlign: "right" }]}>Adj %</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.adjPrice, textAlign: "right" }]}>Adj Price</Text>
            <Text style={[styles.tableHeaderCell, { width: COL.score, textAlign: "right" }]}>Score</Text>
          </View>
          {/* Rows */}
          {valuation.adjustedComps.map((ac, i) => {
            const rowStyle = ac.score?.isOutlier
              ? styles.tableRowOutlier
              : i % 2 === 0
              ? styles.tableRow
              : styles.tableRowAlt;
            const adj = ac.adjustments.totalAdj;
            const adjStyle = adj > 0 ? styles.cellGreen : adj < 0 ? styles.cellRed : styles.cell;
            const scoreColor = ac.score?.isOutlier
              ? "#d97706"
              : (ac.score?.total ?? 0) >= 75
              ? "#16a34a"
              : (ac.score?.total ?? 0) >= 50
              ? "#2563eb"
              : "#94a3b8";

            return (
              <View key={ac.comp.id} style={rowStyle}>
                <View style={{ width: COL.address }}>
                  <Text style={styles.cellBold}>{ac.comp.address}</Text>
                  <Text style={[styles.cell, { color: "#64748b", fontSize: 7 }]}>
                    {ac.comp.city}, {ac.comp.state}{ac.comp.saleDate ? ` · ${ac.comp.saleDate}` : ""}
                  </Text>
                </View>
                <Text style={[styles.cell, { width: COL.size, textAlign: "right" }]}>{formatNumber(ac.comp.squareFeet)}</Text>
                <Text style={[styles.cell, { width: COL.price, textAlign: "right" }]}>{formatCurrency(ac.comp.salePrice ?? ac.comp.listPrice)}</Text>
                <Text style={[styles.cell, { width: COL.psf, textAlign: "right" }]}>{formatCurrency(ac.metrics.pricePerSqFt)}</Text>
                <Text style={[styles.cell, { width: COL.cap, textAlign: "right" }]}>{ac.metrics.capRate != null ? formatPercent(ac.metrics.capRate) : "—"}</Text>
                <Text style={[styles.cell, { width: COL.grm, textAlign: "right" }]}>{ac.metrics.grm != null ? `${formatNumber(ac.metrics.grm, 1)}x` : "—"}</Text>
                <Text style={[adjStyle, { width: COL.adj, textAlign: "right" }]}>{adj > 0 ? "+" : ""}{formatPercent(adj, 1)}</Text>
                <Text style={[styles.cellBold, { width: COL.adjPrice, textAlign: "right" }]}>{formatCurrency(ac.adjustedPrice)}</Text>
                <Text style={[styles.cell, { width: COL.score, textAlign: "right", color: scoreColor }]}>
                  {ac.score?.isOutlier ? "⚠ Outlier" : ac.score ? `${ac.score.total}/100` : "—"}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Valuation Method Detail */}
        <Text style={styles.sectionTitle}>Valuation Methods</Text>
        <View style={styles.methodRow}>
          <View style={styles.methodCard}>
            <Text style={styles.methodLabel}>Sales Comparison ($/SF) — {valuation.methodWeights.sqft}% weight</Text>
            <Text style={styles.methodValue}>{formatCurrency(valuation.estimatedValueBySqFt)}</Text>
            <Text style={styles.methodWeight}>{formatCurrency(valuation.avgPricePerSqFt)}/SF avg × {formatNumber(subject.squareFeet)} SF</Text>
          </View>
          <View style={styles.methodCard}>
            <Text style={styles.methodLabel}>Income (Cap Rate) — {valuation.methodWeights.capRate}% weight</Text>
            <Text style={styles.methodValue}>{formatCurrency(valuation.estimatedValueByCapRate)}</Text>
            <Text style={styles.methodWeight}>{subject.noi ? `${formatCurrency(subject.noi)} NOI ÷ ${formatPercent(valuation.avgCapRate)} cap` : "No NOI data"}</Text>
          </View>
          <View style={styles.methodCard}>
            <Text style={styles.methodLabel}>Income (GRM) — {valuation.methodWeights.grm}% weight</Text>
            <Text style={styles.methodValue}>{formatCurrency(valuation.estimatedValueByGRM)}</Text>
            <Text style={styles.methodWeight}>{subject.grossRent ? `${formatNumber(valuation.avgGRM, 1)}x GRM × ${formatCurrency(subject.grossRent)} rent` : "No rent data"}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ReComps — Comparable Analysis Report · {projectName}</Text>
          <Text style={styles.footerText}>Generated {now} · For informational purposes only</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Export trigger ─────────────────────────────────────────────────────────────

export async function exportToPdf(
  subject: Property,
  comps: Property[],
  valuation: ValuationSummary,
  projectName: string
): Promise<void> {
  const blob = await pdf(
    <ReportDocument subject={subject} comps={comps} valuation={valuation} projectName={projectName} />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recomps-${projectName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
