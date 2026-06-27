import { createContext, useContext, useState, ReactNode } from "react"

interface AuthUser {
  email: string
  name: string
  role: string
}

type SignupResult = "ok" | "exists" | "error"

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => boolean
  signup: (name: string, email: string, password: string) => SignupResult
  logout: () => void
}

const DEMO_CREDENTIALS: Record<string, { password: string; name: string; role: string }> = {
  "adjuster@claimvision.ai": { password: "demo2024", name: "Alex Adjuster", role: "Claims Adjuster" },
  "admin@claimvision.ai":    { password: "admin2024", name: "Sam Admin",     role: "Admin" },
}

const SESSION_KEY  = "claimvision_auth"
const ACCOUNTS_KEY = "claimvision_accounts"

function loadAccounts(): Record<string, { password: string; name: string; role: string }> {
  try {
    const stored = localStorage.getItem(ACCOUNTS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveAccounts(accounts: Record<string, { password: string; name: string; role: string }>) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {}
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const setSession = (authUser: AuthUser) => {
    setUser(authUser)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser))
  }

  const login = (email: string, password: string): boolean => {
    const key = email.toLowerCase()
    // Check demo credentials first
    const demo = DEMO_CREDENTIALS[key]
    if (demo && demo.password === password) {
      setSession({ email: key, name: demo.name, role: demo.role })
      return true
    }
    // Check registered accounts
    const accounts = loadAccounts()
    const account = accounts[key]
    if (account && account.password === password) {
      setSession({ email: key, name: account.name, role: account.role })
      return true
    }
    return false
  }

  const signup = (name: string, email: string, password: string): SignupResult => {
    const key = email.toLowerCase()
    // Block if it's a demo account email
    if (DEMO_CREDENTIALS[key]) return "exists"
    const accounts = loadAccounts()
    if (accounts[key]) return "exists"
    accounts[key] = { password, name, role: "Claims Adjuster" }
    saveAccounts(accounts)
    setSession({ email: key, name, role: "Claims Adjuster" })
    return "ok"
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
