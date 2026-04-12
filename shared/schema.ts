import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Workspaces (v7 multi-tenancy) ---
export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),          // display name
  slug: text("slug").notNull(),          // URL-safe unique identifier (login name)
  pin: text("pin").notNull(),            // 4-digit PIN (stored as plain text — no sensitive data here)
  createdAt: text("created_at").notNull(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true });
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id"),  // nullable — null = legacy/global projects (v7 migration)
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  // Persisted slider/settings state — stored as JSON strings
  settingsJson: text("settings_json"),   // { annualAppreciationRate, methodWeights }
  overridesJson: text("overrides_json"), // Record<compId, CompOverrides>
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  propertyType: text("property_type").notNull(), // "residential" | "commercial" | "multifamily" | "industrial"
  squareFeet: real("square_feet").notNull(),
  lotSize: real("lot_size"),          // acres
  yearBuilt: integer("year_built"),
  bedrooms: integer("bedrooms"),
  bathrooms: real("bathrooms"),
  units: integer("units"),            // multifamily only
  listPrice: real("list_price"),
  salePrice: real("sale_price"),
  noi: real("noi"),                   // net operating income (commercial)
  grossRent: real("gross_rent"),      // annual gross rent
  saleDate: text("sale_date"),        // ISO date string "YYYY-MM-DD"
  notes: text("notes"),
  isSubject: integer("is_subject", { mode: "boolean" }).notNull().default(false),
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// --- Snapshots (v8 saved reports) ---
export const snapshots = sqliteTable("snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull(),           // unique URL-safe token (e.g. uuid-v4 hex)
  projectId: integer("project_id").notNull(),
  projectName: text("project_name").notNull(),
  createdAt: text("created_at").notNull(),
  subjectJson: text("subject_json").notNull(),    // frozen Property
  compsJson: text("comps_json").notNull(),        // frozen Property[]
  valuationJson: text("valuation_json").notNull(), // frozen ValuationSummary
  settingsJson: text("settings_json").notNull(),  // { annualAppreciationRate, methodWeights }
  label: text("label"),                          // optional user label
});

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({ id: true });
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type Snapshot = typeof snapshots.$inferSelect;
