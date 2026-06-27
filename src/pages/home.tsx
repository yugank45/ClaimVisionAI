import { Link } from "wouter"
import { ShieldCheck, ArrowRight, Activity, BarChart2, FileSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useGetAnalytics } from "@workspace/api-client-react"

export default function Home() {
  const { data: analytics, isLoading } = useGetAnalytics()

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <section className="space-y-6 pt-8 pb-12">
        <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <Activity className="mr-2 h-4 w-4" />
          System Online
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
          Precision AI Evidence <br/>
          <span className="text-primary">Verification</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Analyze insurance damage claims instantly. Identify fraud, assess severity, and accelerate processing with surgical accuracy.
        </p>
        <div className="flex items-center gap-4 pt-4">
          <Link href="/upload" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2">
            Start Processing
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href="/claims" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-8 py-2">
            View Claims
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader>
            <FileSearch className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Automated Review</CardTitle>
            <CardDescription>Process thousands of claims in seconds</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Our models verify the presence of objects, assess damage severity, and validate the legitimacy of submitted images automatically.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader>
            <ShieldCheck className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Fraud Detection</CardTitle>
            <CardDescription>Identify manipulated or false evidence</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Advanced heuristics flag cropped, blurry, or manipulated images, and detect mismatch between the claim and the provided evidence.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader>
            <BarChart2 className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Deep Analytics</CardTitle>
            <CardDescription>Understand your risk landscape</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Comprehensive dashboards breakdown claim status, severity distributions, and identify common risk flags across your portfolio.
            </p>
          </CardContent>
        </Card>
      </section>

      {analytics && (
        <section className="pt-8">
          <h2 className="text-2xl font-bold tracking-tight mb-6">System Metrics</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Processed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics.total_claims}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Supported Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{analytics.status_distribution?.supported ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Contradicted Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">{analytics.status_distribution?.contradicted ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Est. Token Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">${(analytics.estimated_cost_usd ?? 0).toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}
