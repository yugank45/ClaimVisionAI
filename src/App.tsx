import { Switch, Route, Router as WouterRouter, Redirect } from "wouter"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider, useAuth } from "@/context/auth"
import NotFound from "@/pages/not-found"
import Login from "@/pages/login"
import Signup from "@/pages/signup"
import { AppLayout } from "@/components/layout"
import Home from "@/pages/home"
import Upload from "@/pages/upload"
import Processing from "@/pages/processing"
import Claims from "@/pages/claims"
import ClaimDetail from "@/pages/claim-detail"
import Analytics from "@/pages/analytics"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth()
  if (!user) return <Redirect to="/login" />
  return <Component />
}

function Router() {
  const { user } = useAuth()

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/signup">
        {user ? <Redirect to="/" /> : <Signup />}
      </Route>
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/"><ProtectedRoute component={Home} /></Route>
            <Route path="/upload"><ProtectedRoute component={Upload} /></Route>
            <Route path="/processing"><ProtectedRoute component={Processing} /></Route>
            <Route path="/claims/:id"><ProtectedRoute component={ClaimDetail} /></Route>
            <Route path="/claims"><ProtectedRoute component={Claims} /></Route>
            <Route path="/analytics"><ProtectedRoute component={Analytics} /></Route>
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
