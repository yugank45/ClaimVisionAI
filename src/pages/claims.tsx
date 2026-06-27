import { useState } from "react"
import { useGetClaims, getGetClaimsQueryKey } from "@workspace/api-client-react"
import { Link } from "wouter"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileSearch, Search, Filter, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Car, Laptop, Package } from "lucide-react"

export default function Claims() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  
  const queryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(severityFilter !== "all" && { severity: severityFilter })
  }
  
  const { data: claimsRaw, isLoading } = useGetClaims(queryParams)
  const claims = Array.isArray(claimsRaw) ? claimsRaw : []

  const getStatusBadge = (status: string | null | undefined) => {
    switch(status) {
      case "supported": return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Supported</Badge>
      case "contradicted": return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> Contradicted</Badge>
      case "not_enough_information": return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20"><AlertTriangle className="w-3 h-3 mr-1" /> Insufficient Info</Badge>
      default: return <Badge variant="outline">Pending</Badge>
    }
  }

  const getSeverityBadge = (severity: string | null | undefined) => {
    switch(severity) {
      case "high": return <Badge variant="destructive">High</Badge>
      case "medium": return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Medium</Badge>
      case "low": return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Low</Badge>
      case "none": return <Badge variant="secondary">None</Badge>
      default: return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getObjectIcon = (obj: string) => {
    switch(obj) {
      case "car": return <Car className="w-4 h-4 text-muted-foreground" />
      case "laptop": return <Laptop className="w-4 h-4 text-muted-foreground" />
      case "package": return <Package className="w-4 h-4 text-muted-foreground" />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims Review</h1>
          <p className="text-muted-foreground">Verify processed claims, review evidence, and evaluate risk flags.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search user ID..." className="pl-9 bg-background" />
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="supported">Supported</SelectItem>
              <SelectItem value="contradicted">Contradicted</SelectItem>
              <SelectItem value="not_enough_information">Insufficient Info</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Filter Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center space-y-4">
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-muted/50 rounded w-full"></div>
              <div className="h-10 bg-muted/50 rounded w-full"></div>
              <div className="h-10 bg-muted/50 rounded w-full"></div>
            </div>
          </div>
        ) : claims && claims.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">Claim ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Risk Flags</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id} className="hover:bg-muted/50 group cursor-pointer">
                    <TableCell className="font-mono text-xs text-muted-foreground">{claim.id.substring(0, 8)}</TableCell>
                    <TableCell className="font-medium">{claim.user_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 capitalize">
                        {getObjectIcon(claim.claim_object)}
                        {claim.claim_object}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(claim.claim_status)}</TableCell>
                    <TableCell>{getSeverityBadge(claim.severity)}</TableCell>
                    <TableCell>
                      {claim.risk_flags && claim.risk_flags.length > 0 && !claim.risk_flags.includes("none") ? (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/5 gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          {claim.risk_flags.length}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/claims/${claim.id}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          Review
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <FileSearch className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No claims found</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              There are no processed claims matching your criteria. Try uploading a dataset to begin.
            </p>
            <Link href="/upload">
              <Button>Go to Upload</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
