'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Shield,
  Eye,
  BarChart3,
  History,
  Settings,
  ChevronDown,
  Activity,
  LogOut,
  X,
  ClipboardCheck,
  Layers,
  Users,
  Target,
  AlertOctagon,
  Briefcase,
  GitBranch,
  TrendingUp,
  BookOpen,
  Lock,
} from 'lucide-react'
import { useAuth, Role } from '@/components/providers/auth-provider'
import { useSidebar } from './pericope-layout'

const NAVIGATION: Array<{
  group: string
  items: Array<{
    name: string
    href?: string
    icon: any
    roleRequired?: Role[]
    submenu?: Array<{ name: string; href: string }>
  }>
}> = [
  {
    group: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ]
  },
  {
    group: 'RCSA',
    items: [
      { name: 'RCSA Hub', href: '/rcsa', icon: Shield },
      {
        name: 'Assessment Lifecycle',
        icon: GitBranch,
        submenu: [
          { name: 'Provisioning & Setup', href: '/rcsa/provisioning' },
          { name: 'Risk Identification', href: '/rcsa/identification' },
          { name: 'Mitigation & Controls', href: '/rcsa/mitigation' },
          { name: 'Risk Monitoring', href: '/rcsa/monitoring' },
        ]
      },
    ]
  },
  {
    group: 'Risk Analytics',
    items: [
      {
        name: 'Analysis & Matrix',
        icon: Eye,
        submenu: [
          { name: 'Inherent Analysis', href: '/assessments/inherent' },
          { name: 'Residual Risk', href: '/assessments/residual' },
          { name: '5×5 Risk Heatmaps', href: '/heatmaps' },
        ]
      },
      { name: 'Key Risk Indicators (KRI)', href: '/kri', icon: Activity },
      { name: 'Reports', href: '/reports', icon: BarChart3 },
    ]
  },
  {
    group: 'Controls & Policy',
    items: [
      { name: 'Control Library', href: '/control-library', icon: ClipboardCheck },
      { name: 'Risk Appetite', href: '/risk-appetite', icon: Target },
      { name: 'Workflow Approvals', href: '/workflow', icon: Layers },
      { name: 'Policy Center', href: '/policy', icon: BookOpen },
    ]
  },
  {
    group: 'Enterprise Risk',
    items: [
      { name: 'Vendor Risk (TPRM)', href: '/vendor-risk', icon: Briefcase },
      { name: 'Incidents', href: '/incidents', icon: AlertOctagon },
      { name: 'Business Continuity (BCP)', href: '/bcp', icon: Shield },
      { name: 'Scenario Analysis', href: '/scenario', icon: TrendingUp },
    ]
  },
  {
    group: 'Administration',
    items: [
      { name: 'Audit Trail', href: '/audit-trail', icon: History },
      { name: 'User Management', href: '/users', icon: Users, roleRequired: ['Administrator'] },
      { name: 'Settings', href: '/settings', icon: Settings, roleRequired: ['Administrator'] },
    ]
  }
]

export function PericopeSidebar() {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const { isOpen, close } = useSidebar()
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(['Assessment Lifecycle', 'Analysis & Matrix'])

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev =>
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    )
  }

  const currentRole = user?.role || 'Viewer'

  if (!isOpen) return null

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 h-screen fixed left-0 top-0 flex flex-col z-50 shadow-xl border-r border-slate-800 text-xs print:hidden">
      {/* Header */}
      <div className="px-4 h-12 flex items-center justify-between border-b border-slate-800 bg-slate-950">
        <span className="font-semibold text-slate-100 text-sm">Navigation</span>
        <button
          onClick={close}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {NAVIGATION.map((group) => (
          <div key={group.group} className="space-y-0.5">
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {group.group}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.submenu && item.submenu.some(sub => pathname === sub.href))
                const isExpanded = expandedGroups.includes(item.name)
                const isRestricted = item.roleRequired && !item.roleRequired.includes(currentRole)

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => {
                        if (item.submenu) {
                          toggleGroup(item.name)
                        } else if (item.href) {
                          close()
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs transition-colors group relative",
                        isActive && !item.submenu
                          ? "bg-blue-900 text-white font-medium"
                          : "text-slate-300 hover:text-white hover:bg-slate-800"
                      )}
                    >
                      {item.href && !item.submenu ? (
                        <Link href={item.href} onClick={close} className="absolute inset-0 z-10" />
                      ) : null}

                      <item.icon className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                      )} />
                      <span className="flex-1 text-left truncate">{item.name}</span>

                      {isRestricted && (
                        <Lock className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      )}

                      {item.submenu && (
                        <ChevronDown className={cn(
                          "w-3 h-3 transition-transform text-slate-500",
                          isExpanded && "rotate-180"
                        )} />
                      )}
                    </button>

                    {/* Submenu */}
                    {item.submenu && isExpanded && (
                      <div className="ml-5 pl-2.5 border-l border-slate-800 space-y-0.5 my-0.5">
                        {item.submenu.map((sub) => {
                          const isSubActive = pathname === sub.href
                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              onClick={close}
                              className={cn(
                                "block px-2 py-1 rounded text-xs transition-colors",
                                isSubActive
                                  ? "text-white font-medium bg-slate-800"
                                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                              )}
                            >
                              {sub.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer User Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex flex-col truncate pr-2">
          <span className="text-xs font-medium text-slate-200 truncate">{user?.name}</span>
          <span className="text-[11px] text-slate-500">{currentRole}</span>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
