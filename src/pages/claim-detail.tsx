import { useRoute } from "wouter"
import { useGetClaim, getGetClaimQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Image as ImageIcon, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, AlertCircle, Info } from "lucide-react"
import { Link } from "wouter"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function ClaimDetail() {
  const [, params] = useRoute("/claims/:id")
  const id = params?.id || ""
  
  const { data: claim, isLoading } = useGetClaim(id, {
    query: { enabled: !!id, queryKey: getGetClaimQueryKey(id) }
  })

  if (isLoading || !claim) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const getStatusIcon = (status: string | null | undefined) => {
    switch(status) {
      case "supported": return <CheckCircle2 className="w-8 h-8 text-green-500" />
      case "contradicted": return <XCircle className="w-8 h-8 text-red-500" />
      case "not_enough_information": return <AlertTriangle className="w-8 h-8 text-amber-500" />
      default: return <Info className="w-8 h-8 text-muted-foreground" />
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/claims" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            Claim Record
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">{claim.id}</Badge>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border/50 overflow-hidden relative bg-card/40">
            {/* Status accent top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${
              claim.claim_status === 'supported' ? 'bg-green-500' :
              claim.claim_status === 'contradicted' ? 'bg-red-500' :
              'bg-amber-500'
            }`} />
            
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <div className="bg-background p-3 rounded-lg border border-border">
                  {getStatusIcon(claim.claim_status)}
                </div>
                <div>
                  <CardTitle className="text-xl capitalize">
                    {claim.claim_status?.replace(/_/g, ' ') || 'Pending Review'}
                  </CardTitle>
                  <CardDescription className="text-base mt-1 text-foreground/80">
                    User: {claim.user_id}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-md p-4 mb-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Final Reasoning</h4>
                <p className="text-sm leading-relaxed">{claim.claim_status_justification || "No justification provided."}</p>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">User Claim</h4>
                  <p className="text-sm">"{claim.user_claim}"</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Object Focus</h4>
                  <p className="text-sm capitalize">{claim.claim_object} • {claim.object_part || 'Whole'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Issue Type</h4>
                  <p className="text-sm capitalize">{claim.issue_type?.replace(/_/g, ' ') || 'Unknown'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Severity</h4>
                  <Badge variant={claim.severity === 'high' ? 'destructive' : claim.severity === 'medium' ? 'default' : 'secondary'} className="capitalize">
                    {claim.severity || 'Unknown'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-lg font-bold flex items-center gap-2 mt-8 mb-4">
            <ImageIcon className="w-5 h-5 text-primary" />
            Image Evidence Analyses ({claim.image_analyses?.length || 0})
          </h3>

          <div className="space-y-4">
            {claim.image_analyses?.map((analysis, i) => (
              <Card key={analysis.image_id || i} className="border-border/50 bg-card/30">
                <CardHeader className="py-4 border-b border-border/50 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium font-mono text-muted-foreground">
                        {analysis.image_path.split('/').pop() || analysis.image_path}
                      </CardTitle>
                    </div>
                  </div>
                  {claim.supporting_image_ids?.includes(analysis.image_id) && (
                    <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                      Supporting Evidence
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Visible Damage</span>
                      <div className="flex items-center gap-2">
                        {analysis.visible_damage ? <CheckCircle2 className="w-4 h-4 text-green-500"/> : <XCircle className="w-4 h-4 text-red-500"/>}
                        <span className="text-sm font-medium">{analysis.visible_damage ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Identified Issue</span>
                      <span className="text-sm font-medium capitalize">{analysis.visible_issue?.replace(/_/g, ' ') || 'None'}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Image Quality</span>
                      <span className="text-sm font-medium capitalize">{analysis.image_quality}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Wrong Object Detected</span>
                      <div className="flex items-center gap-2">
                        {analysis.wrong_object ? <AlertTriangle className="w-4 h-4 text-amber-500"/> : <CheckCircle2 className="w-4 h-4 text-green-500"/>}
                        <span className="text-sm font-medium">{analysis.wrong_object ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-2 bg-muted/20 p-3 rounded text-sm">
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">Analysis Details</span>
                    {analysis.explanation}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {(!claim.image_analyses || claim.image_analyses.length === 0) && (
              <div className="p-8 text-center bg-card/30 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
                No individual image analyses available for this claim.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Risk & Heuristics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-3">Detected Flags</h4>
                {claim.risk_flags && claim.risk_flags.length > 0 && !claim.risk_flags.includes("none") ? (
                  <div className="flex flex-wrap gap-2">
                    {claim.risk_flags.map(flag => (
                      <Badge key={flag} variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 capitalize">
                        {flag.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 p-2 rounded-md">
                    <CheckCircle2 className="w-4 h-4" />
                    No risk flags detected
                  </div>
                )}
              </div>

              <Separator className="bg-border/50" />

              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-3">Evidence Standards</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    {claim.evidence_standard_met ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{claim.evidence_standard_met ? 'Standards Met' : 'Standards Not Met'}</p>
                      {claim.evidence_standard_met_reason && (
                        <p className="text-xs text-muted-foreground mt-1">{claim.evidence_standard_met_reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              <div className="text-xs text-muted-foreground space-y-2">
                <div className="flex justify-between">
                  <span>Processing Time</span>
                  <span className="font-mono">{claim.processing_time_seconds?.toFixed(2) || '0'}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Token Usage</span>
                  <span className="font-mono">{claim.token_usage?.toLocaleString() || '0'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
