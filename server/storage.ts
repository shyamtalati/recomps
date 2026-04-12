import bcrypt from "bcryptjs";
import {
  type Property, type InsertProperty,
  type Project, type InsertProject,
  type Workspace, type InsertWorkspace,
  type Snapshot, type InsertSnapshot,
  properties, projects, workspaces, snapshots,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ─── Database setup ───────────────────────────────────────────────────────────
//
// SQLite (default — local dev):
//   Just run. data.db is created automatically.
//
// Postgres (production — set DATABASE_URL env var):
//   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
//
// ─────────────────────────────────────────────────────────────────────────────

let _db: any = null;

async function getDb(): Promise<any> {
  if (_db) return _db;

  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg") as any;
    const { drizzle } = await import("drizzle-orm/node-postgres") as any;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    // Run idempotent migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        settings_json TEXT,
        overrides_json TEXT,
        workspace_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip TEXT NOT NULL,
        property_type TEXT NOT NULL,
        square_feet REAL NOT NULL,
        lot_size REAL,
        year_built INTEGER,
        bedrooms INTEGER,
        bathrooms REAL,
        units INTEGER,
        list_price REAL,
        sale_price REAL,
        noi REAL,
        gross_rent REAL,
        sale_date TEXT,
        notes TEXT,
        is_subject INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        pin TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        project_id INTEGER NOT NULL,
        project_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        subject_json TEXT NOT NULL,
        comps_json TEXT NOT NULL,
        valuation_json TEXT NOT NULL,
        settings_json TEXT NOT NULL,
        label TEXT
      );
    `);
    _db = drizzle(pool);
    console.log("[db] Using Postgres (DATABASE_URL detected).");
  } else {
    const Database = (await import("better-sqlite3") as any).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3") as any;
    const sqlite = new Database("data.db");
    sqlite.pragma("journal_mode = WAL");
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS properties_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        address TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, zip TEXT NOT NULL,
        property_type TEXT NOT NULL, square_feet REAL NOT NULL, lot_size REAL,
        year_built INTEGER, bedrooms INTEGER, bathrooms REAL, units INTEGER,
        list_price REAL, sale_price REAL, noi REAL, gross_rent REAL,
        sale_date TEXT, notes TEXT, is_subject INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO projects (id, name, description, created_at)
        SELECT 1, 'Default Project', 'Auto-created on migration', datetime('now')
        WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='properties')
          AND NOT EXISTS (SELECT 1 FROM projects WHERE id = 1);
      INSERT OR IGNORE INTO properties_new
        SELECT id, 1, address, city, state, zip, property_type, square_feet,
               lot_size, year_built, bedrooms, bathrooms, units, list_price,
               sale_price, noi, gross_rent, sale_date, notes, is_subject
        FROM properties
        WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='properties')
          AND NOT EXISTS (SELECT 1 FROM properties_new);
      DROP TABLE IF EXISTS properties;
      ALTER TABLE properties_new RENAME TO properties;
    `);
    const cols = sqlite.prepare("PRAGMA table_info(projects)").all() as any[];
    const names = cols.map((c: any) => c.name);
    if (!names.includes("settings_json")) sqlite.exec(`ALTER TABLE projects ADD COLUMN settings_json TEXT`);
    if (!names.includes("overrides_json")) sqlite.exec(`ALTER TABLE projects ADD COLUMN overrides_json TEXT`);
    if (!names.includes("workspace_id")) sqlite.exec(`ALTER TABLE projects ADD COLUMN workspace_id INTEGER`);
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, pin TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE, project_id INTEGER NOT NULL, project_name TEXT NOT NULL,
        created_at TEXT NOT NULL, subject_json TEXT NOT NULL, comps_json TEXT NOT NULL,
        valuation_json TEXT NOT NULL, settings_json TEXT NOT NULL, label TEXT
      );
    `);
    _db = drizzle(sqlite);
    console.log("[db] Using SQLite. Set DATABASE_URL to use Postgres.");
  }
  return _db;
}

// ─── Helper: run a drizzle query (handles both sync SQLite and async Postgres) ─

async function run<T>(q: any): Promise<T> {
  // SQLite drizzle: .get() / .all() / .run() are synchronous
  // Postgres drizzle: returns a Promise
  if (typeof q.get === "function") return q.get() as T;
  if (typeof q.all === "function") return q.all() as T;
  const result = await q;
  if (Array.isArray(result)) return result[0] as T;
  return result as T;
}

async function runAll<T>(q: any): Promise<T[]> {
  if (typeof q.all === "function") return q.all() as T[];
  const result = await q;
  return (Array.isArray(result) ? result : []) as T[];
}

async function runVoid(q: any): Promise<void> {
  if (typeof q.run === "function") { q.run(); return; }
  await q;
}

// ─── Storage interface ────────────────────────────────────────────────────────

export interface IStorage {
  getWorkspaceBySlug(slug: string): Promise<Workspace | undefined>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  getProjects(workspaceId?: number | null): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
  saveProjectState(id: number, settingsJson: string, overridesJson: string): Promise<void>;
  getProperties(projectId: number): Promise<Property[]>;
  getProperty(id: number): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, property: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<void>;
  getSubjectProperty(projectId: number): Promise<Property | undefined>;
  getComps(projectId: number): Promise<Property[]>;
  createSnapshot(data: InsertSnapshot): Promise<Snapshot>;
  getSnapshotByToken(token: string): Promise<Snapshot | undefined>;
  getSnapshotsByProject(projectId: number): Promise<Snapshot[]>;
  deleteSnapshot(token: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const db = await getDb();
    return run(db.select().from(workspaces).where(eq(workspaces.slug, slug.toLowerCase())));
  }
  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const db = await getDb();
    const hashedPin = bcrypt.hashSync(workspace.pin, 10);
    return run(db.insert(workspaces).values({ ...workspace, slug: workspace.slug.toLowerCase(), pin: hashedPin }).returning());
  }
  async getProjects(workspaceId?: number | null): Promise<Project[]> {
    const db = await getDb();
    const q = workspaceId != null
      ? db.select().from(projects).where(eq(projects.workspaceId as any, workspaceId))
      : db.select().from(projects);
    return runAll(q);
  }
  async getProject(id: number): Promise<Project | undefined> {
    const db = await getDb();
    return run(db.select().from(projects).where(eq(projects.id, id)));
  }
  async createProject(project: InsertProject): Promise<Project> {
    const db = await getDb();
    return run(db.insert(projects).values(project).returning());
  }
  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const db = await getDb();
    return run(db.update(projects).set(data).where(eq(projects.id, id)).returning());
  }
  async deleteProject(id: number): Promise<void> {
    const db = await getDb();
    await runVoid(db.delete(properties).where(eq(properties.projectId, id)));
    await runVoid(db.delete(snapshots).where(eq(snapshots.projectId, id)));
    await runVoid(db.delete(projects).where(eq(projects.id, id)));
  }
  async saveProjectState(id: number, settingsJson: string, overridesJson: string): Promise<void> {
    const db = await getDb();
    await runVoid(db.update(projects).set({ settingsJson, overridesJson } as any).where(eq(projects.id, id)));
  }
  async getProperties(projectId: number): Promise<Property[]> {
    const db = await getDb();
    return runAll(db.select().from(properties).where(eq(properties.projectId, projectId)));
  }
  async getProperty(id: number): Promise<Property | undefined> {
    const db = await getDb();
    return run(db.select().from(properties).where(eq(properties.id, id)));
  }
  async createProperty(property: InsertProperty): Promise<Property> {
    const db = await getDb();
    return run(db.insert(properties).values(property).returning());
  }
  async updateProperty(id: number, property: Partial<InsertProperty>): Promise<Property | undefined> {
    const db = await getDb();
    return run(db.update(properties).set(property).where(eq(properties.id, id)).returning());
  }
  async deleteProperty(id: number): Promise<void> {
    const db = await getDb();
    await runVoid(db.delete(properties).where(eq(properties.id, id)));
  }
  async getSubjectProperty(projectId: number): Promise<Property | undefined> {
    const db = await getDb();
    return run(db.select().from(properties).where(and(eq(properties.projectId, projectId), eq(properties.isSubject, true))));
  }
  async getComps(projectId: number): Promise<Property[]> {
    const db = await getDb();
    return runAll(db.select().from(properties).where(and(eq(properties.projectId, projectId), eq(properties.isSubject, false))));
  }
  async createSnapshot(data: InsertSnapshot): Promise<Snapshot> {
    const db = await getDb();
    return run(db.insert(snapshots).values(data).returning());
  }
  async getSnapshotByToken(token: string): Promise<Snapshot | undefined> {
    const db = await getDb();
    return run(db.select().from(snapshots).where(eq(snapshots.token, token)));
  }
  async getSnapshotsByProject(projectId: number): Promise<Snapshot[]> {
    const db = await getDb();
    return runAll(db.select().from(snapshots).where(eq(snapshots.projectId, projectId)));
  }
  async deleteSnapshot(token: string): Promise<void> {
    const db = await getDb();
    await runVoid(db.delete(snapshots).where(eq(snapshots.token, token)));
  }
}

export const storage = new DatabaseStorage();
