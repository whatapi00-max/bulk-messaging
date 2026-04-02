import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { analyticsApi } from "@/api";
import {
  formatNumber,
  formatPercent,
  formatDate,
  getStatusColor,
} from "@/lib/utils";
import {
  ArrowUpRight,
  MessageCircle,
  Users,
  Phone,
  BarChart2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface DashboardData {
  summary: {
    totalLeads: number;
    totalCampaigns: number;
    activeNumbers: number;
    pausedNumbers: number;
    bannedNumbers: number;
    avgHealth: number;
    totalSent: number;
    deliveryRate: number;
    readRate: number;
    replyRate: number;
    unreadMessages: number;
    failedMessages: number;
    failedData: number;
  };
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    totalRecipients: number;
    messagesSent: number;
    messagesDelivered: number;
    messagesRead: number;
    messagesFailed: number;
    createdAt: string;
  }>;
}

function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = "text-foreground",
}: {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between pt-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["analytics", "dashboard"],
    queryFn: analyticsApi.getDashboard,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const s = data?.summary;

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Leads" value={formatNumber(s?.totalLeads ?? 0)} icon={Users} />
          <StatCard
            title="Total Campaigns"
            value={formatNumber(s?.totalCampaigns ?? 0)}
            icon={BarChart2}
            color="text-blue-600"
          />
          <StatCard
            title="Failed Data"
            value={formatNumber(s?.failedData ?? 0)}
            subtext={(s?.failedMessages ?? 0) > 0 ? `${formatNumber(s?.failedMessages ?? 0)} total failed sends` : undefined}
            icon={AlertCircle}
            color="text-red-600"
          />
          <StatCard
            title="Banned Numbers"
            value={formatNumber(s?.bannedNumbers ?? 0)}
            subtext={`${formatNumber(s?.activeNumbers ?? 0)} active / ${formatNumber(s?.pausedNumbers ?? 0)} paused`}
            icon={ShieldAlert}
            color="text-orange-600"
          />
        </div>

        {/* Rate Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Delivery Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold text-green-600">
                {formatPercent(s?.deliveryRate ?? 0)}
              </p>
              <Progress value={s?.deliveryRate ?? 0} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Read Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold text-blue-600">
                {formatPercent(s?.readRate ?? 0)}
              </p>
              <Progress value={s?.readRate ?? 0} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reply Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold text-purple-600">
                {formatPercent(s?.replyRate ?? 0)}
              </p>
              <Progress value={s?.replyRate ?? 0} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {(s?.failedMessages ?? 0) > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 pt-4">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700">
                {formatNumber(s?.failedMessages ?? 0)} messages failed. Visit the{" "}
                <a href="/failed" className="underline font-medium">Failed Messages</a> page to download and retry.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recent Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : (
              <div className="space-y-3">
                {(data?.recentCampaigns ?? []).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(campaign.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-muted-foreground">Sent</p>
                        <p className="font-medium">{formatNumber(campaign.messagesSent)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Delivered</p>
                        <p className="font-medium text-green-600">
                          {formatNumber(campaign.messagesDelivered)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-medium text-red-600">
                          {formatNumber(campaign.messagesFailed)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          campaign.status === "completed"
                            ? "success"
                            : campaign.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(data?.recentCampaigns ?? []).length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    No campaigns yet. Create your first campaign!
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
