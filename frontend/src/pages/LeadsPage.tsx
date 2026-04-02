import { ChangeEvent, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leadsApi } from "@/api";
import { notifyApp } from "@/lib/notifications";
import { formatDate } from "@/lib/utils";
import { Plus, Upload, Tag, Pencil, Trash2 } from "lucide-react";

const leadSchema = z.object({
  phoneNumber: z.string().min(5),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  tags: z.string().optional(),
});

const SAMPLE_CSV = [
  "phoneNumber,name,email,tags,countryCode,source,funnelStage",
  "+15551234567,John Doe,john@example.com,customer|vip,US,csv,lead",
  "+15557654321,Jane Smith,jane@example.com,repeat|warm,US,csv,prospect",
].join("\n");

type LeadForm = z.infer<typeof leadSchema>;

interface Lead {
  id: string;
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
  tags?: unknown;
  funnelStage?: string | null;
  createdAt: string;
}

interface LeadEditSnapshot {
  id: string;
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
  tags?: string[];
}

function safeText(value?: string | null): string {
  return value && value.trim().length > 0 ? value.trim() : "(empty)";
}

function normalizeTags(tags?: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
}

function normalizeTagCsv(tags?: string): string[] {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, "").trim());
}

function normalizeHeader(header: string): string {
  const key = header.replace(/[\s_-]+/g, "").toLowerCase();
  const aliases: Record<string, string> = {
    phonenumber: "phoneNumber",
    phone: "phoneNumber",
    mobile: "phoneNumber",
    mobilenumber: "phoneNumber",
    whatsapp: "phoneNumber",
    whatsappnumber: "phoneNumber",
    fullname: "name",
    name: "name",
    email: "email",
    emailaddress: "email",
    tags: "tags",
    tag: "tags",
    country: "countryCode",
    countrycode: "countryCode",
    source: "source",
    stage: "funnelStage",
    funnelstage: "funnelStage",
  };

  return aliases[key] ?? key;
}

