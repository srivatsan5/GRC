'use client'

import React, { useState, createContext, useContext } from 'react'
import { PericopeSidebar } from './pericope-sidebar'
import { PericopeNavbar } from './pericope-navbar'
import { RoleContextBanner } from './role-context-banner'
import { cn } from '@/lib/utils'

const SidebarContext = createContext<{ isOpen: boolean; toggle: () => void; close: () => void }>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

export function PericopeLayout({ children, className }: { children: React.ReactNode, className?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggle = () => setSidebarOpen(prev => !prev)
  const close = () => setSidebarOpen(false)

  return (
    <SidebarContext.Provider value={{ isOpen: sidebarOpen, toggle, close }}>
      <div className="min-h-screen bg-slate-50 text-slate-900 relative font-sans">
        {/* Overlay when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={close}
          />
        )}

        <PericopeSidebar />

        <div className="relative z-10 flex flex-col min-h-screen print:min-h-0">
          <PericopeNavbar />
          <main className={cn(
            "flex-1 mt-12 px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full print:mt-0 print:p-0 print:max-w-none print:w-full",
            className
          )}>
            <div className="print:hidden">
              <RoleContextBanner />
            </div>
            {children}
          </main>
          
          <footer className="px-6 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2 print:hidden">
            <span>Pericope ERM &middot; Enterprise Risk Management</span>
            <span className="text-slate-400">Version 3.0</span>
          </footer>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
