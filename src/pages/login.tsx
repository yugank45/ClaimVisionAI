import { useState, FormEvent } from "react"
import { Link, useLocation } from "wouter"
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/auth"

export default function Login() {
  const { login } = useAuth()
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const ok = login(email, password)
    setLoading(false)
    if (ok) {
      setLocation("/")
    } else {
      setError("Invalid email or password.")
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center dark p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">ClaimVision AI</h1>
          <p className="text-muted-foreground text-sm">AI-powered insurance evidence verification</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground mt-1">Use your adjuster credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="adjuster@claimvision.ai"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError("") }}
                  className="pl-10"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError("") }}
                  className="pl-10 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : "Sign in"}
            </Button>
          </form>

          {/* Demo hint */}
          <div className="rounded-lg bg-muted/40 border border-border/40 p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Demo credentials</p>
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">adjuster@claimvision.ai</span>
                <span
                  className="text-primary cursor-pointer hover:underline"
                  onClick={() => { setEmail("adjuster@claimvision.ai"); setPassword("demo2024") }}
                >
                  demo2024
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">admin@claimvision.ai</span>
                <span
                  className="text-primary cursor-pointer hover:underline"
                  onClick={() => { setEmail("admin@claimvision.ai"); setPassword("admin2024") }}
                >
                  admin2024
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Click a password to auto-fill</p>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ClaimVision AI · Hackathon Demo · All rights reserved
        </p>
      </div>
    </div>
  )
}
