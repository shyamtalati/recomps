import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Property, Project, Workspace } from "@shared/schema";
import { WorkspaceGate } from "@/components/workspace-gate";
import {
  calcValuation,
  formatCurrency,
  formatNumber,
  formatPercent,
  type ValuationSummary,
  type MethodWeights,
  type CompOverrides,
} from "@/lib/valuation";
import { PropertyForm } from "@/components/property-form";
import { CompsTable } from "@/components/comps-table";
import { ValuationPanel } from "@/components/valuation-panel";
import { ValuationSettings } from "@/components/valuation-settings";
import { PublicDataSearch } from "@/components/public-data-search";
import { CsvImport } from "@/components/csv-import";
import { ProjectSwitcher } from "@/components/project-switcher";
import { PropertyMap } from "@/components/property-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Plus, Target, BarChart3, TrendingUp, Layers, Moon, Sun,
  Settings2, Globe, Upload, FolderOpen, FileDown, LogOut, Bookmark, Copy, Check,
  BookOpen, Trash2, ExternalLink,
} from "lucide-react";
import { exportToPdf } from "@/components/pdf-export";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  // Show workspace gate until signed in
  if (!workspace) {
    return <WorkspaceGate onWorkspaceReady={setWorkspace} />;
  }

  return <WorkspaceHome workspace={workspace} onSignOut={() => setWorkspace(null)} />;
}

