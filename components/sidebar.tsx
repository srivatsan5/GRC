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
  User,
  LogOut
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'

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
    name: 'RCSA',
    icon: CheckSquare,
    submenu: [
      { name: 'Provisioning', href: '/rcsa/provisioning' },
      { name: 'Risk Identification', href: '/rcsa/identification' },
      { name: 'Risk Mitigation', href: '/rcsa/mitigation' },
      { name: 'Risk Monitoring', href: '/rcsa/monitoring' },
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
  const { logout } = useAuth()
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>('Risk Assessments')

  return (
    <aside className="w-56 bg-white text-slate-600 border-r border-border h-screen fixed left-0 top-0 flex flex-col z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-colors duration-300">
      {/* Brand Header */}
      <div className="px-6 py-6 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 tracking-tight leading-none">Pericope</span>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mt-1">Enterprise ERM</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        <div className="px-3 mb-2">
           <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">General</span>
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
                      ? 'bg-primary/10 text-primary hover:bg-primary/15'
                      : 'hover:text-primary hover:bg-slate-50'
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 transition-colors", 
                    isActive ? "text-primary" : "text-slate-400 group-hover:text-primary"
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
                    <div className="mt-0.5 space-y-0.5 ml-4 pl-3 border-l border-slate-200">
                      {item.submenu.map((subitem) => {
                        const isSubActive = pathname === subitem.href
                        return (
                          <Link
                            key={subitem.name}
                            href={subitem.href}
                            className={cn(
                              'block px-3 py-1.5 rounded-md text-[11px] font-bold transition-all',
                              isSubActive
                                ? 'text-primary bg-primary/5'
                                : 'text-slate-500 hover:text-primary hover:bg-slate-50'
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
      <div className="p-4 bg-slate-50 border-t border-border mt-auto">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary transition-all">
              SV
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-700 truncate">Srivatsan</span>
              <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest mt-0.5">Enterprise</span>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="p-2 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors" 
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
