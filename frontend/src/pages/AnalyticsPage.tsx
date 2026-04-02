import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsApi } from "@/api";
import { formatNumber } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#25D366", "#128C7E", "#DCF8C6", "#ef4444", "#f59e0b"];

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: analyticsApi.getDashboard,
    refetchInterval: 30_000,
  });

  const s = data?.summary;

  const deliveryData = [
    { name: "Sent", value: s?.totalSent ?? 0 },
    { name: "Delivered", value: Math.round((s?.deliveryRate ?? 0) * (s?.totalSent ?? 0) / 100) },
    { name: "Read", value: Math.round((s?.readRate ?? 0) * (s?.totalSent ?? 0) / 100) },
    { name: "Replied", value: Math.round((s?.replyRate ?? 0) * (s?.totalSent ?? 0) / 100) },
    { name: "Failed", value: s?.failedMessages ?? 0 },
  ];

  const rateData = [
    { name: "Delivery Rate", value: s?.deliveryRate ?? 0 },
    { name: "Read Rate", value: s?.readRate ?? 0 },
    { name: "Reply Rate", value: s?.replyRate ?? 0 },
  ];

  return (
    <AppLayout title="Analytics">
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-muted-foreground">Loading analytics...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Leads", value: formatNumber(s?.totalLeads ?? 0) },
                { label: "Total Campaigns", value: formatNumber(s?.totalCampaigns ?? 0) },
                { label: "Total Sent", value: formatNumber(s?.totalSent ?? 0) },
                { label: "Failed", value: formatNumber(s?.failedMessages ?? 0) },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Message Funnel</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={deliveryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#25D366" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Engagement Rates</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={rateData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                      >
                        {rateData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
