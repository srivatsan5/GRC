'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Bell, Search, ChevronRight, Settings, HelpCircle, Activity } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from './ui/badge'

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/risk-assessments/dashboard': 'Risk Intelligence',
  '/risk-assessments/list': 'Risk Identification',
  '/risk-planning/identify': 'New Assessment',
  '/assessments/inherent': 'Inherent Risk',
  '/assessments/controls': 'Control Implementation',
  '/assessments/residual': 'Residual Risk',
  '/monitoring/risk-monitoring': 'Risk Monitoring',
  '/monitoring/action-plan': 'Action Plan',
  '/audit-trail': 'Audit Trail',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageLabel = routeLabels[pathname] || 'Enterprise ERM'

  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden">
      <Sidebar />
      <div className="flex-1 ml-56 flex flex-col relative bg-background rounded-l-[32px] border-l border-zinc-800 my-2 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Top Navigation */}
        <header className="h-14 border-b border-border flex items-center justify-between px-8 bg-card/30 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <span className="opacity-40">System</span>
              <ChevronRight className="w-3 h-3 opacity-20" />
              <span className="text-foreground tracking-tight">{pageLabel}</span>
            </div>
            <div className="h-3 w-px bg-border/50 mx-2" />
            <Badge variant="outline" className="text-[9px] font-black bg-emerald-500/5 text-emerald-500 border-emerald-500/10 px-1.5 py-0 leading-none">
              Live
            </Badge>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4 text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
               <button className="hover:text-foreground transition-colors">Documentation</button>
               <button className="hover:text-foreground transition-colors">Support</button>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all">
                <Search className="w-4 h-4" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
              </button>
              <div className="w-px h-4 bg-border/50 mx-1" />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

