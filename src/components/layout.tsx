import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar"
import { Link, useLocation } from "wouter"
import { LayoutDashboard, UploadCloud, Activity, FileSearch, BarChart2, ShieldCheck, LogOut, ChevronDown } from "lucide-react"
import { useAuth } from "@/context/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) return null

  const initials = user.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2 h-9 px-2 hover:bg-muted/50">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col items-start leading-none">
            <span className="text-xs font-medium text-foreground">{user.name}</span>
            <span className="text-[10px] text-muted-foreground">{user.role}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <p className="text-xs text-primary">{user.role}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-400 cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground dark">
        <Sidebar className="border-r border-border/50 bg-card">
          <SidebarHeader className="h-16 flex items-center px-6 border-b border-border/50">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
              <ShieldCheck className="w-6 h-6" />
              <span>ClaimVision AI</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent className="pt-4">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/"}>
                      <Link href="/" className="flex items-center gap-3">
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Overview</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/upload"}>
                      <Link href="/upload" className="flex items-center gap-3">
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload Dataset</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/processing")}>
                      <Link href="/processing" className="flex items-center gap-3">
                        <Activity className="w-4 h-4" />
                        <span>Processing</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/claims")}>
                      <Link href="/claims" className="flex items-center gap-3">
                        <FileSearch className="w-4 h-4" />
                        <span>Claims Review</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/analytics"}>
                      <Link href="/analytics" className="flex items-center gap-3">
                        <BarChart2 className="w-4 h-4" />
                        <span>Analytics</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
          <header className="h-16 flex items-center justify-between px-4 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger />
            <UserMenu />
          </header>
          <main className="flex-1 overflow-auto p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
