'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  AlertTriangle,
  CheckSquare,
  Shield,
  Eye,
  History,
  BarChart3,
  Settings,
  Library,
  ChevronDown,
  Search,
  PlusCircle,
  Activity,
  User
} from 'lucide-react'

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Risk Assessments',
    icon: AlertTriangle,
    submenu: [
      { name: 'Dashboard', href: '/risk-assessments/dashboard' },
      { name: 'Assessments List', href: '/risk-assessments/list' },
    ],
  },
  {
    name: 'Risk Planning',
    icon: CheckSquare,
    submenu: [
      { name: 'Identify', href: '/risk-planning/identify' },
    ],
  },
  {
    name: 'Assessments',
    icon: Shield,
    submenu: [
      { name: 'Inherent Risk', href: '/assessments/inherent' },
      { name: 'Control Implementation', href: '/assessments/controls' },
      { name: 'Residual Risk', href: '/assessments/residual' },
    ],
  },
  {
    name: 'Monitoring',
    icon: Eye,
    submenu: [
      { name: 'Risk Monitoring', href: '/monitoring/risk-monitoring' },
      { name: 'Action Plan', href: '/monitoring/action-plan' },
    ],
  },
  {
    name: 'Analytics',
    icon: BarChart3,
    submenu: [
      { name: 'KRI Matrix', href: '/kri/matrix' },
      { name: 'Reports', href: '/reports' },
    ],
  },
  {
    name: 'Audit Trail',
    href: '/audit-trail',
    icon: History,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>('Risk Assessments')

  return (
    <aside className="w-56 bg-[#09090b] text-zinc-400 border-r border-zinc-800 h-screen fixed left-0 top-0 flex flex-col z-50">
      {/* Brand Header */}
      <div className="px-6 py-6 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center shadow-lg shadow-white/5">
            <Activity className="w-5 h-5 text-zinc-950" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-100 tracking-tight leading-none">Pericope</span>
            <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mt-1">Enterprise ERM</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        <div className="px-3 mb-2">
           <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">General</span>
        </div>
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || (item.submenu && item.submenu.some(sub => pathname === sub.href))
          const hasSubmenu = item.submenu && item.submenu.length > 0
          const isExpanded = expandedMenu === item.name

          return (
            <div key={item.name} className="space-y-0.5">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Link
                  href={item.href || '#'}
                  onClick={(e) => {
                    if (hasSubmenu) {
                      e.preventDefault()
                      setExpandedMenu(isExpanded ? null : item.name)
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all group',
                    isActive && !hasSubmenu
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'hover:text-zinc-100 hover:bg-zinc-800/50'
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 transition-colors", 
                    isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"
                  )} />
                  <span className="flex-1">{item.name}</span>
                  {hasSubmenu && (
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 transition-transform opacity-40 group-hover:opacity-100',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  )}
                </Link>
              </motion.div>

              <AnimatePresence initial={false}>
                {hasSubmenu && isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-0.5 space-y-0.5 ml-4 pl-3 border-l border-zinc-800">
                      {item.submenu.map((subitem) => {
                        const isSubActive = pathname === subitem.href
                        return (
                          <Link
                            key={subitem.name}
                            href={subitem.href}
                            className={cn(
                              'block px-3 py-1.5 rounded-md text-[11px] font-bold transition-all',
                              isSubActive
                                ? 'text-zinc-100 bg-zinc-800/40'
                                : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/30'
                            )}
                          >
                            {subitem.name}
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Profile Footer */}
      <div className="p-4 bg-zinc-950/50 border-t border-zinc-900">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            SV
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-zinc-100 truncate">Srivatsan</span>
            <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mt-0.5">Enterprise</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
