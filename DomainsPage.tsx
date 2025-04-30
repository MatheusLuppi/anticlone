// src/pages/DomainsPage.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error display
import { PlusCircle, Edit, Trash2, Terminal } from "lucide-react";

// Helper function to get token (replace with context/store later)
const getAuthToken = () => localStorage.getItem("access_token");

// Define types for domain data
interface Domain {
  id: number;
  domain_name: string;
  action_if_cloned: "none" | "hide" | "redirect" | "replace_links";
  action_target: string | null;
  is_active: boolean;
  created_at: string;
}

// --- Actual API Call Functions ---

const fetchDomains = async (): Promise<Domain[]> => {
  console.log("Fetching domains from API...");
  const token = getAuthToken();
  if (!token) throw new Error("Authentication token not found.");

  const response = await fetch("/api/domains", {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to fetch domains: ${response.statusText}`);
  }
  return await response.json();
};

const addDomainApi = async (domainData: Omit<Domain, "id" | "created_at">): Promise<Domain> => {
  console.log("Adding domain via API:", domainData);
  const token = getAuthToken();
  if (!token) throw new Error("Authentication token not found.");

  const response = await fetch("/api/domains", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(domainData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to add domain: ${response.statusText}`);
  }
  return await response.json();
};

const updateDomainApi = async (domainId: number, domainData: Partial<Omit<Domain, "id" | "created_at">>): Promise<Domain> => {
  console.log("Updating domain via API:", domainId, domainData);
  const token = getAuthToken();
  if (!token) throw new Error("Authentication token not found.");

  const response = await fetch(`/api/domains/${domainId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(domainData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to update domain: ${response.statusText}`);
  }
  return await response.json();
};

const deleteDomainApi = async (domainId: number): Promise<{ message: string }> => {
  console.log("Deleting domain via API:", domainId);
  const token = getAuthToken();
  if (!token) throw new Error("Authentication token not found.");

  const response = await fetch(`/api/domains/${domainId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to delete domain: ${response.statusText}`);
  }
  // DELETE might return 204 No Content or a confirmation message
  if (response.status === 204) {
      return { message: "Domain deleted successfully" };
  }
  return await response.json();
};

// --- Component ---

