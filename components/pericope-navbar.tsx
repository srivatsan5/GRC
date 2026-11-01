'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Bell,
  Search,
  ChevronRight,
  Menu,
  X,
  Shield,
  User,
  LogOut,
  ChevronDown,
  FileText,
  KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from './pericope-layout'
import { useAuth } from './providers/auth-provider'
import { ChangePasswordDialog } from './change-password-dialog'

const SEARCH_ROUTES: Array<{ label: string; href: string }> = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'RCSA Hub', href: '/rcsa' },
  { label: 'RCSA Provisioning', href: '/rcsa/provisioning' },
  { label: 'Risk Identification', href: '/rcsa/identification' },
  { label: 'Risk Mitigation', href: '/rcsa/mitigation' },
  { label: 'Risk Monitoring', href: '/rcsa/monitoring' },
  { label: 'Inherent Analysis', href: '/assessments/inherent' },
  { label: 'Residual Mapping', href: '/assessments/residual' },
  { label: 'Risk Heatmaps', href: '/heatmaps' },
  { label: 'Key Risk Indicators (KRI)', href: '/kri' },
  { label: 'Control Library', href: '/control-library' },
  { label: 'Risk Appetite', href: '/risk-appetite' },
  { label: 'Workflow & Approvals', href: '/workflow' },
  { label: 'Vendor Risk (TPRM)', href: '/vendor-risk' },
  { label: 'Incident Management', href: '/incidents' },
  { label: 'Business Continuity (BCP)', href: '/bcp' },
  { label: 'Scenario Analysis', href: '/scenario' },
  { label: 'Policy Management', href: '/policy' },
  { label: 'Audit Trail', href: '/audit-trail' },
  { label: 'User Management', href: '/users' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' },
]

const NOTIFICATIONS = [
  { id: 'n-1', title: 'RCSA cycle pending review', body: 'Finance assessment cycle is ready for sign-off.', time: '10m ago' },
  { id: 'n-2', title: 'KRI threshold breach', body: 'IT outage hours exceeded amber limit.', time: '45m ago' },
  { id: 'n-3', title: 'Control tested', body: 'CTL-FIN-SOD-07 test completed successfully.', time: '2h ago' },
]

export function PericopeNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toggle } = useSidebar()
  const { user, logout } = useAuth()
  const [passwordOpen, setPasswordOpen] = React.useState(false)

  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLDivElement>(null)
  const notifRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setNotificationsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotificationsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs = segments.map((s, i) => ({
    name: s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))

  const filteredRoutes = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return SEARCH_ROUTES.slice(0, 6)
    return SEARCH_ROUTES.filter(link => link.label.toLowerCase().includes(q)).slice(0, 8)
  }, [searchQuery])

  const currentRole = user?.role || 'Viewer'

  return (
    <header className="fixed top-0 right-0 left-0 h-12 z-40 flex items-center justify-between px-4 bg-white border-b border-slate-200 shadow-xs print:hidden">
      {/* Left: Brand & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded"
        >
          <Menu className="w-4 h-4" />
        </Button>

        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-900">Pericope</span>
          <span className="text-xs text-slate-400 font-normal">ERM</span>
        </Link>

        {breadcrumbs.length > 0 && (
          <nav className="hidden sm:flex items-center gap-1 text-xs text-slate-500 ml-2">
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={bc.href}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span
                  onClick={() => router.push(bc.href)}
                  className={cn(
                    'cursor-pointer hover:text-slate-900 transition-colors',
                    i === breadcrumbs.length - 1 ? 'font-medium text-slate-900' : ''
                  )}
                >
                  {bc.name}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      {/* Right: Search, Notifications & User Menu */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative" ref={searchRef}>
          <div
            onClick={() => setSearchOpen(true)}
            className="flex items-center bg-slate-50 border border-slate-200 rounded px-2.5 py-1 w-48 sm:w-60 cursor-text hover:bg-white transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <span className="text-xs text-slate-400 flex-1 truncate">Search...</span>
            <span className="text-[10px] text-slate-400 bg-slate-200 px-1 py-0.2 rounded font-mono">⌘K</span>
          </div>

          {searchOpen && (
            <div className="absolute right-0 mt-1 w-72 bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden z-50">
              <div className="p-2 border-b border-slate-100">
                <Input
                  autoFocus
                  placeholder="Search modules..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {filteredRoutes.map(link => (
                  <button
                    key={link.href}
                    onClick={() => { router.push(link.href); setSearchOpen(false); setSearchQuery('') }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                  >
                    <span>{link.label}</span>
                    <span className="text-[10px] text-slate-400">{link.href}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNotificationsOpen(o => !o)}
            className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full" />
          </Button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-1 w-80 bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-semibold text-slate-900">Notifications</span>
                <button onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {NOTIFICATIONS.map(n => (
                  <div key={n.id} className="p-3 hover:bg-slate-50 text-xs">
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="text-slate-500 mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-slate-100 text-center">
                <Link
                  href="/audit-trail"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-xs text-blue-700 hover:underline"
                >
                  View audit log
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1.5"
            >
              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-semibold">
                {(user?.name || 'U')[0]}
              </div>
              <span className="hidden sm:inline">{user?.name}</span>
              <span className="text-[11px] text-slate-400">({currentRole})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 p-1 text-xs">
            <DropdownMenuLabel className="px-2 py-1.5 font-normal text-slate-500">
              <div className="font-semibold text-slate-900">{user?.name}</div>
              <div className="text-[11px] text-slate-500">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setPasswordOpen(true)}
              className="px-2 py-1.5 text-xs text-slate-700 cursor-pointer flex items-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Change password</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/reports')}
              className="px-2 py-1.5 text-xs text-slate-700 cursor-pointer flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Reports</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={logout}
              className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      </div>
    </header>
  )
}
