import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, Lock, UserPlus, LogIn, KeyRound } from "lucide-react";
import type { Workspace } from "@shared/schema";

interface WorkspaceGateProps {
  onWorkspaceReady: (workspace: Workspace) => void;
}

type Mode = "choose" | "login" | "create";

export function WorkspaceGate({ onWorkspaceReady }: WorkspaceGateProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!slug || !pin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", `/api/workspaces/${encodeURIComponent(slug)}/verify`, { pin });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Login failed" }));
        throw new Error(body.message);
      }
      const ws: Workspace = await res.json();
      onWorkspaceReady(ws);
    } catch (e: any) {
      setError(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!slug || !pin || !name) return;
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/workspaces", { name, slug, pin });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Failed to create workspace" }));
        throw new Error(body.message);
      }
      // Auto-login after creation
      const verifyRes = await apiRequest("POST", `/api/workspaces/${encodeURIComponent(slug)}/verify`, { pin });
      const ws: Workspace = await verifyRes.json();
      onWorkspaceReady(ws);
    } catch (e: any) {
      setError(e.message ?? "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ReComps</h1>
            <p className="text-xs text-muted-foreground">Real Estate Comparable Analysis</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {mode === "choose" && <><Lock className="w-4 h-4 text-muted-foreground" /> Select a workspace</>}
              {mode === "login" && <><LogIn className="w-4 h-4 text-muted-foreground" /> Sign in</>}
              {mode === "create" && <><UserPlus className="w-4 h-4 text-muted-foreground" /> Create workspace</>}
            </CardTitle>
            <CardDescription className="text-xs">
              {mode === "choose" && "Workspaces keep your projects separate from other users."}
              {mode === "login" && "Enter your workspace name and PIN."}
              {mode === "create" && "Pick a unique workspace name and set a 4-digit PIN."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "choose" && (
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => { setMode("login"); setError(null); }}
                  data-testid="button-go-login"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in to existing workspace
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { setMode("create"); setError(null); }}
                  data-testid="button-go-create"
                >
                  <UserPlus className="w-4 h-4" />
                  Create new workspace
                </Button>
              </div>
            )}

            {mode === "login" && (
              <>
                <div>
                  <Label htmlFor="ws-slug" className="text-xs">Workspace name</Label>
                  <Input
                    id="ws-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="e.g. acme-realty"
                    autoFocus
                    data-testid="input-ws-slug"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Lowercase letters, numbers, and hyphens only</p>
                </div>
                <div>
                  <Label htmlFor="ws-pin" className="text-xs flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> PIN
                  </Label>
                  <Input
                    id="ws-pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    maxLength={8}
                    data-testid="input-ws-pin"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  className="w-full"
                  onClick={handleLogin}
                  disabled={!slug || !pin || loading}
                  data-testid="button-login"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                  Sign in
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setMode("choose"); setError(null); }}>
                  Back
                </Button>
              </>
            )}

            {mode === "create" && (
              <>
                <div>
                  <Label htmlFor="ws-name-new" className="text-xs">Display name</Label>
                  <Input
                    id="ws-name-new"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Realty"
                    autoFocus
                    data-testid="input-ws-name"
                  />
                </div>
                <div>
                  <Label htmlFor="ws-slug-new" className="text-xs">Workspace ID <Badge variant="secondary" className="text-[10px] ml-1">unique</Badge></Label>
                  <Input
                    id="ws-slug-new"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="e.g. acme-realty"
                    data-testid="input-ws-slug-new"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Lowercase letters, numbers, hyphens only</p>
                </div>
                <div>
                  <Label htmlFor="ws-pin-new" className="text-xs flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> PIN (4+ digits)
                  </Label>
                  <Input
                    id="ws-pin-new"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    maxLength={8}
                    data-testid="input-ws-pin-new"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!slug || !pin || !name || loading}
                  data-testid="button-create-workspace"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Create workspace
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setMode("choose"); setError(null); }}>
                  Back
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground">
          Workspaces are isolated — each has its own projects and comps.
        </p>
      </div>
    </div>
  );
}
