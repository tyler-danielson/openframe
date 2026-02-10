import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Loader2,
  FileText,
  X,
  Home,
} from "lucide-react";
import { api, type RemarkableFolder } from "../../services/api";
import { Button } from "../ui/Button";

interface FolderBrowserProps {
  onClose: () => void;
  onSelectFolder?: (path: string) => void;
  selectionMode?: boolean;
}

interface FolderTreeNode {
  name: string;
  path: string;
  children: FolderTreeNode[];
  documentCount?: number;
}

export function FolderBrowser({
  onClose,
  onSelectFolder,
  selectionMode = false,
}: FolderBrowserProps) {
  const queryClient = useQueryClient();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParentPath, setCreateParentPath] = useState("");

  // Fetch folder tree
  const { data: folderTree, isLoading } = useQuery({
    queryKey: ["remarkable", "folders", "tree"],
    queryFn: () => api.getRemarkableFolderTree(),
  });

  // Fetch suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ["remarkable", "folders", "suggestions"],
    queryFn: () => api.getRemarkableFolderSuggestions(),
  });

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleSelect = (path: string) => {
    setSelectedPath(path);
    if (selectionMode && onSelectFolder) {
      onSelectFolder(path);
    }
  };

  const handleCreateFolder = (parentPath: string) => {
    setCreateParentPath(parentPath);
    setShowCreateModal(true);
  };

  const renderTreeNode = (node: FolderTreeNode, level: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
            isSelected
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted"
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleSelect(node.path)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.path);
              }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm flex-1 truncate">{node.name || "Root"}</span>
          {node.documentCount !== undefined && node.documentCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {node.documentCount}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCreateFolder(node.path);
            }}
            className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Create subfolder"
          >
            <FolderPlus className="h-3 w-3" />
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Folder Browser</h2>
            <p className="text-sm text-muted-foreground">
              {selectionMode
                ? "Select a folder for your template"
                : "Browse and organize your reMarkable folders"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateFolder("")}
            >
              <FolderPlus className="h-4 w-4 mr-1" />
              New Folder
            </Button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : folderTree ? (
            <div className="space-y-1">
              {/* Root folder */}
              <div
                className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
                  selectedPath === ""
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
                onClick={() => handleSelect("")}
              >
                <Home className="h-4 w-4" />
                <span className="text-sm font-medium">My Files</span>
              </div>

              {/* Folder tree */}
              {folderTree.children?.map((node) =>
                renderTreeNode(node as FolderTreeNode, 1)
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
              <p className="text-muted-foreground">No folders found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a folder to get started
              </p>
            </div>
          )}

          {/* Suggested folders */}
          {suggestions.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">Suggested Folders</h3>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion: string) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSelect(suggestion)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      selectedPath === suggestion
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectionMode && (
          <div className="p-4 border-t shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate">
                {selectedPath || "/"}
              </div>
              <Button
                onClick={() => {
                  if (onSelectFolder) {
                    onSelectFolder(selectedPath);
                  }
                  onClose();
                }}
              >
                Select
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <CreateFolderModal
          parentPath={createParentPath}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newPath) => {
            setShowCreateModal(false);
            setSelectedPath(newPath);
            setExpandedPaths((prev) => new Set([...prev, createParentPath]));
            queryClient.invalidateQueries({ queryKey: ["remarkable", "folders"] });
          }}
        />
      )}
    </div>
  );
}

interface CreateFolderModalProps {
  parentPath: string;
  onClose: () => void;
  onCreated: (path: string) => void;
}

function CreateFolderModal({
  parentPath,
  onClose,
  onCreated,
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");

  const createFolder = useMutation({
    mutationFn: () => {
      const fullPath = parentPath
        ? `${parentPath}/${folderName}`
        : `/${folderName}`;
      return api.createRemarkableFolder(fullPath);
    },
    onSuccess: () => {
      const fullPath = parentPath
        ? `${parentPath}/${folderName}`
        : `/${folderName}`;
      onCreated(fullPath);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      createFolder.mutate();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-sm w-full mx-4 p-4">
        <h3 className="text-lg font-semibold mb-4">Create Folder</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Parent Folder
            </label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
              {parentPath || "/"}
            </div>
          </div>

          <div>
            <label htmlFor="folderName" className="block text-sm font-medium mb-1">
              Folder Name
            </label>
            <input
              id="folderName"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              placeholder="My Folder"
              autoFocus
              required
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Full path:{" "}
            <span className="font-mono">
              {parentPath ? `${parentPath}/${folderName || "..."}` : `/${folderName || "..."}`}
            </span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!folderName.trim() || createFolder.isPending}
            >
              {createFolder.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4 mr-2" />
              )}
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
