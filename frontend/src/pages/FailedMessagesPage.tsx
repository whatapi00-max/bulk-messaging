import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignsApi } from "@/api";
import { formatDate, formatNumber } from "@/lib/utils";
import { Download, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Campaign {
  id: string;
  name: string;
  totalRecipients?: number;
  messagesFailed?: number;
}

export default function FailedMessagesPage() {
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: campaignsApi.list,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.retryFailed(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const failedCampaigns = campaigns.filter((c) => (c.messagesFailed ?? 0) > 0);

  return (
    <AppLayout title="Failed Messages">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Download failed messages as CSV or XLSX per campaign, then retry or fix and re-upload.
        </p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Campaigns with Failures</CardTitle>
            </CardHeader>
            <CardContent>
              {failedCampaigns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No failed messages — great job!
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Failure Rate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedCampaigns.map((c) => {
                      const rate = (c.totalRecipients ?? 0) > 0
                        ? ((c.messagesFailed ?? 0) / (c.totalRecipients ?? 1)) * 100
                        : 0;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{formatNumber(c.totalRecipients ?? 0)}</TableCell>
                          <TableCell className="text-red-500">{formatNumber(c.messagesFailed ?? 0)}</TableCell>
                          <TableCell>
                            <Badge variant={rate > 20 ? "destructive" : "warning"}>
                              {rate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <a href={campaignsApi.exportFailed(c.id, "csv")} download>
                                <Button size="sm" variant="outline">
                                  <Download className="w-3 h-3 mr-1" />CSV
                                </Button>
                              </a>
                              <a href={campaignsApi.exportFailed(c.id, "xlsx")} download>
                                <Button size="sm" variant="outline">
                                  <Download className="w-3 h-3 mr-1" />XLSX
                                </Button>
                              </a>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => retryMutation.mutate(c.id)}
                                disabled={retryMutation.isPending}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />Retry All
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
