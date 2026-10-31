'use client'

import * as React from 'react'
import Link from 'next/link'
import { 
  ShieldCheck, 
  Target, 
  Settings2, 
  Activity, 
  ChevronRight, 
  ArrowRight,
  Fingerprint,
  Zap,
  BarChart4
} from 'lucide-react'
import { PericopeLayout } from '@/components/pericope-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function RCSACommandHub() {
  const workflowStages = [
    {
      id: '01',
      title: 'Provisioning',
      description: 'Define assessment scope, departments, and ownership frameworks.',
      href: '/rcsa/provisioning',
      icon: Settings2,
      status: 'Active',
      color: 'blue'
    },
    {
      id: '02',
      title: 'Risk Identification',
      description: 'Pinpoint and categorize institutional risks with stakeholder input.',
      href: '/rcsa/identification',
      icon: Target,
      status: 'Active',
      color: 'blue'
    },
    {
      id: '03',
      title: 'Risk Mitigation',
      description: 'Map controls to identified risks and track remediation coverage.',
      href: '/rcsa/mitigation',
      icon: ShieldCheck,
      status: 'Active',
      color: 'blue'
    },
    {
      id: '04',
      title: 'Risk Monitoring',
      description: 'Continuous oversight of control performance and action items.',
      href: '/rcsa/monitoring',
      icon: Activity,
      status: 'Active',
      color: 'blue'
    }
  ]

  return (
    <PericopeLayout>
      <div className="max-w-6xl mx-auto space-y-12 py-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <Badge variant="outline" className="px-4 py-1 border-primary/20 bg-primary/5 text-primary font-black uppercase tracking-[0.2em] text-[10px]">
            Risk Control Self-Assessment
          </Badge>
          <h1 className="font-display font-black text-6xl text-foreground tracking-tight italic">
            RCSA <span className="text-muted-foreground/40 font-serif">Command</span> Hub
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg font-medium leading-relaxed italic">
            The neural center for enterprise risk lifecycle management. Navigate through the orchestrated stages of assessment, mitigation, and monitoring.
          </p>
        </div>

        {/* Workflow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {workflowStages.map((stage) => (
            <Link key={stage.id} href={stage.href} className="group outline-none">
              <Card className="h-full border-outline-variant/30 hover:border-primary/40 hover:shadow-premium transition-all duration-500 bg-card/50 backdrop-blur-sm relative overflow-hidden">
                {/* Background Accent */}
                <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                   <stage.icon className="w-48 h-48 -mr-12 -mt-12 rotate-12" />
                </div>

                <CardContent className="p-8 flex flex-col h-full relative z-10">
                  <div className="flex items-start justify-between mb-8">
                    <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-600 group-hover:scale-110 transition-transform duration-500">
                      <stage.icon className="w-8 h-8" />
                    </div>
                    <span className="font-display font-black text-4xl text-muted-foreground/10 group-hover:text-primary/20 transition-colors">
                      {stage.id}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1">
                    <h3 className="text-2xl font-black text-foreground tracking-tight group-hover:translate-x-1 transition-transform">{stage.title}</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed border-l-2 border-outline-variant/30 pl-4">
                      {stage.description}
                    </p>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <Badge variant="success" className="bg-blue-50 text-blue-700 border-none font-black uppercase text-[9px] tracking-widest">
                      Workflow Optimized
                    </Badge>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest group-hover:gap-4 transition-all">
                      Enter Stage
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Bottom Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-outline-variant/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-primary">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Audit Ready</p>
              <p className="text-sm font-bold text-foreground">Fully traceable lifecycle</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-primary">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">High Velocity</p>
              <p className="text-sm font-bold text-foreground">Real-time DB synchronization</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-primary">
              <BarChart4 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Compliant</p>
              <p className="text-sm font-bold text-foreground">SOX & ISO 27001 standard</p>
            </div>
          </div>
        </div>
      </div>
    </PericopeLayout>
  )
}
