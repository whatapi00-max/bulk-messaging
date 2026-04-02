import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";

const autoReplySchema = z.object({
  trigger: z.string().min(1, "Trigger keyword required"),
  responseText: z.string().min(1, "Response text required"),
  matchType: z.enum(["exact", "contains", "starts_with"]).default("contains"),
});

type AutoReplyForm = z.infer<typeof autoReplySchema>;

const complianceItems = [
  { label: "Opt-out keyword configured (STOP / Unsubscribe)", key: "optout" },
  { label: "Message frequency disclosed to recipients", key: "frequency" },
  { label: "Business name included in messages", key: "bizname" },
  { label: "Meta Business account verified", key: "metaverified" },
  { label: "Weekly message limits respected per number", key: "limits" },
  { label: "Template messages pre-approved by Meta", key: "templates" },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const webhookUrl = `${window.location.origin.replace(/:\d+$/, ":8080")}/api/webhooks/meta`;
  const verifyToken = import.meta.env.VITE_META_VERIFY_TOKEN ?? "billy777_verify";

  const { data: autoReplies = [] } = useQuery({
    queryKey: ["auto-replies"],
    queryFn: async () => {
      // placeholder — wire to API if/when auto-replies endpoint is added
      return [] as AutoReplyForm[];
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AutoReplyForm>({
    resolver: zodResolver(autoReplySchema),
  });

  const onSubmit = (values: AutoReplyForm) => {
    console.log("Create auto-reply:", values);
    // mutate here when endpoint is ready
    reset();
    setShowForm(false);
  };

  return (
    <AppLayout title="Settings">
      <div className="space-y-8 max-w-3xl">

        {/* Compliance checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {complianceItems.map((item) => (
                <li key={item.key} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Auto-replies */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Auto-Replies</CardTitle>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="w-4 h-4 mr-1" />Add Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showForm && (
              <form onSubmit={handleSubmit(onSubmit)} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Trigger Keyword</Label>
                    <Input {...register("trigger")} placeholder="STOP, help, info..." />
                    {errors.trigger && <p className="text-xs text-red-500">{errors.trigger.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Match Type</Label>
                    <select {...register("matchType")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="contains">Contains</option>
                      <option value="exact">Exact match</option>
                      <option value="starts_with">Starts with</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Response Text</Label>
                  <Textarea {...register("responseText")} rows={3} placeholder="You've been unsubscribed. Reply START to re-subscribe." />
                  {errors.responseText && <p className="text-xs text-red-500">{errors.responseText.message}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" size="sm">Save Rule</Button>
                </div>
              </form>
            )}

            {autoReplies.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                No auto-replies configured. Add a rule so inbound keywords trigger automatic responses.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoReplies.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{r.trigger}</TableCell>
                      <TableCell><Badge variant="outline">{r.matchType}</Badge></TableCell>
                      <TableCell className="text-sm truncate max-w-xs">{r.responseText}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Webhook info */}
        <Card>
          <CardHeader><CardTitle>Webhook Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Configure the following webhook URL in your Meta Business Manager for each WhatsApp Number:
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-sm break-all">
              {webhookUrl}
            </div>
            <p className="text-sm text-muted-foreground">
              Verify token (copy this into Meta "Verify token" field):
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-sm break-all">
              {verifyToken}
            </div>
            <p className="text-sm text-muted-foreground">
              Subscribe to: <span className="font-mono text-xs bg-muted px-1 rounded">messages</span> and{" "}
              <span className="font-mono text-xs bg-muted px-1 rounded">message_status_update</span>
            </p>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
