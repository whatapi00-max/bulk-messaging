import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignsApi, leadsApi, numbersApi } from "@/api";
import { notifyApp } from "@/lib/notifications";
import { formatDate, formatNumber } from "@/lib/utils";
import { Plus, Play, Download, Trash2 } from "lucide-react";

const campaignSchema = z
  .object({
    name: z.string().min(2),
    description: z.string().optional(),
    messageText: z.string().optional(),
    templateName: z.string().optional(),
    templateLanguage: z.string().default("en"),
  })
  .refine(
    (data) => Boolean(data.messageText?.trim()) || Boolean(data.templateName?.trim()),
    { message: "Provide Message Text or Template Name", path: ["messageText"] }
  );

type CampaignForm = z.infer<typeof campaignSchema>;

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalRecipients?: number;
  messagesSent?: number;
  messagesDelivered?: number;
  messagesFailed?: number;
  createdAt: string;
}

export default function CampaignsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedNumberIds, setSelectedNumberIds] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: campaignsApi.list,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => leadsApi.list(),
  });

  const { data: numbers = [] } = useQuery({
    queryKey: ["numbers"],
    queryFn: numbersApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (values: CampaignForm) =>
      campaignsApi.create({
        ...values,
        leadIds: selectedLeadIds,
        numberIds: selectedNumberIds,
      }),
    onSuccess: (result: Campaign, values) => {
      const campaignName = result.name || values.name;
      notifyApp({
        title: "Campaign Created",
        description: `[Campaigns > Create]\nCampaign: ${campaignName}\nRecipients: ${selectedLeadIds.length}\nNumbers: ${selectedNumberIds.length}\nMode: ${values.templateName?.trim() ? `Template (${values.templateName.trim()})` : "Custom text"}`,
        kind: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      reset();
      setShowCreate(false);
      setSelectedLeadIds([]);
      setSelectedNumberIds([]);
    },
    onError: (error: unknown, values) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Campaign create failed.");
      notifyApp({
        title: "Campaign Create Failed",
        description: `[Campaigns > Create]\nCampaign: ${values.name}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => campaignsApi.start(id),
    onSuccess: (_result, variables) => {
      notifyApp({
        title: "Campaign Started",
        description: `[Campaigns > Start]\nCampaign: ${variables.name}\nStatus: Queued for delivery`,
        kind: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error: unknown, variables) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Campaign start failed.");
      notifyApp({
        title: "Campaign Start Failed",
        description: `[Campaigns > Start]\nCampaign: ${variables.name}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => campaignsApi.remove(id),
    onSuccess: (_result, variables) => {
      notifyApp({
        title: "Campaign Deleted",
        description: `[Campaigns > Delete]\nCampaign: ${variables.name}`,
        kind: "warning",
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error: unknown, variables) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Campaign delete failed.");
      notifyApp({
        title: "Campaign Delete Failed",
        description: `[Campaigns > Delete]\nCampaign: ${variables.name}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
  });

  const hasLeads = leads.length > 0;
  const hasNumbers = numbers.length > 0;

  return (
    <AppLayout title="Campaigns">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">Build and launch bulk WhatsApp campaigns with smart number rotation.</p>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Campaign Name</Label>
                    <Input {...register("name")} placeholder="Summer Promotion" />
                  </div>
                  <div className="space-y-1">
                    <Label>Template Name (optional, Meta-approved)</Label>
                    <Input {...register("templateName")} placeholder="hello_world" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Message Text (used if no template)</Label>
                  <Textarea {...register("messageText")} rows={3} placeholder="Hello {{name}}! We have a special offer..." />
                  {errors.messageText && (
                    <p className="text-xs text-red-500">{errors.messageText.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Select Recipients ({selectedLeadIds.length} selected)</Label>
                    <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                      {!hasLeads && (
                        <p className="text-xs text-muted-foreground">No leads found. Add leads first in Leads page.</p>
                      )}
                      <button
                        type="button"
                        className="text-xs text-primary underline mb-1"
                        disabled={!hasLeads}
                        onClick={() => setSelectedLeadIds(selectedLeadIds.length === leads.length ? [] : leads.map((l: {id: string}) => l.id))}
                      >
                        {selectedLeadIds.length === leads.length ? "Deselect All" : "Select All"}
                      </button>
                      {leads.map((lead: { id: string; name?: string; phoneNumber: string }) => (
                        <label key={lead.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={(e) =>
                              setSelectedLeadIds(
                                e.target.checked
                                  ? [...selectedLeadIds, lead.id]
                                  : selectedLeadIds.filter((id) => id !== lead.id)
                              )
                            }
                          />
                          <span>{lead.name ?? lead.phoneNumber}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Select Numbers ({selectedNumberIds.length} selected)</Label>
                    <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                      {!hasNumbers && (
                        <p className="text-xs text-muted-foreground">No WhatsApp numbers found. Add and verify a number in Numbers page.</p>
                      )}
                      {numbers.map((number: { id: string; displayName: string; phoneNumber: string }) => (
                        <label key={number.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedNumberIds.includes(number.id)}
                            onChange={(e) =>
                              setSelectedNumberIds(
                                e.target.checked
                                  ? [...selectedNumberIds, number.id]
                                  : selectedNumberIds.filter((id) => id !== number.id)
                              )
                            }
                          />
                          <span>{number.displayName} — {number.phoneNumber}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || !selectedLeadIds.length || !selectedNumberIds.length}>
                    {createMutation.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </div>
                {(!hasLeads || !hasNumbers) && (
                  <p className="text-xs text-amber-600">
                    Campaign requires at least one lead and one verified WhatsApp number.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>All Campaigns</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading campaigns...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "completed" ? "success" : c.status === "running" ? "default" : "secondary"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNumber(c.totalRecipients ?? 0)}</TableCell>
                      <TableCell>{formatNumber(c.messagesSent ?? 0)}</TableCell>
                      <TableCell className="text-green-600">{formatNumber(c.messagesDelivered ?? 0)}</TableCell>
                      <TableCell className="text-red-500">{formatNumber(c.messagesFailed ?? 0)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(c.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(c.status === "draft" || c.status === "scheduled") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startMutation.mutate({ id: c.id, name: c.name })}
                              disabled={startMutation.isPending}
                            >
                              <Play className="w-3 h-3 mr-1" />Start
                            </Button>
                          )}
                          {(c.messagesFailed ?? 0) > 0 && (
                            <a href={campaignsApi.exportFailed(c.id, "csv")} download>
                              <Button size="sm" variant="ghost">
                                <Download className="w-3 h-3 mr-1" />CSV
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (window.confirm("Delete this campaign?")) {
                                deleteMutation.mutate({ id: c.id, name: c.name });
                              }
                            }}
                            disabled={deleteMutation.isPending || c.status === "running"}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {campaigns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No campaigns yet. Create one to get started!
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
