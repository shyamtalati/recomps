import { Button } from "@/components/ui/button";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Multiple Valuation Methods",
    description: "Analyze comps using price per sq ft, cap rate, and gross rent multiplier — then blend them with configurable weights.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
    title: "Interactive Map View",
    description: "Visualize your subject property and all comparables on an interactive map to assess location and proximity.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "PDF Export",
    description: "Generate polished, professional reports with a single click — ready to share with clients or partners.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    title: "CSV Import",
    description: "Bulk-load comparable property data from spreadsheets — no manual entry required.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    title: "Snapshot Sharing",
    description: "Freeze any analysis and share it via a permanent link — collaborators see exactly what you see.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: "Multi-Workspace",
    description: "Keep projects organized across separate workspaces — ideal for teams or multiple client portfolios.",
  },
];

const steps = [
  {
    number: "01",
    title: "Add your subject property",
    description: "Enter the property details — address, type, square footage, and financials — to establish your valuation baseline.",
  },
  {
    number: "02",
    title: "Find or import comparables",
    description: "Search public listing data, import from CSV, or add comps manually. Filter by property type, date, and location.",
  },
  {
    number: "03",
    title: "Get weighted valuations instantly",
    description: "ReComps calculates estimated value using multiple methods simultaneously and combines them into a single weighted result.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex h-14 items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-primary">ReComps</span>
          <a href="#/app">
            <Button size="sm">Open App</Button>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        {/* Subtle radial gradient accent */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--primary)) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-24 sm:py-36 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            Real estate comparable analysis
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Analyze Real Estate Comps
            <br />
            <span className="text-primary">with Confidence</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground mb-10">
            ReComps helps real estate professionals find, compare, and value properties using
            multiple industry-standard methods — all in one focused workspace.
          </p>
          <a href="#/app">
            <Button size="lg" className="px-8">
              Get Started
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ml-2 w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Button>
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Everything you need for comp analysis
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            From data import to shareable reports — built specifically for real estate valuation workflows.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-border bg-card p-6 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">How it works</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              From zero to a complete valuation in three steps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.number} className="relative flex flex-col gap-4">
                {/* Connector line between steps on desktop */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-[calc(100%_-_1rem)] w-full h-px bg-border -translate-y-0.5 pointer-events-none" />
                )}
                <div className="text-3xl font-bold text-primary/20 font-mono leading-none">
                  {step.number}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Ready to start analyzing comps?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Open the app, set up your workspace, and run your first analysis in minutes.
          </p>
          <a href="#/app">
            <Button size="lg" className="px-8">Open App</Button>
          </a>
        </div>
      </section>

      {/* Footer bar */}
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-12 flex items-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ReComps. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