function parseCsvText(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("The CSV file is empty.");
  }

  const firstRow = parseCsvLine(lines[0]);
  const normalizedHeaders = firstRow.map(normalizeHeader);
  const hasHeader = normalizedHeaders.some((header) =>
    ["phoneNumber", "name", "email", "tags", "countryCode", "source", "funnelStage"].includes(header)
  );

  const headers = hasHeader ? normalizedHeaders : ["phoneNumber", "name", "email", "tags"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  if (dataLines.length === 0) {
    throw new Error("No contacts found in the CSV file.");
  }

  const seenPhoneNumbers = new Set<string>();

  return dataLines
    .map((line) => {
      const columns = parseCsvLine(line);
      const lead: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        const rawValue = columns[index]?.trim();
        if (!header || !rawValue) {
          return;
        }

        if (header === "phoneNumber") {
          const cleanedPhone = rawValue.replace(/(?!^\+)\D/g, "");
          if (cleanedPhone.length >= 5) {
            lead.phoneNumber = cleanedPhone;
          }
          return;
        }

        if (header === "email") {
          if (z.string().email().safeParse(rawValue).success) {
            lead.email = rawValue;
          }
          return;
        }

        if (header === "tags") {
          lead.tags = rawValue
            .split(/[|;,]/)
            .map((tag) => tag.trim())
            .filter(Boolean);
          return;
        }

        if (["name", "countryCode", "source", "funnelStage"].includes(header)) {
          lead[header] = rawValue;
        }
      });

      const phoneNumber = typeof lead.phoneNumber === "string" ? lead.phoneNumber : "";
      if (!phoneNumber || seenPhoneNumbers.has(phoneNumber)) {
        return null;
      }

      seenPhoneNumbers.add(phoneNumber);
      return lead;
    })
    .filter((lead): lead is Record<string, unknown> => Boolean(lead));
}

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "billy777-contacts-sample.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function LeadsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<LeadEditSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["leads", search],
    queryFn: () => leadsApi.list(search || undefined),
  });

  const saveMutation = useMutation({
    mutationFn: (values: LeadForm) => {
      const tags = values.tags ? values.tags.split(",").map((t) => t.trim()) : [];
      const payload = { ...values, tags, email: values.email || undefined };
      return editingLeadId ? leadsApi.update(editingLeadId, payload) : leadsApi.create(payload);
    },
    onSuccess: (
      result: { id?: string; name?: string | null; phoneNumber?: string | null; email?: string | null; tags?: unknown },
      values: LeadForm
    ) => {
      const label = values.name?.trim() || values.phoneNumber || result.name?.trim() || result.phoneNumber || "lead";
      let description = `Added ${label}.`;

      if (editingLeadId && editingSnapshot) {
        const changes: string[] = [];
        const previousLeadName = safeText(editingSnapshot.name);
        const nextName = values.name?.trim() || "";
        const nextPhone = values.phoneNumber?.trim() || "";
        const nextEmail = values.email?.trim() || "";
        const nextTags = normalizeTagCsv(values.tags).join(", ");
        const previousPhone = safeText(editingSnapshot.phoneNumber);
        const currentLeadName = safeText(nextName);
        const currentPhone = safeText(nextPhone);
        const identitySummary = `Lead: ${previousLeadName} -> ${currentLeadName}\nPhone: ${previousPhone} -> ${currentPhone}`;

        if (safeText(editingSnapshot.name) !== safeText(nextName)) {
          changes.push(`Name: ${safeText(editingSnapshot.name)} -> ${safeText(nextName)}`);
        }
        if (safeText(editingSnapshot.phoneNumber) !== safeText(nextPhone)) {
          changes.push(`Phone: ${safeText(editingSnapshot.phoneNumber)} -> ${safeText(nextPhone)}`);
        }
        if (safeText(editingSnapshot.email) !== safeText(nextEmail)) {
          changes.push(`Email: ${safeText(editingSnapshot.email)} -> ${safeText(nextEmail)}`);
        }

        const oldTags = normalizeTags(editingSnapshot.tags).join(", ");
        if (safeText(oldTags) !== safeText(nextTags)) {
          changes.push(`Tags: ${safeText(oldTags)} -> ${safeText(nextTags)}`);
        }

        description = changes.length > 0
          ? `Updated ${label}. [Leads > Edit]\n${identitySummary}\n${changes.join("\n")}`
          : `Updated ${label}. [Leads > Edit]\n${identitySummary}\nSaved without field changes.`;
      } else {
        description = `Added ${label}. [Leads > Add]\nLead: ${safeText(values.name)}\nPhone: ${safeText(values.phoneNumber)}\nEmail: ${safeText(values.email)}\nTags: ${safeText(values.tags)}`;
      }

      notifyApp({
        title: editingLeadId ? "Lead Updated" : "Lead Added",
        description,
        kind: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      reset();
      setShowAdd(false);
      setEditingLeadId(null);
      setEditingSnapshot(null);
    },
    onError: (error: unknown, values) => {
      const label = values.name?.trim() || values.phoneNumber || "lead";
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Lead save failed.");
      notifyApp({
        title: editingLeadId ? "Lead Update Failed" : "Lead Add Failed",
        description: `[Leads > ${editingLeadId ? "Edit" : "Add"}]\nLead: ${label}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; label: string }) => leadsApi.remove(id),
    onSuccess: (_result, variables) => {
      notifyApp({
        title: "Lead Deleted",
        description: `[Leads > Delete]\nLead: ${variables.label}`,
        kind: "warning",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: unknown, variables) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Lead delete failed.");
      notifyApp({
        title: "Lead Delete Failed",
        description: `[Leads > Delete]\nLead: ${variables.label}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => leadsApi.removeAll() as Promise<{ count?: number }>,
    onSuccess: (result) => {
      notifyApp({
        title: "All Leads Deleted",
        description: `[Leads > Delete All]\nDeleted Leads: ${Number(result?.count ?? leads.length)}`,
        kind: "warning",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setShowAdd(false);
      setEditingLeadId(null);
      setEditingSnapshot(null);
      reset();
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Delete all leads failed.");
      notifyApp({
        title: "Delete All Leads Failed",
        description: `[Leads > Delete All]\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const parsedLeads = parseCsvText(text);

      if (parsedLeads.length === 0) {
        throw new Error("No valid phone numbers were found in the CSV file.");
      }

      let importedCount = 0;

      for (let index = 0; index < parsedLeads.length; index += 500) {
        const chunk = parsedLeads.slice(index, index + 500);
        const response = await leadsApi.bulkCreate(chunk);
        importedCount += Number(response?.count ?? chunk.length);
      }

      return { importedCount, totalRows: parsedLeads.length };
    },
    onSuccess: ({ importedCount, totalRows }) => {
      notifyApp({
        title: "CSV Import Complete",
        description: `[Leads > CSV Import]\nImported: ${importedCount}\nRows Processed: ${totalRows}`,
        kind: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setCsvMessage(`Imported ${importedCount} contacts from ${totalRows} CSV rows.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: unknown) => {
      notifyApp({
        title: "CSV Import Failed",
        description: `[Leads > CSV Import]\nError: ${error instanceof Error ? error.message : "CSV import failed."}`,
        kind: "error",
      });
      setCsvMessage(error instanceof Error ? error.message : "CSV import failed.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
  });

  const beginEditLead = (lead: Lead) => {
    const tags = Array.isArray(lead.tags) ? lead.tags.join(", ") : "";
    reset({
      phoneNumber: lead.phoneNumber,
      name: lead.name ?? "",
      email: lead.email ?? "",
      tags,
    });
    setEditingLeadId(lead.id);
    setEditingSnapshot({
      id: lead.id,
      phoneNumber: lead.phoneNumber,
      name: lead.name,
      email: lead.email,
      tags: normalizeTags(lead.tags),
    });
  };

  const closeEditLead = () => {
    setEditingLeadId(null);
    setEditingSnapshot(null);
    reset();
  };

  const handleCsvUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setCsvMessage(`Importing ${file.name}...`);
    bulkImportMutation.mutate(file);
  };

  return (
    <AppLayout title="Leads">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone number..."
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              CSV import supports `phoneNumber`, `name`, `email`, `tags`, `countryCode`, `source`, and `funnelStage`.
              Large files are uploaded in 500-contact batches, so 1,000+ contacts work smoothly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkImportMutation.isPending}
            >
              <Upload className="w-4 h-4 mr-2" />
              {bulkImportMutation.isPending ? "Importing CSV..." : "Bulk Import CSV"}
            </Button>
            <Button type="button" variant="outline" onClick={downloadSampleCsv}>
              Download Sample CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              disabled={deleteAllMutation.isPending || leads.length === 0}
              onClick={() => {
                const ok = window.confirm(`Delete ALL ${leads.length} leads? This cannot be undone.`);
                if (!ok) return;
                deleteAllMutation.mutate();
              }}
            >
              {deleteAllMutation.isPending ? "Deleting All..." : "Delete All Leads"}
            </Button>
            <Button
              onClick={() => {
                if (showAdd) {
                  setShowAdd(false);
                  setEditingLeadId(null);
                  setEditingSnapshot(null);
                  reset();
                  return;
                }
                setShowAdd(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />Add Lead
            </Button>
          </div>
        </div>

        {csvMessage && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {csvMessage}
          </div>
        )}

        {showAdd && !editingLeadId && (
          <Card>
            <CardHeader><CardTitle>Add Lead</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Phone Number *</Label>
                  <Input {...register("phoneNumber")} placeholder="+1234567890" />
                  {errors.phoneNumber && <p className="text-xs text-red-500">{errors.phoneNumber.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input {...register("name")} placeholder="Jane Doe" />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input {...register("email")} type="email" placeholder="jane@example.com" />
                </div>
                <div className="space-y-1">
                  <Label>Tags (comma separated)</Label>
                  <Input {...register("tags")} placeholder="vip, customer, hot-lead" />
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAdd(false);
                      setEditingLeadId(null);
                      reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : editingLeadId ? "Update Lead" : "Add Lead"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {editingLeadId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-3xl shadow-2xl">
              <CardHeader>
                <CardTitle>Edit Lead</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Phone Number *</Label>
                    <Input {...register("phoneNumber")} placeholder="+1234567890" />
                    {errors.phoneNumber && <p className="text-xs text-red-500">{errors.phoneNumber.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input {...register("name")} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input {...register("email")} type="email" placeholder="jane@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>Tags (comma separated)</Label>
                    <Input {...register("tags")} placeholder="vip, customer, hot-lead" />
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeEditLead}>Cancel</Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? "Saving..." : "Update Lead"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Leads ({leads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading leads...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-mono text-sm">{lead.phoneNumber}</TableCell>
                      <TableCell>{lead.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.email ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(Array.isArray(lead.tags) ? lead.tags : []).slice(0, 3).map((tag: string) => (
                            <span key={tag} className="inline-flex items-center gap-0.5 bg-muted text-xs px-1.5 py-0.5 rounded">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{lead.funnelStage ?? "lead"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => beginEditLead(lead)}>
                            <Pencil className="w-3 h-3 mr-1" />Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (window.confirm("Delete this lead?")) {
                                deleteMutation.mutate({
                                  id: lead.id,
                                  label: lead.name?.trim() || lead.phoneNumber,
                                });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No leads yet. Add your first lead or import a CSV.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