const DomainsPage = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentDomain, setCurrentDomain] = useState<Domain | null>(null); // For editing
  const [formData, setFormData] = useState({ domain_name: "", action_if_cloned: "none" as Domain["action_if_cloned"], action_target: "", is_active: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Fetch domains on component mount
  useEffect(() => {
    const loadDomains = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDomains();
        setDomains(data);
      } catch (err: any) {
        setError(err.message || "Failed to load domains. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadDomains();
  }, []);

  // Form input handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: Domain["action_if_cloned"]) => {
    setFormData(prev => ({ ...prev, action_if_cloned: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, is_active: checked }));
  };

  // Dialog handlers
  const openAddDialog = () => {
    setCurrentDomain(null);
    setFormData({ domain_name: "", action_if_cloned: "none", action_target: "", is_active: true });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (domain: Domain) => {
    setCurrentDomain(domain);
    setFormData({
      domain_name: domain.domain_name,
      action_if_cloned: domain.action_if_cloned,
      action_target: domain.action_target || "",
      is_active: domain.is_active
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  // CRUD operation handlers
  const handleDelete = async (domainId: number) => {
    if (!window.confirm("Are you sure you want to delete this domain?")) return;
    // Indicate loading specifically for this row? Or global loading?
    // For simplicity, let's just disable buttons during the operation
    // Consider adding a specific loading state per row if needed.
    try {
      await deleteDomainApi(domainId);
      setDomains(prev => prev.filter(d => d.id !== domainId));
      setError(null); // Clear previous errors on success
    } catch (err: any) {
      setError(err.message || "Failed to delete domain.");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    const dataToSend = {
        domain_name: formData.domain_name.trim(), // Trim whitespace
        action_if_cloned: formData.action_if_cloned,
        is_active: formData.is_active,
        // Clear action_target if action doesn't require it
        action_target: ["redirect", "replace_links"].includes(formData.action_if_cloned) ? formData.action_target.trim() : null
    };

    // Basic validation
    if (!dataToSend.domain_name) {
        setFormError("Domain name is required.");
        setFormLoading(false);
        return;
    }
    // Validate URL format if action_target is provided
    if (dataToSend.action_target) {
        try {
            new URL(dataToSend.action_target);
        } catch (_) {
            setFormError("Target URL must be a valid URL (e.g., https://example.com).");
            setFormLoading(false);
            return;
        }
    }
     if (["redirect", "replace_links"].includes(dataToSend.action_if_cloned) && !dataToSend.action_target) {
        setFormError("Target URL is required for this action.");
        setFormLoading(false);
        return;
    }

    try {
      if (currentDomain) {
        // Update existing domain
        // Only send changed fields? For simplicity, send all relevant fields.
        const updatePayload = {
            action_if_cloned: dataToSend.action_if_cloned,
            action_target: dataToSend.action_target,
            is_active: dataToSend.is_active
            // Domain name editing is disabled for now
        };
        const updatedDomain = await updateDomainApi(currentDomain.id, updatePayload);
        // Update the state with the full response from the API
        setDomains(prev => prev.map(d => d.id === currentDomain.id ? updatedDomain : d));
      } else {
        // Add new domain
        const newDomain = await addDomainApi(dataToSend);
        setDomains(prev => [...prev, newDomain]);
      }
      setIsDialogOpen(false);
      setError(null); // Clear previous errors on success
    } catch (err: any) {
      setFormError(err.message || "Failed to save domain.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Domains</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{currentDomain ? "Edit Domain" : "Add New Domain"}</DialogTitle>
              <DialogDescription>
                {currentDomain ? "Update the protection settings for your domain." : "Add a new domain to protect."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="domain_name" className="text-right">Domain Name</Label>
                <Input
                  id="domain_name"
                  name="domain_name"
                  value={formData.domain_name}
                  onChange={handleInputChange}
                  className="col-span-3"
                  placeholder="example.com" // Normalize hint
                  disabled={formLoading || !!currentDomain} // Disable editing domain name when updating
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="action_if_cloned" className="text-right">Action</Label>
                <Select
                    value={formData.action_if_cloned}
                    onValueChange={handleSelectChange}
                    disabled={formLoading}
                >
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None (Log only)</SelectItem>
                        <SelectItem value="hide">Hide Content</SelectItem>
                        <SelectItem value="redirect">Redirect</SelectItem>
                        <SelectItem value="replace_links">Replace Links</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              {(formData.action_if_cloned === "redirect" || formData.action_if_cloned === "replace_links") && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="action_target" className="text-right">Target URL</Label>
                  <Input
                    id="action_target"
                    name="action_target"
                    value={formData.action_target}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="https://your-official-site.com"
                    type="url" // Use URL type for basic browser validation
                    disabled={formLoading}
                    required
                  />
                </div>
              )}
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="is_active" className="text-right">Active</Label>
                 <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={handleSwitchChange}
                    disabled={formLoading}
                    className="col-span-3 justify-self-start"
                 />
               </div>
               {formError && (
                 <Alert variant="destructive" className="col-span-4">
                   <Terminal className="h-4 w-4" />
                   <AlertTitle>Error</AlertTitle>
                   <AlertDescription>{formError}</AlertDescription>
                 </Alert>
               )}
            <DialogFooter>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? (currentDomain ? "Saving..." : "Adding...") : (currentDomain ? "Save Changes" : "Add Domain")}
              </Button>
            </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error Loading Domains</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}

      {loading && <p>Loading domains...</p>}

      {!loading && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain Name</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.length > 0 ? (
                domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">{domain.domain_name}</TableCell>
                    <TableCell>{domain.action_if_cloned}</TableCell>
                    <TableCell>{domain.action_target || "-"}</TableCell>
                    <TableCell>{domain.is_active ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => openEditDialog(domain)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(domain.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No domains added yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default DomainsPage;

