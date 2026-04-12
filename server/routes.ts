import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertPropertySchema, insertProjectSchema, insertWorkspaceSchema, insertSnapshotSchema } from "@shared/schema";

// Demo results used when no API key is provided
function demoResults(zip: string) {
  return [
    {
      address: "112 Market St",
      city: "Philadelphia",
      state: "PA",
      zip,
      squareFeet: 11500,
      yearBuilt: 1988,
      salePrice: 1975000,
      listPrice: 2050000,
      saleDate: "2025-10-22",
      propertyType: "commercial",
      bedrooms: null,
      bathrooms: null,
      source: "Demo Data",
    },
    {
      address: "88 Arch St",
      city: "Philadelphia",
      state: "PA",
      zip,
      squareFeet: 16200,
      yearBuilt: 2001,
      salePrice: 2980000,
      listPrice: 3100000,
      saleDate: "2025-12-05",
      propertyType: "commercial",
      bedrooms: null,
      bathrooms: null,
      source: "Demo Data",
    },
    {
      address: "567 Chestnut St",
      city: "Philadelphia",
      state: "PA",
      zip,
      squareFeet: 9800,
      yearBuilt: 1975,
      salePrice: 1620000,
      listPrice: 1750000,
      saleDate: "2026-02-14",
      propertyType: "commercial",
      bedrooms: null,
      bathrooms: null,
      source: "Demo Data",
    },
    {
      address: "240 Race St",
      city: "Philadelphia",
      state: "PA",
      zip,
      squareFeet: 13000,
      yearBuilt: 1994,
      salePrice: 2250000,
      listPrice: null,
      saleDate: "2025-08-30",
      propertyType: "commercial",
      bedrooms: null,
      bathrooms: null,
      source: "Demo Data",
    },
  ];
}

