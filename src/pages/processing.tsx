import { useEffect } from "react"
import { useLocation } from "wouter"
import { useGetProcessingStatus, getGetProcessingStatusQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"

export default function Processing() {
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  
  // The query automatically polls if we pass refetchInterval in query config.
  const { data: status, isLoading } = useGetProcessingStatus({
    query: {
      queryKey: getGetProcessingStatusQueryKey(),
      // Poll every 1s if processing is true
      refetchInterval: (query) => {
        return query.state.data?.is_processing ? 1000 : false
      }
    }
  })

  // Also manually poll just in case the initial data is stale and we want a quick refresh
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (status?.is_processing) {
      interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: getGetProcessingStatusQueryKey() })
      }, 1000)
    } else if (status && !status.is_processing && status.progress_percent === 100) {
      // Auto redirect to claims when finished
      const timeout = setTimeout(() => {
        setLocation("/claims")
      }, 3000)
      return () => clearTimeout(timeout)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [status?.is_processing, status?.progress_percent, queryClient, setLocation])

  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const isDone = status && !status.is_processing && status.progress_percent === 100
  const isIdle = status && !status.is_processing && (status.progress_percent === 0 || !status.progress_percent)

  return (
    <div className="max-w-3xl mx-auto mt-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {status?.is_processing ? "Analyzing Claims" : isDone ? "Analysis Complete" : "System Idle"}
        </h1>
        <p className="text-muted-foreground">
          {status?.is_processing 
            ? "Models are currently reviewing images, checking heuristics, and evaluating risk." 
            : isDone 
              ? "All claims have been successfully processed."
              : "No processing job is currently running."}
        </p>
      </div>

      <Card className="border-border/50 bg-card/50 shadow-lg relative overflow-hidden">
        {/* Animated background glow when processing */}
        {status?.is_processing && (
          <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
        )}
        
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span className="flex items-center gap-2">
              {status?.is_processing ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : isDone ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              Status
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {Math.round(status?.progress_percent || 0)}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress 
            value={status?.progress_percent || 0} 
            className="h-3 bg-secondary"
          />

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Message</p>
              <p className="font-medium text-sm">{status?.status_message || "Waiting..."}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Elapsed Time</p>
              <p className="font-medium text-sm flex items-center gap-1 tabular-nums">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {status?.elapsed_seconds ? `${status.elapsed_seconds.toFixed(1)}s` : "0s"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Claim</p>
              <p className="font-medium text-sm">
                {status?.current_claim || 0} / {status?.total_claims || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Target User</p>
              <p className="font-medium text-sm">{status?.current_user_id || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        {isDone && (
          <Button onClick={() => setLocation("/claims")} size="lg" className="w-full max-w-sm">
            View Results
          </Button>
        )}
        {isIdle && (
          <Button onClick={() => setLocation("/upload")} variant="outline" size="lg" className="w-full max-w-sm">
            Go to Upload
          </Button>
        )}
      </div>
    </div>
  )
}
