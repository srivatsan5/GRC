'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Loader2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { motion } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'

const COLORS = ['#0f766e', '#0284c7', '#059669', '#d97706', '#dc2626', '#4f46e5']

export function RiskassessmentsdashboardPage() {
  const { data: rawRisks = [], isLoading } = useQuery({
    queryKey: ['risk-assessments-dashboard'],
    queryFn: () => oracleService.getRiskAssessmentsDashboard(),
  })

  const risks = useMemo(() => {
    return oracleService.parseAllRisks(rawRisks)
  }, [rawRisks])

  // Build real heatmap from risk data
  const heatmapData = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => {
      const row = Math.floor(i / 5)
      const col = i % 5
      const prob = 5 - row
      const impact = col + 1
      const matching = risks.filter((r) => r.likelihood === prob && r.impact === impact).length
      return { prob, impact, score: prob * impact, count: matching }
    })
  }, [risks])

  // Build chart data for the 12 analytics panels
  const riskByType = useMemo(() => {
    const groups: Record<string, number> = {}
    risks.forEach((r: any) => { groups[r.risk_type || 'Unknown'] = (groups[r.risk_type || 'Unknown'] || 0) + 1 })
    return Object.entries(groups).map(([name, value]) => ({ name, value }))
  }, [risks])

  const riskBySOP = useMemo(() => {
    const yes = risks.filter((r: any) => r.is_sop_available === 'Y').length
    const no = risks.length - yes
    return [{ name: 'SOP Available', value: yes }, { name: 'No SOP', value: no }]
  }, [risks])

  const riskByStatus = useMemo(() => {
    const complete = risks.filter((r: any) => r.is_stage_complted === 'Y').length
    const pending = risks.length - complete
    return [{ name: 'Complete', value: complete }, { name: 'Pending', value: pending }]
  }, [risks])

  const riskByProcess = useMemo(() => {
    const groups: Record<string, number> = {}
    risks.forEach((r: any) => {
      const proc = r.process_name || `Process ${r.business_process_uuid || 'N/A'}`
      groups[proc] = (groups[proc] || 0) + 1
    })
    return Object.entries(groups).map(([name, value]) => ({ name: name.substring(0, 20), value }))
  }, [risks])

  const sleDistribution = useMemo(() => {
    const buckets = [
      { range: '0-20K', count: 0 },
      { range: '20K-40K', count: 0 },
      { range: '40K-60K', count: 0 },
      { range: '60K-80K', count: 0 },
      { range: '80K+', count: 0 },
    ]
    risks.forEach((r: any) => {
      const sle = r.inherent_sle || 0
      if (sle <= 20000) buckets[0].count++
      else if (sle <= 40000) buckets[1].count++
      else if (sle <= 60000) buckets[2].count++
      else if (sle <= 80000) buckets[3].count++
      else buckets[4].count++
    })
    return buckets
  }, [risks])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <p className="text-xs text-slate-500">Loading risk analytics...</p>
        </div>
      </div>
    )
  }

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="glass-card rounded-xl p-5 h-[280px] flex flex-col hover:shadow-md transition-shadow">
      <h2 className="text-sm font-bold text-foreground tracking-tight mb-4">{title}</h2>
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>
    </div>
  )

  const EmptyChart = ({ title }: { title: string }) => (
    <div className="glass-card rounded-xl p-5 h-[280px] flex flex-col hover:shadow-md transition-shadow">
      <h2 className="text-sm font-bold text-foreground tracking-tight mb-4">{title}</h2>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs font-medium bg-secondary/30 rounded-lg border border-border/50 border-dashed">
        No Data Available
      </div>
    </div>
  )

  return (
    <div className="flex-1 pb-10 flex flex-col min-h-screen bg-background text-foreground">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 bg-card/60 backdrop-blur-3xl sticky top-0 z-40">
          <div className="px-6 py-5 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Risk Assessments Dashboard</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Comprehensive risk analytics from {risks.length} ADW records</p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-lg shadow-md hover:bg-primary/90 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Export Report
              </button>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <div className="px-6 border-b border-border/40 bg-card/30">
          <TabsList className="h-12 bg-transparent space-x-6 p-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 font-bold uppercase tracking-wider text-xs h-full">Executive Overview</TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 font-bold uppercase tracking-wider text-xs h-full">Risk Register</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 font-bold uppercase tracking-wider text-xs h-full">Deep Analytics</TabsTrigger>
          </TabsList>
        </div>

        <div className="p-6 flex-1">
          <TabsContent value="overview" className="m-0 border-none p-0 outline-none">
            <FadeIn delay={0.2} className="max-w-3xl mx-auto">
              <div className="glass-card rounded-2xl p-8 h-[500px] flex flex-col hover:shadow-xl transition-all relative overflow-hidden group border-border/60">
                <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-30 bg-primary" />
                <div className="mb-8 text-center">
                  <h2 className="text-lg font-black text-foreground tracking-tight uppercase">Risk Impact vs Likelihood</h2>
                  <p className="text-[12px] font-bold text-muted-foreground mt-1 tracking-widest uppercase">5×5 Matrix — {risks.length} Identifications</p>
                </div>
                <div className="flex-1 flex justify-center items-center">
                  <div className="grid grid-cols-5 gap-2 w-full max-w-[400px]">
                  {heatmapData.map((cell, i) => {
                    const isRed = cell.score >= 16
                    const isOrange = cell.score >= 10 && cell.score < 16
                    const isGreen = cell.score < 6
                    const bgClass = isRed ? 'bg-rose-50 border-rose-200 text-rose-800' : 
                                  isOrange ? 'bg-amber-50 border-amber-200 text-amber-800' : 
                                  isGreen ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                  'bg-slate-50 border-slate-200 text-slate-400'
                    return (
                      <div 
                        key={i} 
                        className={`aspect-square rounded border text-xs flex items-center justify-center font-medium ${bgClass}`}
                      >
                        {cell.count || ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </FadeIn>
          </TabsContent>

          <TabsContent value="register" className="m-0 border-none p-0 outline-none">
            <FadeIn delay={0.2}>
              <div className="glass-card rounded-2xl overflow-hidden shadow-md flex flex-col border-border/60">
                <div className="p-6 border-b border-border/50 bg-card/40 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-black text-foreground tracking-tight uppercase">Risk Register</h2>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Found {risks.length} active records</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border/60 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                        <th className="px-5 py-4">Sl No</th>
                        <th className="px-5 py-4">Reference No</th>
                        <th className="px-5 py-4">Risk Statement</th>
                        <th className="px-5 py-4 min-w-[200px]">SLE</th>
                        <th className="px-5 py-4">SOP</th>
                        <th className="px-5 py-4">Date</th>
                        <th className="px-5 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risks.length > 0 ? risks.map((item: any, idx: number) => (
                        <tr key={item.uuid || idx} className="border-b border-border/40 hover:bg-muted/50 transition-colors last:border-0 font-medium">
                          <td className="px-5 py-4 text-muted-foreground text-[11px] font-bold">{idx + 1}</td>
                          <td className="px-5 py-4 font-bold text-foreground">{item.assessment_reference_number || 'N/A'}</td>
                          <td className="px-5 py-4 text-foreground/80">{item.risk_statement || item.process_name || 'N/A'}</td>
                          <td className="px-5 py-4 font-mono tabular-nums text-foreground">₹{(item.inherent_sle || 0).toLocaleString()}</td>
                          <td className="px-5 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                              item.is_sop_available === 'Y' ? "bg-blue-500/10 text-blue-500" : "bg-blue-500/10 text-blue-500"
                            )}>
                              {item.is_sop_available === 'Y' ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono text-muted-foreground text-[11px]">{item.assessment_registered_date?.split('T')[0] || '-'}</td>
                          <td className="px-5 py-4">
                            <span className={cn(
                              "inline-flex items-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest shadow-sm border",
                              item.is_stage_complted === 'Y' 
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20" 
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            )}>
                              {item.is_stage_complted === 'Y' ? 'Complete' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-16 text-center text-slate-400 text-xs font-normal">
                            No assessment records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </FadeIn>
          </TabsContent>

          <TabsContent value="analytics" className="m-0 border-none p-0 outline-none">
            {/* 12 Charts Grid — using real data */}
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" delayChildren={0.1} staggerChildren={0.05}>
              <StaggerItem>
                <ChartCard title="SLE Distribution">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sleDistribution}>
                      <XAxis dataKey="range" style={{ fontSize: '10px' }} tickLine={false} axisLine={false} />
                      <YAxis style={{ fontSize: '10px' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </StaggerItem>
              <StaggerItem>
                <ChartCard title="Risk by SOP Availability">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskBySOP} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {riskBySOP.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </StaggerItem>
              <StaggerItem>
                <ChartCard title="Completion Status">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskByStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {riskByStatus.map((_, i) => <Cell key={i} fill={COLORS[i + 2]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </StaggerItem>
              <StaggerItem>
                <ChartCard title="Risk by Business Process">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskByProcess} layout="vertical">
                      <XAxis type="number" style={{ fontSize: '10px' }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" width={80} style={{ fontSize: '9px' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }} />
                      <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </StaggerItem>
              <StaggerItem>
                <ChartCard title="Risk by Type">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskByType.length > 0 ? riskByType : [{ name: 'All', value: risks.length }]} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {(riskByType.length > 0 ? riskByType : [{ name: 'All' }]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </StaggerItem>
              <StaggerItem><EmptyChart title="Q-O-Q Residual Risk Analysis" /></StaggerItem>
              <StaggerItem><EmptyChart title="Risks by Causal Factors" /></StaggerItem>
              <StaggerItem><EmptyChart title="Risks by Data Sources" /></StaggerItem>
              <StaggerItem><EmptyChart title="Risks by Impact Parties" /></StaggerItem>
              <StaggerItem>
                <ChartCard title="Risks by Category">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskByType.length > 0 ? riskByType : [{ name: 'Uncategorized', value: risks.length }]} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label>
                        {(riskByType.length > 0 ? riskByType : [{ name: 'All' }]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </StaggerItem>
              <StaggerItem><EmptyChart title="Assessments by Approval Status" /></StaggerItem>
              <StaggerItem><EmptyChart title="Assessments by Implementation" /></StaggerItem>
            </StaggerContainer>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