function WorkspaceHome({ workspace, onSignOut }: { workspace: Workspace; onSignOut: () => void }) {
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isSubjectForm, setIsSubjectForm] = useState(false);
  const [adjustmentOverrides, setAdjustmentOverrides] = useState<Record<number, CompOverrides>>({});
  const [annualAppreciationRate, setAnnualAppreciationRate] = useState(0);
  const [methodWeights, setMethodWeights] = useState<MethodWeights>({ sqft: 34, capRate: 33, grm: 33 });
  const [showImport, setShowImport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotCopied, setSnapshotCopied] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      if (!subject || !valuation || !activeProject) throw new Error("Missing data");
      const res = await apiRequest("POST", "/api/snapshots", {
        projectId: activeProject.id,
        projectName: activeProject.name,
        subjectJson: JSON.stringify(subject),
        compsJson: JSON.stringify(comps),
        valuationJson: JSON.stringify(valuation),
        settingsJson: JSON.stringify({ annualAppreciationRate, methodWeights }),
        label: snapshotLabel.trim() || null,
      });
      return res.json() as Promise<{ token: string; url: string }>;
    },
    onSuccess: (data) => {
      // Build the shareable absolute URL
      const base = window.location.origin + window.location.pathname;
      setSnapshotUrl(base + data.url);
    },
  });

  const toggleDark = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  useState(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  });

  // Load projects scoped to this workspace
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", workspace.id],
    queryFn: () => apiRequest("GET", `/api/projects?workspaceId=${workspace.id}`).then(r => r.json()) as Promise<Project[]>,
  });

  useEffect(() => {
    if (projects.length > 0 && activeProjectId === null) {
      handleProjectChange(projects[0].id);
    }
  }, [projects, activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save of slider/override state to the backend
  const saveState = useCallback((projectId: number, overrides: Record<number, CompOverrides>, rate: number, weights: MethodWeights) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiRequest("POST", `/api/projects/${projectId}/state`, {
        settingsJson: JSON.stringify({ annualAppreciationRate: rate, methodWeights: weights }),
        overridesJson: JSON.stringify(overrides),
      }).catch(() => {}); // fire and forget
    }, 800);
  }, []);

  // When project changes, load persisted state for that project
  const handleProjectChange = (projectId: number) => {
    setActiveProjectId(projectId);
    // Load persisted state from the project record
    const proj = projects.find((p) => p.id === projectId) as any;
    if (proj) {
      try {
        const settings = proj.settingsJson ? JSON.parse(proj.settingsJson) : null;
        const overrides = proj.overridesJson ? JSON.parse(proj.overridesJson) : null;
        setAnnualAppreciationRate(settings?.annualAppreciationRate ?? 0);
        setMethodWeights(settings?.methodWeights ?? { sqft: 34, capRate: 33, grm: 33 });
        // Re-key overrides as numbers (JSON keys are strings)
        if (overrides) {
          const reKeyed: Record<number, CompOverrides> = {};
          for (const k of Object.keys(overrides)) reKeyed[Number(k)] = overrides[k];
          setAdjustmentOverrides(reKeyed);
        } else {
          setAdjustmentOverrides({});
        }
      } catch {
        setAdjustmentOverrides({});
        setAnnualAppreciationRate(0);
        setMethodWeights({ sqft: 34, capRate: 33, grm: 33 });
      }
    } else {
      setAdjustmentOverrides({});
      setAnnualAppreciationRate(0);
      setMethodWeights({ sqft: 34, capRate: 33, grm: 33 });
    }
  };

  // Properties scoped to active project
  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["/api/projects", activeProjectId, "properties"],
    queryFn: () => apiRequest("GET", `/api/projects/${activeProjectId}/properties`).then(r => r.json()) as Promise<Property[]>,
    enabled: activeProjectId !== null && activeProjectId > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/properties/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", activeProjectId, "properties"] }),
  });

  const subject = properties.find((p) => p.isSubject);
  const comps = properties.filter((p) => !p.isSubject);

  const valuation: ValuationSummary | null =
    subject && comps.length > 0
      ? calcValuation(subject, comps, adjustmentOverrides, annualAppreciationRate, methodWeights)
      : null;

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setIsSubjectForm(property.isSubject);
    setShowForm(true);
  };

  const handleDelete = (id: number) => deleteMutation.mutate(id);

  const handleAdjustmentChange = (
    compId: number,
    field: "locationAdj" | "conditionAdj" | "weight",
    value: number
  ) => {
    setAdjustmentOverrides((prev) => {
      const next = {
        ...prev,
        [compId]: {
          locationAdj: prev[compId]?.locationAdj ?? 0,
          conditionAdj: prev[compId]?.conditionAdj ?? 0,
          weight: prev[compId]?.weight ?? 100,
          ...prev[compId],
          [field]: value,
        },
      };
      if (activeProjectId) saveState(activeProjectId, next, annualAppreciationRate, methodWeights);
      return next;
    });
  };

  const handleAppreciationRateChange = (rate: number) => {
    setAnnualAppreciationRate(rate);
    if (activeProjectId) saveState(activeProjectId, adjustmentOverrides, rate, methodWeights);
  };

  const handleMethodWeightsChange = (weights: MethodWeights) => {
    setMethodWeights(weights);
    if (activeProjectId) saveState(activeProjectId, adjustmentOverrides, annualAppreciationRate, weights);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProperty(null);
    queryClient.invalidateQueries({ queryKey: ["/api/projects", activeProjectId, "properties"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", workspace.id] });
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const noProjects = projects.length === 0;
  const noActiveProject = activeProjectId === null || activeProjectId < 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight" data-testid="text-app-title">
                ReComps
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Real Estate Comparable Analysis</p>
            </div>

            {/* Project switcher — sits right after the logo */}
            <div className="hidden sm:block ml-2 border-l border-border pl-3">
              <ProjectSwitcher
                activeProjectId={activeProjectId}
                onProjectChange={handleProjectChange}
                workspaceId={workspace.id}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mobile project switcher */}
            <div className="sm:hidden">
              <ProjectSwitcher
                activeProjectId={activeProjectId}
                onProjectChange={handleProjectChange}
                workspaceId={workspace.id}
              />
            </div>

            {/* Workspace badge + sign-out */}
            <Badge variant="secondary" className="text-xs hidden sm:flex items-center gap-1 h-7 px-2">
              {workspace.name}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSignOut}
              title="Sign out"
              data-testid="button-sign-out"
            >
              <LogOut className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleDark} className="h-8 w-8" data-testid="button-theme-toggle">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Settings sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-settings">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-sm">Valuation Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <ValuationSettings
                    annualAppreciationRate={annualAppreciationRate}
                    onAppreciationRateChange={handleAppreciationRateChange}
                    methodWeights={methodWeights}
                    onMethodWeightsChange={handleMethodWeightsChange}
                    subjectState={subject?.state ?? undefined}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {/* Saved Reports sheet — only when a project is active */}
            {!noActiveProject && (
              <SavedReportsSheet
                projectId={activeProjectId!}
                getSnapshotUrl={(token) =>
                  window.location.origin + window.location.pathname + `/#/snapshot/${token}`
                }
              />
            )}

            {/* PDF Export — only when there's a valuation */}
            {valuation && subject && activeProject && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={exportingPdf}
                data-testid="button-export-pdf"
                onClick={async () => {
                  setExportingPdf(true);
                  try {
                    await exportToPdf(subject, comps, valuation, activeProject.name);
                  } finally {
                    setExportingPdf(false);
                  }
                }}
              >
                <FileDown className="w-3.5 h-3.5" />
                {exportingPdf ? "Exporting…" : "Export PDF"}
              </Button>
            )}

            {/* Save Snapshot — only when there's a valuation */}
            {valuation && subject && activeProject && (
              <Dialog
                open={showSnapshotDialog}
                onOpenChange={(open) => {
                  setShowSnapshotDialog(open);
                  if (!open) {
                    setSnapshotUrl(null);
                    setSnapshotLabel("");
                    setSnapshotCopied(false);
                    snapshotMutation.reset();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" data-testid="button-save-snapshot">
                    <Bookmark className="w-3.5 h-3.5" />
                    Save Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-sm">Save Report Snapshot</DialogTitle>
                  </DialogHeader>
                  {snapshotUrl ? (
                    <div className="space-y-4 pt-1">
                      <p className="text-sm text-muted-foreground">
                        Your report has been saved. Share this link — it's read-only and public.
                      </p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={snapshotUrl}
                          className="flex-1 text-xs rounded-md border border-border bg-muted/40 px-3 py-2 font-mono truncate"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(snapshotUrl!);
                            setSnapshotCopied(true);
                            setTimeout(() => setSnapshotCopied(false), 2000);
                          }}
                        >
                          {snapshotCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs" htmlFor="snapshot-label">Label (optional)</Label>
                        <Input
                          id="snapshot-label"
                          placeholder="e.g. Q2 Draft, Final Appraisal…"
                          className="text-sm"
                          value={snapshotLabel}
                          onChange={(e) => setSnapshotLabel(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && snapshotMutation.mutate()}
                          data-testid="input-snapshot-label"
                        />
                      </div>
                      {snapshotMutation.isError && (
                        <p className="text-xs text-destructive">
                          {(snapshotMutation.error as Error)?.message ?? "Failed to save snapshot"}
                        </p>
                      )}
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() => snapshotMutation.mutate()}
                        disabled={snapshotMutation.isPending}
                        data-testid="button-create-snapshot"
                      >
                        {snapshotMutation.isPending ? "Saving…" : "Create shareable link"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}

            {/* Import dialog — only when a project is active */}
            {!noActiveProject && (
              <Dialog open={showImport} onOpenChange={setShowImport}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" data-testid="button-open-import">
                    <Upload className="w-3.5 h-3.5" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Comparable Properties</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="public">
                    <TabsList className="w-full mb-4">
                      <TabsTrigger value="public" className="flex-1 gap-1.5 text-xs">
                        <Globe className="w-3.5 h-3.5" />
                        Public Records
                      </TabsTrigger>
                      <TabsTrigger value="csv" className="flex-1 gap-1.5 text-xs">
                        <Upload className="w-3.5 h-3.5" />
                        CSV Import
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="public">
                      <PublicDataSearch
                        projectId={activeProjectId!}
                        onSuccess={() => setShowImport(false)}
                        subjectSqFt={subject?.squareFeet ?? undefined}
                        subjectZip={subject?.zip ?? undefined}
                      />
                    </TabsContent>
                    <TabsContent value="csv">
                      <CsvImport
                        projectId={activeProjectId!}
                        onSuccess={() => setShowImport(false)}
                      />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}

            {/* Manual comp form — only when a project is active */}
            {!noActiveProject && (
              <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingProperty(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8" onClick={() => { setIsSubjectForm(false); setEditingProperty(null); }} data-testid="button-add-comp">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Comp
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProperty
                        ? `Edit ${editingProperty.isSubject ? "Subject" : "Comparable"}`
                        : isSubjectForm ? "Add Subject Property" : "Add Comparable Property"}
                    </DialogTitle>
                  </DialogHeader>
                  <PropertyForm
                    isSubject={isSubjectForm}
                    existingProperty={editingProperty}
                    projectId={activeProjectId!}
                    onSuccess={handleFormSuccess}
                    onCancel={() => { setShowForm(false); setEditingProperty(null); }}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Empty state: no projects exist yet */}
        {noProjects && (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-medium mb-1">No projects yet</h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                Create a project to start a valuation. Each project has its own subject property and comparable sales.
              </p>
              <ProjectSwitcher activeProjectId={null} onProjectChange={handleProjectChange} workspaceId={workspace.id} />
            </CardContent>
          </Card>
        )}

        {/* Normal content when a project is active */}
        {!noProjects && !noActiveProject && (
          <>
            {/* Subject Property */}
            <section>
              {isLoading ? (
                <Card><CardContent className="p-6"><Skeleton className="h-6 w-48 mb-4" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
              ) : subject ? (
                <Card className="border-primary/30 bg-primary/[0.02]">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        <CardTitle className="text-sm font-semibold">Subject Property</CardTitle>
                        <Badge variant="secondary" className="text-xs">{subject.propertyType}</Badge>
                        {annualAppreciationRate !== 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {annualAppreciationRate > 0 ? "+" : ""}{annualAppreciationRate}%/yr time adj
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(subject)} data-testid="button-edit-subject">Edit</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                        <p className="text-sm font-medium" data-testid="text-subject-address">{subject.address}</p>
                        <p className="text-xs text-muted-foreground">{subject.city}, {subject.state} {subject.zip}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Size</p>
                        <p className="text-sm font-medium tabular-nums">{formatNumber(subject.squareFeet)} SF</p>
                        {subject.lotSize && <p className="text-xs text-muted-foreground">{formatNumber(subject.lotSize, 2)} acres</p>}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Year Built</p>
                        <p className="text-sm font-medium tabular-nums">{subject.yearBuilt ?? "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Asking / NOI</p>
                        <p className="text-sm font-medium tabular-nums">{formatCurrency(subject.listPrice)}</p>
                        {subject.noi && <p className="text-xs text-muted-foreground tabular-nums">NOI: {formatCurrency(subject.noi)}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Target className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                    <h3 className="text-sm font-medium mb-1">No Subject Property</h3>
                    <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
                      Start by adding the property you want to value. Then add comparable sales to generate an analysis.
                    </p>
                    <Button size="sm" onClick={() => { setIsSubjectForm(true); setEditingProperty(null); setShowForm(true); }} data-testid="button-add-subject">
                      <Plus className="w-4 h-4 mr-1" />Add Subject Property
                    </Button>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* KPI Row */}
            {valuation && valuation.recommendedRange && (
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Est. Value ($/SF)" value={formatCurrency(valuation.estimatedValueBySqFt)} sub={`${formatCurrency(valuation.avgPricePerSqFt)}/SF avg`} />
                <KpiCard icon={<BarChart3 className="w-4 h-4" />} label="Est. Value (Cap Rate)" value={formatCurrency(valuation.estimatedValueByCapRate)} sub={valuation.avgCapRate ? `${formatPercent(valuation.avgCapRate)} avg cap` : "No NOI data"} />
                <KpiCard icon={<Layers className="w-4 h-4" />} label="Est. Value (GRM)" value={formatCurrency(valuation.estimatedValueByGRM)} sub={valuation.avgGRM ? `${formatNumber(valuation.avgGRM, 1)}x avg GRM` : "No rent data"} />
                <KpiCard
                  icon={<Target className="w-4 h-4" />}
                  label="Reconciled Value"
                  value={formatCurrency(valuation.reconciledValue)}
                  sub={`Range: ${formatCurrency(valuation.recommendedRange.low)}–${formatCurrency(valuation.recommendedRange.high)}`}
                  highlight
                />
              </section>
            )}

            {/* Comps Table */}
            <section>
              <CompsTable
                comps={comps}
                subject={subject ?? null}
                valuation={valuation}
                adjustmentOverrides={adjustmentOverrides}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdjustmentChange={handleAdjustmentChange}
                isLoading={isLoading}
                annualAppreciationRate={annualAppreciationRate}
              />
            </section>

            {/* Map View — show when subject exists and there are comps */}
            {subject && comps.length > 0 && (
              <section>
                <PropertyMap
                  subject={subject}
                  comps={comps}
                  adjustedComps={valuation?.adjustedComps ?? []}
                />
              </section>
            )}

            {/* Valuation Panel */}
            {valuation && subject && (
              <section>
                <ValuationPanel valuation={valuation} subject={subject} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/30 bg-primary/[0.03]" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-2">{icon}<span className="text-xs font-medium">{label}</span></div>
        <p className="text-lg font-semibold tabular-nums leading-tight" data-testid={`text-kpi-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Saved Reports Sheet ──────────────────────────────────────────────────────

interface SnapshotRow {
  id: number;
  token: string;
  projectId: number;
  projectName: string;
  createdAt: string;
  label: string | null;
}

function SavedReportsSheet({
  projectId,
  getSnapshotUrl,
}: {
  projectId: number;
  getSnapshotUrl: (token: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [deletingToken, setDeletingToken] = useState<string | null>(null);

  const { data: snapshots = [], isLoading, refetch } = useQuery<SnapshotRow[]>({
    queryKey: ["/api/projects", projectId, "snapshots"],
    queryFn: () =>
      apiRequest("GET", `/api/projects/${projectId}/snapshots`).then((r) => r.json()),
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: async (token: string) => {
      setDeletingToken(token);
      await apiRequest("DELETE", `/api/snapshots/${token}`);
    },
    onSuccess: () => {
      setDeletingToken(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "snapshots"] });
    },
    onError: () => setDeletingToken(null),
  });

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getSnapshotUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Saved reports"
          data-testid="button-saved-reports"
        >
          <BookOpen className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-80 flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="text-sm">Saved Reports</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
              <Bookmark className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No saved reports yet.</p>
              <p className="text-xs text-muted-foreground">
                Use the <strong>Save Report</strong> button to freeze and share a valuation.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sorted.map((snap) => {
                const date = new Date(snap.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const url = getSnapshotUrl(snap.token);
                return (
                  <li key={snap.token} className="px-4 py-3 group hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {snap.label || "Untitled report"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Open report"
                          onClick={() => window.open(url, "_blank")}
                          data-testid={`button-open-snapshot-${snap.token}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Copy link"
                          onClick={() => copyLink(snap.token)}
                          data-testid={`button-copy-snapshot-${snap.token}`}
                        >
                          {copiedToken === snap.token ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={() => deleteMutation.mutate(snap.token)}
                          disabled={deletingToken === snap.token}
                          data-testid={`button-delete-snapshot-${snap.token}`}
                        >
                          {deletingToken === snap.token ? (
                            <div className="w-3.5 h-3.5 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Token preview */}
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono truncate">
                      {snap.token}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            {sorted.length} saved report{sorted.length !== 1 ? "s" : ""}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
