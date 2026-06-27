import { useState, useRef, useEffect } from "react"
import { useLocation } from "wouter"
import {
  UploadCloud, Database, Play, AlertCircle, CheckCircle2,
  Server, FileArchive, RefreshCw, ImageIcon, FolderOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useGetDatasetInfo, useProcessClaims, getGetDatasetInfoQueryKey } from "@workspace/api-client-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"

interface CoverageReport {
  total_references: number
  existing_count: number
  missing_count: number
  coverage_percent: number
  missing_dirs: string[]
  existing: { source: string; user_id: string; image_path: string; resolved_path: string }[]
  missing: { source: string; user_id: string; image_path: string }[]
}

interface ZipUploadResult {
  success: boolean
  extracted_count: number
  skipped_count: number
  target_dir: string
  message: string
  files: string[]
}

export default function Upload() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: datasetInfo, isLoading: isLoadingDataset, refetch: refetchDatasetInfo } = useGetDatasetInfo()
  const processMutation = useProcessClaims()

  const [maxClaims, setMaxClaims] = useState<string>("")
  const [coverage, setCoverage] = useState<CoverageReport | null>(null)
  const [loadingCoverage, setLoadingCoverage] = useState(false)
  const [uploadingZip, setUploadingZip] = useState<"test" | "sample" | null>(null)
  const testZipRef = useRef<HTMLInputElement>(null)
  const sampleZipRef = useRef<HTMLInputElement>(null)

  const fetchCoverage = async () => {
    setLoadingCoverage(true)
    try {
      const res = await fetch("/api/image-coverage")
      const data = await res.json()
      setCoverage(data)
    } catch {
      toast({ title: "Coverage check failed", variant: "destructive" })
    } finally {
      setLoadingCoverage(false)
    }
  }

  useEffect(() => {
    fetchCoverage()
  }, [])

  const handleZipUpload = async (file: File, target: "test" | "sample") => {
    if (!file.name.endsWith(".zip")) {
      toast({ title: "Invalid file", description: "Please select a .zip file.", variant: "destructive" })
      return
    }
    setUploadingZip(target)
    try {
      const formData = new FormData()
      formData.append("zip_file", file)
      formData.append("target", target)

      const res = await fetch("/api/upload-images-zip", {
        method: "POST",
        body: formData,
      })

      let data: ZipUploadResult
      try {
        data = await res.json()
      } catch {
        throw new Error(`Server error (${res.status} ${res.statusText})`)
      }

      if (!res.ok) {
        const detail = (data as unknown as { detail?: string })?.detail
        throw new Error(detail || `Server error ${res.status}`)
      }

      if (data.success) {
        toast({
          title: `✅ ${data.extracted_count} images extracted`,
          description: data.skipped_count > 0
            ? `into dataset/images/${target}/  (${data.skipped_count} non-image files skipped)`
            : `into dataset/images/${target}/`,
        })
        await fetchCoverage()
        queryClient.invalidateQueries({ queryKey: getGetDatasetInfoQueryKey() })
        refetchDatasetInfo()
      } else {
        toast({ title: "Upload failed", description: data.message, variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Upload error", description: String(e), variant: "destructive" })
    } finally {
      setUploadingZip(null)
    }
  }

  const handleProcess = async (dataset: "sample" | "test") => {
    try {
      const max = maxClaims ? parseInt(maxClaims, 10) : undefined
      await processMutation.mutateAsync({ data: { dataset, max_claims: max ?? null } })
      setLocation("/processing")
    } catch {
      toast({ title: "Processing Failed", description: "Could not start processing.", variant: "destructive" })
    }
  }

  const coverageColor = (pct: number) =>
    pct >= 80 ? "text-green-400" : pct >= 40 ? "text-amber-400" : "text-red-400"

  const progressColor = (pct: number) =>
    pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dataset Configuration</h1>
        <p className="text-muted-foreground">Upload images and configure datasets for multimodal AI analysis.</p>
      </div>

      {/* Image Coverage Report */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              <CardTitle>Image Coverage Report</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchCoverage} disabled={loadingCoverage}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loadingCoverage ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Images must be present locally for Vision API multimodal analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {coverage ? (
            <>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className={`text-4xl font-bold ${coverageColor(coverage.coverage_percent)}`}>
                    {coverage.coverage_percent}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Coverage</p>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">✓ {coverage.existing_count} images found</span>
                    <span className="text-red-400">✗ {coverage.missing_count} missing</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progressColor(coverage.coverage_percent)}`}
                      style={{ width: `${coverage.coverage_percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {coverage.total_references} total image references across both CSVs
                  </p>
                </div>
              </div>

              {coverage.missing_count > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {coverage.missing_count} images missing — Vision API will use text-only fallback for these claims
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {coverage.missing_dirs.length} folders needed. Upload a ZIP file below to populate them automatically.
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {coverage.missing_dirs.slice(0, 15).map(d => (
                      <p key={d} className="text-xs text-muted-foreground font-mono">{d}/</p>
                    ))}
                    {coverage.missing_dirs.length > 15 && (
                      <p className="text-xs text-muted-foreground">…and {coverage.missing_dirs.length - 15} more folders</p>
                    )}
                  </div>
                </div>
              )}

              {coverage.existing_count > 0 && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                  <p className="text-sm font-medium text-green-400 mb-1.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {coverage.existing_count} images ready for Vision analysis
                  </p>
                  <div className="max-h-24 overflow-y-auto">
                    {coverage.existing.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground font-mono">{e.image_path}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Checking image coverage...
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZIP Upload Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {(["test", "sample"] as const).map((target) => {
          const isTest = target === "test"
          const ref = isTest ? testZipRef : sampleZipRef
          const isUploading = uploadingZip === target
          const claimCount = isTest
            ? (datasetInfo?.test_claims_count ?? 0)
            : (datasetInfo?.sample_claims_count ?? 0)
          const hasImages = isTest
            ? datasetInfo?.has_test_images
            : datasetInfo?.has_sample_images
          const hasClaims = isTest
            ? datasetInfo?.has_test_claims
            : datasetInfo?.has_sample_claims

          return (
            <Card key={target} className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isTest
                    ? <Server className="w-5 h-5 text-primary" />
                    : <Database className="w-5 h-5 text-primary" />}
                  {isTest ? "Test Dataset" : "Sample Dataset"}
                  {hasClaims && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {claimCount} claims
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isTest
                    ? "44-claim test set. Upload test.zip to enable full Vision analysis."
                    : "20-claim sample set. Upload sample.zip for demonstration."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  {hasClaims
                    ? <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-400">CSV loaded</span></>
                    : <><AlertCircle className="w-4 h-4 text-amber-500" /><span className="text-muted-foreground">CSV missing</span></>}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {hasImages
                    ? <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-400">Images available</span></>
                    : <><AlertCircle className="w-4 h-4 text-amber-500" /><span className="text-muted-foreground">Images missing</span></>}
                </div>

                {/* ZIP Upload */}
                <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-4 text-center">
                  <FileArchive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-3">
                    Upload <code className="text-primary">{target}.zip</code> or any ZIP containing<br />
                    <code className="text-xs text-muted-foreground">case_*/img_*.jpg</code> folders
                  </p>
                  <input
                    ref={ref}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleZipUpload(file, target)
                      e.target.value = ""
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => ref.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Extracting…</>
                    ) : (
                      <><UploadCloud className="w-4 h-4 mr-2" />Upload ZIP</>
                    )}
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleProcess(target)}
                  disabled={processMutation.isPending || !hasClaims}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Process {isTest ? "Test" : "Sample"} Dataset
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Processing Settings */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Processing Settings
          </CardTitle>
          <CardDescription>Limit claims to control cost during testing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="max-claims">Maximum Claims (optional)</Label>
            <Input
              id="max-claims"
              type="number"
              placeholder="e.g. 5  — leave blank for all"
              value={maxClaims}
              onChange={(e) => setMaxClaims(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ~$0.001 per claim · ~15s per claim · gpt-4o-mini Vision
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