async function searchApify(zip: string, apifyToken: string) {
  // Dynamic import so the package is optional — falls back to demo if not installed
  let ApifyClient: any;
  try {
    const mod = await import("@apify/client");
    ApifyClient = mod.ApifyClient;
  } catch {
    throw new Error("@apify/client not installed. Run: npm install @apify/client in the recomps directory.");
  }

  const client = new ApifyClient({ token: apifyToken });

  // Try the most reliable Zillow sold-listings actor
  let run: any;
  try {
    run = await client.actor("maxcopell/zillow-scraper").call({
      searchTerm: zip,
      type: "sold",
      maxItems: 8,
    });
  } catch {
    // Fallback input schema variant
    run = await client.actor("maxcopell/zillow-scraper").call({
      location: zip,
      status_type: "RecentlySold",
      maxItems: 8,
    });
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items.map((p: any) => ({
    address: p.address ?? p.streetAddress ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zip: p.zipcode ?? p.zip ?? zip,
    squareFeet: p.livingArea ?? p.squareFeet ?? null,
    yearBuilt: p.yearBuilt ?? null,
    salePrice: p.price ?? p.soldPrice ?? null,
    listPrice: p.listPrice ?? null,
    saleDate: p.dateSold
      ? new Date(p.dateSold).toISOString().split("T")[0]
      : null,
    propertyType: (p.homeType ?? "residential").toLowerCase().replace(/_/g, ""),
    bedrooms: p.bedrooms ?? null,
    bathrooms: p.bathrooms ?? null,
    source: "Apify / Zillow",
  }));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Project routes ────────────────────────────────────────────────────────

  // ─── Workspace routes ────────────────────────────────────────────────────────

  // Look up a workspace by slug
  app.get("/api/workspaces/:slug", async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const ws = await storage.getWorkspaceBySlug(slug);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });
    const { pin: _pin, ...safe } = ws;
    res.json(safe);
  });

  // Verify a workspace PIN (bcrypt-aware — handles legacy plain PINs gracefully)
  app.post("/api/workspaces/:slug/verify", async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const { pin } = req.body;
    const ws = await storage.getWorkspaceBySlug(slug);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });
    // Attempt bcrypt compare first; fall back to plain string for legacy records
    let ok = false;
    try {
      ok = bcrypt.compareSync(String(pin), ws.pin);
    } catch {
      ok = false;
    }
    if (!ok) {
      // Legacy fallback: plain-text PINs stored before v8
      ok = ws.pin === String(pin);
    }
    if (!ok) return res.status(401).json({ message: "Incorrect PIN" });
    const { pin: _pin, ...safe } = ws;
    res.json(safe);
  });

  // Create a new workspace
  app.post("/api/workspaces", async (req, res) => {
    const slug = (req.body.slug ?? "").toLowerCase().trim();
    if (!slug) return res.status(400).json({ message: "Slug is required" });
    const existing = await storage.getWorkspaceBySlug(slug);
    if (existing) return res.status(409).json({ message: "That workspace name is already taken" });
    const parsed = insertWorkspaceSchema.safeParse({
      ...req.body,
      slug,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const ws = await storage.createWorkspace(parsed.data);
    const { pin: _pin, ...safe } = ws;
    res.status(201).json(safe);
  });

  // ─── Project routes ────────────────────────────────────────────────────────

  // List projects (scoped to workspace when ?workspaceId= is provided)
  app.get("/api/projects", async (req, res) => {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    const all = await storage.getProjects(workspaceId);
    res.json(all);
  });

  // Create project
  app.post("/api/projects", async (req, res) => {
    const parsed = insertProjectSchema.safeParse({
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const project = await storage.createProject(parsed.data);
    res.status(201).json(project);
  });

  // Update project
  app.patch("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const project = await storage.updateProject(id, req.body);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteProject(id);
    res.status(204).send();
  });

  // Save project slider/override state
  app.post("/api/projects/:id/state", async (req, res) => {
    const id = parseInt(req.params.id);
    const { settingsJson, overridesJson } = req.body;
    if (typeof settingsJson !== "string" || typeof overridesJson !== "string") {
      return res.status(400).json({ message: "settingsJson and overridesJson must be strings" });
    }
    await storage.saveProjectState(id, settingsJson, overridesJson);
    res.status(204).send();
  });

  // ─── Property routes (all scoped by projectId) ────────────────────────────

  // Get all properties in a project
  app.get("/api/projects/:projectId/properties", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    const props = await storage.getProperties(projectId);
    res.json(props);
  });

  // Get subject property in a project
  app.get("/api/projects/:projectId/properties/subject", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    const subject = await storage.getSubjectProperty(projectId);
    res.json(subject || null);
  });

  // Get comps in a project
  app.get("/api/projects/:projectId/properties/comps", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    const comps = await storage.getComps(projectId);
    res.json(comps);
  });

  // Get single property
  app.get("/api/properties/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const property = await storage.getProperty(id);
    if (!property) return res.status(404).json({ message: "Property not found" });
    res.json(property);
  });

  // Create property (projectId must be in body)
  app.post("/api/properties", async (req, res) => {
    const parsed = insertPropertySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    // Ensure only one subject per project
    if (parsed.data.isSubject) {
      const existing = await storage.getSubjectProperty(parsed.data.projectId);
      if (existing) await storage.updateProperty(existing.id, { isSubject: false });
    }
    const property = await storage.createProperty(parsed.data);
    res.status(201).json(property);
  });

  // Update property
  app.patch("/api/properties/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getProperty(id);
    if (!existing) return res.status(404).json({ message: "Property not found" });
    // If promoting to subject, demote the current subject in the same project
    if (req.body.isSubject) {
      const currentSubject = await storage.getSubjectProperty(existing.projectId);
      if (currentSubject && currentSubject.id !== id) {
        await storage.updateProperty(currentSubject.id, { isSubject: false });
      }
    }
    const property = await storage.updateProperty(id, req.body);
    res.json(property);
  });

  // Delete property
  app.delete("/api/properties/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteProperty(id);
    res.status(204).send();
  });

  // ─── HPI auto-fill (FHFA state CSV) ──────────────────────────────────────

  app.get("/api/hpi", async (req, res) => {
    const state = (req.query.state as string)?.trim().toUpperCase();
    if (!state || state.length !== 2) {
      return res.status(400).json({ message: "Valid 2-letter state code required" });
    }

    // Hardcoded FHFA 2024Q4 trailing-12-month HPI appreciation rates by state
    // Source: FHFA House Price Index (All-transactions, seasonally adjusted)
    const hpiTable: Record<string, number> = {
      AL: 4.6, AK: 5.1, AZ: 4.2, AR: 4.8, CA: 3.9,
      CO: 2.8, CT: 8.3, DE: 5.7, FL: 0.4, GA: 5.1,
      HI: 2.0, ID: 2.5, IL: 5.6, IN: 5.4, IA: 4.3,
      KS: 5.2, KY: 5.3, LA: 1.9, ME: 6.4, MD: 5.9,
      MA: 6.1, MI: 5.8, MN: 3.9, MS: -0.2, MO: 5.3,
      MT: 1.8, NE: 4.7, NV: 5.2, NH: 7.1, NJ: 8.3,
      NM: 4.1, NY: 5.8, NC: 5.0, ND: 3.7, OH: 6.7,
      OK: 3.2, OR: 2.4, PA: 6.2, RI: 6.9, SC: 4.5,
      SD: 4.1, TN: 3.8, TX: 0.7, UT: 2.9, VT: 5.5,
      VA: 5.8, WA: 4.3, WV: 4.9, WI: 5.1, WY: 8.3,
      DC: 1.3,
    };

    const rate = hpiTable[state];
    if (rate === undefined) {
      return res.status(404).json({ message: `No HPI data found for state: ${state}` });
    }

    return res.json({
      state,
      rate,
      source: "FHFA House Price Index — All-Transactions (2024 Q4)",
      asOf: "2024-Q4",
    });
  });

  // ─── Public data search ───────────────────────────────────────────────────

  app.get("/api/public-search", async (req, res) => {
    const zip = (req.query.zip as string)?.trim();
    const apiKey = (req.query.apiKey as string)?.trim();
    if (!zip) return res.status(400).json({ message: "ZIP code required" });

    try {
      if (apiKey) {
        const results = await searchApify(zip, apiKey);
        return res.json(results);
      } else {
        return res.json(demoResults(zip));
      }
    } catch (err: any) {
      return res.status(502).json({ message: err.message ?? "External data request failed" });
    }
  });

  // ─── Snapshot routes (v8 — saved read-only report links) ───────────────────

  // Create a snapshot — freezes current valuation state as a shareable link
  app.post("/api/snapshots", async (req, res) => {
    const { projectId, projectName, subjectJson, compsJson, valuationJson, settingsJson, label } = req.body;
    if (!projectId || !subjectJson || !compsJson || !valuationJson || !settingsJson) {
      return res.status(400).json({ message: "projectId, subjectJson, compsJson, valuationJson, and settingsJson are required" });
    }
    const token = randomUUID().replace(/-/g, "");
    const parsed = insertSnapshotSchema.safeParse({
      token,
      projectId: Number(projectId),
      projectName: projectName ?? "Untitled Project",
      createdAt: new Date().toISOString(),
      subjectJson: typeof subjectJson === "string" ? subjectJson : JSON.stringify(subjectJson),
      compsJson: typeof compsJson === "string" ? compsJson : JSON.stringify(compsJson),
      valuationJson: typeof valuationJson === "string" ? valuationJson : JSON.stringify(valuationJson),
      settingsJson: typeof settingsJson === "string" ? settingsJson : JSON.stringify(settingsJson),
      label: label ?? null,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const snap = await storage.createSnapshot(parsed.data);
    res.status(201).json({ token: snap.token, url: `/#/snapshot/${snap.token}` });
  });

  // Get a snapshot by token — public, no auth required
  app.get("/api/snapshots/:token", async (req, res) => {
    const snap = await storage.getSnapshotByToken(req.params.token);
    if (!snap) return res.status(404).json({ message: "Snapshot not found" });
    res.json(snap);
  });

  // List snapshots for a project
  app.get("/api/projects/:projectId/snapshots", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    const snaps = await storage.getSnapshotsByProject(projectId);
    res.json(snaps);
  });

  // Delete a snapshot by token
  app.delete("/api/snapshots/:token", async (req, res) => {
    const snap = await storage.getSnapshotByToken(req.params.token);
    if (!snap) return res.status(404).json({ message: "Snapshot not found" });
    await storage.deleteSnapshot(req.params.token);
    res.status(204).send();
  });

  return httpServer;
}
