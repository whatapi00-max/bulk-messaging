import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { numbersApi } from "@/api";
import { notifyApp } from "@/lib/notifications";
import { formatNumber, formatDate, formatPercent, getHealthColor } from "@/lib/utils";
import { Plus, Pause, Play, Send, Wifi, Phone, Trash2 } from "lucide-react";

const addNumberSchema = z.object({
  phoneNumberId: z.string().min(3, "Phone Number ID from Meta is required"),
  accessToken: z.string().min(10, "Access token is required"),
  wabaId: z.string().optional(),
  dailyLimit: z.number({ coerce: true }).int().positive().default(1000),
});

type AddNumberForm = z.infer<typeof addNumberSchema>;

interface WANumber {
  id: string;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId?: string;
  apiProvider: string;
  dailyLimit: number;
  messagesSentToday: number;
  healthScore: string;
  isActive: boolean;
  isPaused: boolean;
  pauseReason?: string;
  lastMessageAt?: string;
  errorCount: number;
  successCount: number;
  createdAt: string;
}

export default function NumbersPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [testTarget, setTestTarget] = useState("");
  const [testText, setTestText] = useState("Hello from Billy777 Bulk Messaging! 🎉");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: numbers = [], isLoading } = useQuery<WANumber[]>({
    queryKey: ["numbers"],
    queryFn: numbersApi.list,
  });

  const addMutation = useMutation({
    mutationFn: (values: AddNumberForm) => numbersApi.create(values as Record<string, unknown>),
    onSuccess: (result: WANumber, values: AddNumberForm) => {
      notifyApp({
        title: "Number Added",
        description: `[Numbers > Add]\nDisplay: ${result.displayName || result.phoneNumber || result.phoneNumberId}\nPhone Number ID: ${result.phoneNumberId || values.phoneNumberId}\nWABA ID: ${result.wabaId || values.wabaId || "(empty)"}\nDaily Limit: ${result.dailyLimit || values.dailyLimit}`,
        kind: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      reset();
      setShowAdd(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to add number. Please try again.";
      notifyApp({
        title: "Number Add Failed",
        description: `[Numbers > Add]\nError: ${msg}`,
        kind: "error",
      });
      setAddError(msg);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPaused }: { id: string; isPaused: boolean; label: string }) =>
      numbersApi.update(id, { isPaused }),
    onSuccess: (_result, variables) => {
      notifyApp({
        title: variables.isPaused ? "Number Paused" : "Number Activated",
        description: variables.isPaused
          ? `[Numbers > Pause]\nNumber: ${variables.label}\nState: Active -> Paused`
          : `[Numbers > Activate]\nNumber: ${variables.label}\nState: Paused -> Active`,
        kind: variables.isPaused ? "warning" : "success",
      });
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; label: string }) => numbersApi.remove(id),
    onSuccess: (_result, variables) => {
      notifyApp({
        title: "Number Deleted",
        description: `[Numbers > Delete]\nNumber: ${variables.label}`,
        kind: "warning",
      });
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setConfirmDeleteId(null);
    },
    onError: (error: unknown, variables) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Number delete failed.");
      notifyApp({
        title: "Number Delete Failed",
        description: `[Numbers > Delete]\nNumber: ${variables.label}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => numbersApi.test(id, testTarget, testText),
    onSuccess: (_result, variables) => {
      notifyApp({
        title: "Test Message Sent",
        description: `[Numbers > Test]\nNumber: ${variables.label}\nTarget: ${testTarget}\nMessage: ${testText}`,
        kind: "success",
      });
      setTestingId(null);
    },
    onError: (error: unknown, variables) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "The test message could not be sent.");
      notifyApp({
        title: "Test Message Failed",
        description: `[Numbers > Test]\nNumber: ${variables.label}\nTarget: ${testTarget}\nError: ${message}`,
        kind: "error",
      });
      setTestingId(null);
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddNumberForm>({
    resolver: zodResolver(addNumberSchema),
  });

  const onSubmit = (values: AddNumberForm) => {
    setAddError(null);
    addMutation.mutate(values);
  };

  return (
    <AppLayout title="WhatsApp Numbers">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Manage your WhatsApp numbers. Add up to 1000+ numbers for high-volume sending.
          </p>
          <Button onClick={() => { setShowAdd(!showAdd); setAddError(null); reset(); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Number
          </Button>
        </div>

        {showAdd && (
          <Card>
            <CardHeader>
              <CardTitle>Add WhatsApp Number</CardTitle>
              <CardDescription>Connect via Meta Cloud API (or compatible provider)</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Phone Number ID (from Meta)</Label>
                  <Input {...register("phoneNumberId")} placeholder="123456789012345" />
                  {errors.phoneNumberId && (
                    <p className="text-xs text-red-500">{errors.phoneNumberId.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Access Token</Label>
                  <Input {...register("accessToken")} type="password" placeholder="EAAxxxxxxxx..." />
                  {errors.accessToken && (
                    <p className="text-xs text-red-500">{errors.accessToken.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>WABA ID <span className="text-muted-foreground">(optional)</span></Label>
                  <Input {...register("wabaId")} placeholder="WhatsApp Business Account ID" />
                </div>
                <div className="space-y-1">
                  <Label>Daily Limit</Label>
                  <Input {...register("dailyLimit", { valueAsNumber: true })} type="number" defaultValue={1000} />
                </div>
                <div className="col-span-2 flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setAddError(null); reset(); }}>Cancel</Button>
                  <Button type="submit" disabled={addMutation.isPending}>
                    {addMutation.isPending ? "Verifying with Meta..." : "Add Number"}
                  </Button>
                </div>
                {addError && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {addError}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading numbers...</p>
        ) : (
          <div className="grid gap-4">
            {numbers.map((number) => {
              const health = Number(number.healthScore);
              const isBanned = Boolean(number.pauseReason?.toLowerCase().includes("banned"));
              const usagePercent = Math.min(
                100,
                ((number.messagesSentToday ?? 0) / (number.dailyLimit ?? 1000)) * 100
              );
              return (
                <Card key={number.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{number.displayName}</h3>
                          <Badge variant={isBanned ? "destructive" : number.isPaused ? "warning" : number.isActive ? "success" : "secondary"}>
                            {isBanned ? "Banned" : number.isPaused ? "Paused" : number.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{number.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">ID: {number.phoneNumberId}</p>
                        {number.wabaId && (
                          <p className="text-xs text-muted-foreground">WABA: {number.wabaId}</p>
                        )}
                        {number.pauseReason && (
                          <p className="text-xs text-yellow-600 mt-1">{number.pauseReason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-4">
                          <p className={`text-xl font-bold ${getHealthColor(health)}`}>
                            {health.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">Health</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleMutation.mutate({
                            id: number.id,
                            isPaused: !number.isPaused,
                            label: number.displayName || number.phoneNumber || number.phoneNumberId,
                          })}
                        >
                          {number.isPaused ? (
                            <Play className="w-4 h-4" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                        </Button>
                        {confirmDeleteId === number.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteMutation.mutate({
                                id: number.id,
                                label: number.displayName || number.phoneNumber || number.phoneNumberId,
                              })}
                              disabled={deleteMutation.isPending}
                            >
                              Confirm
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setConfirmDeleteId(number.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Daily usage</span>
                        <span>
                          {formatNumber(number.messagesSentToday ?? 0)} /{" "}
                          {formatNumber(number.dailyLimit ?? 1000)}
                        </span>
                      </div>
                      <Progress value={usagePercent} className="h-1.5" />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                      <div>
                        <p className="font-semibold text-green-600">{formatNumber(number.successCount ?? 0)}</p>
                        <p className="text-muted-foreground">Success</p>
                      </div>
                      <div>
                        <p className="font-semibold text-red-500">{formatNumber(number.errorCount ?? 0)}</p>
                        <p className="text-muted-foreground">Errors</p>
                      </div>
                      <div>
                        <p className="font-semibold">{formatDate(number.lastMessageAt)}</p>
                        <p className="text-muted-foreground">Last message</p>
                      </div>
                    </div>

                    {/* Test message section */}
                    {testingId === number.id && (
                      <div className="mt-3 flex gap-2">
                        <Input
                          value={testTarget}
                          onChange={(e) => setTestTarget(e.target.value)}
                          placeholder="Recipient phone (+1234567890)"
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => testMutation.mutate({
                            id: number.id,
                            label: number.displayName || number.phoneNumber || number.phoneNumberId,
                          })}
                          disabled={testMutation.isPending || !testTarget}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Send
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 text-xs"
                      onClick={() => setTestingId(testingId === number.id ? null : number.id)}
                    >
                      <Wifi className="w-3 h-3 mr-1" />
                      {testingId === number.id ? "Cancel Test" : "Test Number"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {numbers.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No WhatsApp numbers added yet.</p>
                  <Button className="mt-4" onClick={() => setShowAdd(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Number
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
