import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Check, AlertTriangle, Server, FolderOpen } from "lucide-react";
import { api, type StorageServerInfo } from "../../services/api";
import { Button } from "../ui/Button";

interface StorageServerConfigProps {
  protocol: "ftp" | "sftp" | "smb" | "webdav";
  serverId?: string | null;
  onClose: () => void;
}

const PROTOCOL_LABELS: Record<string, string> = {
  ftp: "FTP",
  sftp: "SFTP",
  smb: "SMB / NAS",
  webdav: "WebDAV",
};

const DEFAULT_PORTS: Record<string, number> = {
  ftp: 21,
  sftp: 22,
  smb: 445,
  webdav: 443,
};

export function StorageServerConfig({ protocol, serverId, onClose }: StorageServerConfigProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState(protocol);
  const [host, setHost] = useState("");
  const [port, setPort] = useState<string>("");
  const [basePath, setBasePath] = useState("/");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shareName, setShareName] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Load existing server data if editing
  const { data: servers = [] } = useQuery({
    queryKey: ["storage-servers"],
    queryFn: () => api.getStorageServers(),
  });

  const existingServer = serverId ? servers.find((s) => s.id === serverId) : null;

  useEffect(() => {
    if (existingServer) {
      setName(existingServer.name);
      setSelectedProtocol(existingServer.protocol);
      setHost(existingServer.host);
      setPort(existingServer.port?.toString() ?? "");
      setBasePath(existingServer.basePath || "/");
      setUsername(existingServer.username || "");
      setShareName(existingServer.shareName || "");
    }
  }, [existingServer]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        protocol: selectedProtocol,
        host,
        port: port ? parseInt(port, 10) : null,
        basePath: basePath || "/",
        username: username || null,
        password: password || null,
        shareName: selectedProtocol === "smb" ? shareName || null : null,
      };

      if (serverId) {
        return api.updateStorageServer(serverId, data);
      }
      return api.addStorageServer(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-servers"] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteStorageServer(serverId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-servers"] });
      onClose();
    },
  });

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      // If no server saved yet, save first then test
      if (!serverId) {
        const created = await api.addStorageServer({
          name: name || `${PROTOCOL_LABELS[selectedProtocol]} Server`,
          protocol: selectedProtocol,
          host,
          port: port ? parseInt(port, 10) : null,
          basePath: basePath || "/",
          username: username || null,
          password: password || null,
          shareName: selectedProtocol === "smb" ? shareName || null : null,
        });
        queryClient.invalidateQueries({ queryKey: ["storage-servers"] });
        const result = await api.testStorageConnection(created.id);
        setTestResult(result);
      } else {
        // Update first, then test
        await api.updateStorageServer(serverId, {
          name,
          protocol: selectedProtocol,
          host,
          port: port ? parseInt(port, 10) : null,
          basePath: basePath || "/",
          username: username || null,
          password: password || undefined,
          shareName: selectedProtocol === "smb" ? shareName || null : null,
        });
        const result = await api.testStorageConnection(serverId);
        setTestResult(result);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  // Filter servers that match this protocol category for the listing
  const protocolServers = servers.filter((s) => {
    if (protocol === "ftp") return s.protocol === "ftp" || s.protocol === "sftp";
    return s.protocol === protocol;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-primary/20 bg-background p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                {serverId ? "Edit" : "Add"} {PROTOCOL_LABELS[protocol]} Server
              </h2>
              <p className="text-sm text-muted-foreground">
                Connect to a remote storage server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-primary/10 text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Existing servers list */}
        {protocolServers.length > 0 && !serverId && (
          <div className="mb-4 rounded-lg border border-primary/20 p-3">
            <p className="mb-2 text-xs font-medium text-primary/80 uppercase tracking-wide">
              Connected Servers
            </p>
            {protocolServers.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary/60" />
                  <span className="text-sm">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.host}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await api.deleteStorageServer(s.id);
                    queryClient.invalidateQueries({ queryKey: ["storage-servers"] });
                  }}
                  className="text-xs text-destructive hover:text-destructive/80"
                >
                  Remove
                </button>
              </div>
            ))}
            <hr className="my-3 border-primary/10" />
            <p className="text-xs text-muted-foreground">Add another server:</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-primary/80">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My NAS"
              className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {protocol === "ftp" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-primary/80">Protocol</label>
              <select
                value={selectedProtocol}
                onChange={(e) => setSelectedProtocol(e.target.value as "ftp" | "sftp")}
                className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="ftp">FTP</option>
                <option value="sftp">SFTP (SSH)</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-primary/80">Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100 or nas.local"
                className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-primary/80">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder={String(DEFAULT_PORTS[selectedProtocol] ?? "")}
                className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {selectedProtocol === "smb" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-primary/80">Share Name</label>
              <input
                type="text"
                value={shareName}
                onChange={(e) => setShareName(e.target.value)}
                placeholder="Photos"
                className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-primary/80">Base Path</label>
            <input
              type="text"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder="/"
              className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-primary/80">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="optional"
                className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-primary/80">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={serverId ? "unchanged" : "optional"}
                className="w-full rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                testResult.success
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.success ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {testResult.message}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {serverId && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Delete this storage server?")) {
                    deleteMutation.mutate();
                  }
                }}
                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!host || testing}
              className="border-primary/30"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name || !host || saveMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {serverId ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
