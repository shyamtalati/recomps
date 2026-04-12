import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Plus, Pencil, Trash2, FolderOpen, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProjectSwitcherProps {
  activeProjectId: number | null;
  onProjectChange: (projectId: number) => void;
  workspaceId?: number;
}

export function ProjectSwitcher({ activeProjectId, onProjectChange, workspaceId }: ProjectSwitcherProps) {
  const { toast } = useToast();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const projectQueryKey = workspaceId ? ["/api/projects", workspaceId] : ["/api/projects"];

  const { data: projectList = [] } = useQuery<Project[]>({
    queryKey: projectQueryKey,
    queryFn: workspaceId
      ? () => apiRequest("GET", `/api/projects?workspaceId=${workspaceId}`).then(r => r.json()) as Promise<Project[]>
      : undefined,
  });

  const activeProject = projectList.find((p) => p.id === activeProjectId);

  const createMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const res = await apiRequest("POST", "/api/projects", { name, description, workspaceId });
      return res.json() as Promise<Project>;
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: projectQueryKey });
      onProjectChange(project.id);
      setShowNewDialog(false);
      setNewName("");
      setNewDescription("");
      toast({ title: "Project created", description: project.name });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: number; name: string; description: string }) => {
      return apiRequest("PATCH", `/api/projects/${id}`, { name, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKey });
      setShowRenameDialog(false);
      setPendingProject(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKey });
      // Switch to first remaining project, or null
      const remaining = projectList.filter((p) => p.id !== pendingProject?.id);
      if (remaining.length > 0) {
        onProjectChange(remaining[0].id);
      } else {
        onProjectChange(-1); // no projects left
      }
      setShowDeleteAlert(false);
      setPendingProject(null);
      toast({ title: "Project deleted" });
    },
  });

  const openRename = (project: Project) => {
    setPendingProject(project);
    setNewName(project.name);
    setNewDescription(project.description ?? "");
    setShowRenameDialog(true);
  };

  const openDelete = (project: Project) => {
    setPendingProject(project);
    setShowDeleteAlert(true);
  };

  const openNew = () => {
    setNewName("");
    setNewDescription("");
    setShowNewDialog(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 max-w-[200px] text-xs font-medium"
            data-testid="button-project-switcher"
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{activeProject?.name ?? "Select project…"}</span>
            <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Projects
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {projectList.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              No projects yet
            </div>
          )}

          {projectList.map((project) => (
            <DropdownMenuItem
              key={project.id}
              className="flex items-center justify-between gap-2 cursor-pointer group"
              onSelect={() => onProjectChange(project.id)}
              data-testid={`menu-item-project-${project.id}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {project.id === activeProjectId ? (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate text-xs">{project.name}</span>
              </div>
              <div
                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="p-1 rounded hover:bg-muted"
                  onClick={(e) => { e.stopPropagation(); openRename(project); }}
                  data-testid={`button-rename-project-${project.id}`}
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  className="p-1 rounded hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); openDelete(project); }}
                  data-testid={`button-delete-project-${project.id}`}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-xs cursor-pointer text-primary"
            onSelect={openNew}
            data-testid="button-new-project"
          >
            <Plus className="w-3.5 h-3.5" />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* New project dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="proj-name" className="text-xs">Name</Label>
              <Input
                id="proj-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. 123 Main St — Q2 2026"
                className="mt-1 text-sm"
                data-testid="input-project-name"
                onKeyDown={(e) => e.key === "Enter" && newName.trim() && createMutation.mutate({ name: newName.trim(), description: newDescription.trim() })}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="proj-desc" className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="proj-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g. Commercial office, Philadelphia"
                className="mt-1 text-sm"
                data-testid="input-project-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription.trim() })}
              disabled={!newName.trim() || createMutation.isPending}
              data-testid="button-create-project-confirm"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Rename Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="rename-name" className="text-xs">Name</Label>
              <Input
                id="rename-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 text-sm"
                data-testid="input-rename-project"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="rename-desc" className="text-xs">Description</Label>
              <Input
                id="rename-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => pendingProject && renameMutation.mutate({ id: pendingProject.id, name: newName.trim(), description: newDescription.trim() })}
              disabled={!newName.trim() || renameMutation.isPending}
              data-testid="button-rename-project-confirm"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete "{pendingProject?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently delete the project and all of its properties and comps. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingProject && deleteMutation.mutate(pendingProject.id)}
              data-testid="button-delete-project-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
