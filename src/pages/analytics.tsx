import { useGetAnalytics } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, DollarSign, Clock, CheckCircle2, ShieldAlert } from "lucide-react"
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts"

const STATUS_COLORS = {
  supported: "#22c55e",
  contradicted: "#ef4444",
  not_enough_information: "#f59e0b"
}

const SEVERITY_COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
  none: "#94a3b8",
  unknown: "#64748b"
}

export default function Analytics() {
  const { data: analytics, isLoading } = useGetAnalytics()

  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Format data for Recharts
  const statusData = [
    { name: "Supported", value: analytics.status_distribution?.supported ?? 0, color: STATUS_COLORS.supported },
    { name: "Contradicted", value: analytics.status_distribution?.contradicted ?? 0, color: STATUS_COLORS.contradicted },
    { name: "Insufficient Info", value: analytics.status_distribution?.not_enough_information ?? 0, color: STATUS_COLORS.not_enough_information },
  ].filter(d => d.value > 0)

  const severityData = [
    { name: "High", value: analytics.severity_distribution?.high ?? 0, fill: SEVERITY_COLORS.high },
    { name: "Medium", value: analytics.severity_distribution?.medium ?? 0, fill: SEVERITY_COLORS.medium },
    { name: "Low", value: analytics.severity_distribution?.low ?? 0, fill: SEVERITY_COLORS.low },
    { name: "None", value: analytics.severity_distribution?.none ?? 0, fill: SEVERITY_COLORS.none },
  ]

  const riskFlagData = Object.entries(analytics.risk_flag_frequency || {})
    .filter(([key]) => key !== 'none')
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: value
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Portfolio-wide metrics and processing statistics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Est. Processing Cost</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(analytics.estimated_cost_usd ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(analytics.total_tokens ?? 0).toLocaleString()} tokens used
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Processing Time</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avg_processing_time?.toFixed(1) || '0'}s</div>
            <p className="text-xs text-muted-foreground mt-1">Per claim review</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Claims</CardTitle>
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_claims}</div>
            <p className="text-xs text-muted-foreground mt-1">Processed successfully</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Evidence Std. Rate</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((analytics.evidence_standard_rate ?? 0) * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Met required standards</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Decision Distribution</CardTitle>
            <CardDescription>AI outcomes across all processed claims</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Damage Severity Breakdown</CardTitle>
            <CardDescription>Estimated severity of supported claims</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Top Risk Flags Detected</CardTitle>
            <CardDescription>Most frequent heuristic flags indicating potential fraud or poor evidence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskFlagData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={150} />
                  <RechartsTooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
