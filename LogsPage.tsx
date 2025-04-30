// src/pages/LogsPage.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error display
import { AlertCircle, CheckCircle, Terminal } from "lucide-react";

// Helper function to get token (replace with context/store later)
const getAuthToken = () => localStorage.getItem("access_token");

// Define types for log data
interface LogEntry {
  id: number;
  domain_id: number;
  authorized_domain_name: string; // Added by backend query
  cloned_from_domain: string;
  user_agent: string | null;
  ip_address: string;
  referer: string | null;
  action_taken: string;
  timestamp: string;
}

interface LogsApiResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

// --- Actual API Call Functions ---

const fetchLogs = async (page = 1, perPage = 10): Promise<LogsApiResponse> => {
  console.log(`Fetching logs from API for page ${page}, per page ${perPage}...`);
  const token = getAuthToken();
  if (!token) throw new Error("Authentication token not found.");

  const response = await fetch(`/api/logs?page=${page}&per_page=${perPage}&sort=desc`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to fetch logs: ${response.statusText}`);
  }
  return await response.json();
};

// Re-use addDomainApi logic (could be moved to a shared API service file)
const addDomainFromLog = async (domainName: string): Promise<any> => {
    console.log("Attempting to add domain from log via API:", domainName);
    const token = getAuthToken();
    if (!token) throw new Error("Authentication token not found.");

    const response = await fetch("/api/domains", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        // Add default settings when adding from log
        body: JSON.stringify({ domain_name: domainName, action_if_cloned: "none", is_active: true }),
      });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        // Handle conflict (domain already exists) gracefully?
        if (response.status === 409) {
             throw new Error(errorData.message || `Domain already exists: ${domainName}`);
        }
        throw new Error(errorData.message || `Failed to add domain: ${response.statusText}`);
    }
    return await response.json();
};

// --- Component ---

const LogsPage = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, per_page: 10 });
  const [addingDomain, setAddingDomain] = useState<string | null>(null); // Track which domain is being added by name
  const [addDomainError, setAddDomainError] = useState<string | null>(null);
  const [addDomainSuccess, setAddDomainSuccess] = useState<string | null>(null);

  const loadLogs = async (page = 1) => {
    setLoading(true);
    setError(null);
    setAddDomainError(null); // Clear add domain errors on navigation
    setAddDomainSuccess(null);
    try {
      const data = await fetchLogs(page, pagination.per_page);
      setLogs(data.logs);
      setPagination({ page: data.page, pages: data.pages, total: data.total, per_page: data.per_page });
    } catch (err: any) {
      setError(err.message || "Failed to load logs. Please try again.");
      setLogs([]); // Clear logs on error
      setPagination({ page: 1, pages: 1, total: 0, per_page: 10 }); // Reset pagination
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1); // Load first page on mount
  }, []); // Empty dependency array means run once on mount

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages && newPage !== pagination.page) {
      loadLogs(newPage);
    }
  };

  const handleMarkAsAllowed = async (clonedDomain: string) => {
      if (!clonedDomain) return;
      setAddingDomain(clonedDomain); // Indicate loading state for this specific button
      setAddDomainError(null);
      setAddDomainSuccess(null);
      try {
          await addDomainFromLog(clonedDomain);
          setAddDomainSuccess(`Domain "${clonedDomain}" was successfully marked as allowed.`);
          // Optionally: Refresh logs or disable button permanently?
          // For now, just show success message.
      } catch (err: any) {
          setAddDomainError(`Failed to mark domain "${clonedDomain}" as allowed: ${err.message}`);
      } finally {
          setAddingDomain(null);
      }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Access Logs</h1>
      <p className="text-muted-foreground">History of unauthorized access attempts detected on your domains.</p>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Logs</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {addDomainError && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Adding Domain</AlertTitle>
          <AlertDescription>{addDomainError}</AlertDescription>
        </Alert>
      )}
      {addDomainSuccess && (
        <Alert variant="success"> {/* Assuming you have a success variant */} 
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{addDomainSuccess}</AlertDescription>
        </Alert>
      )}

      {loading && <p>Loading logs...</p>}

      {!loading && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Detected Clone Domain</TableHead>
                  <TableHead>Authorized Domain</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Action Taken</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />
                        {log.cloned_from_domain}
                      </TableCell>
                      <TableCell>{log.authorized_domain_name}</TableCell>
                      <TableCell>{log.ip_address}</TableCell>
                      <TableCell>{log.action_taken}</TableCell>
                      <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsAllowed(log.cloned_from_domain)}
                          disabled={addingDomain === log.cloned_from_domain}
                          title={`Mark ${log.cloned_from_domain} as an allowed domain`}
                        >
                          {addingDomain === log.cloned_from_domain ? "Adding..." : <><CheckCircle className="h-4 w-4 mr-1" /> Mark Allowed</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No logs found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); handlePageChange(pagination.page - 1); }}
                    aria-disabled={pagination.page <= 1}
                    className={pagination.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                {
                  // Basic pagination display logic (show current, +/- 1, and first/last)
                  // This can be improved for many pages
                  Array.from({ length: pagination.pages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pagination.pages || Math.abs(p - pagination.page) <= 1)
                    .map((p, index, arr) => (
                      <React.Fragment key={p}>
                        {index > 0 && p > arr[index - 1] + 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => { e.preventDefault(); handlePageChange(p); }}
                            isActive={pagination.page === p}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    ))
                }
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); handlePageChange(pagination.page + 1); }}
                    aria-disabled={pagination.page >= pagination.pages}
                     className={pagination.page >= pagination.pages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};

export default LogsPage;

