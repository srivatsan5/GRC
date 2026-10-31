'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { oracleService } from '@/lib/oracleService'

export function MitigationActiveRisksPage() {
  const router = useRouter()

  const { data: activeRisks = [], isLoading } = useQuery({
    queryKey: ['active-risks'],
    queryFn: async () => {
      const [risks, controls] = await Promise.all([
        oracleService.getIdentifyRisks(),
        oracleService.getControlImplementations(),
      ])
      
      // Group risks by name and department
      const riskMap = new Map()
      
      risks.forEach((risk: any) => {
        const riskId = risk.uuid || risk.id
        const riskName = risk.risk_statement || risk.process_name || `Risk ${String(riskId).slice(0, 8)}`
        const key = `${riskId}-${risk.process_name || 'Unknown'}`
        const existing = riskMap.get(key)
        
        if (existing) {
          existing.controlCount = controls.filter((c: any) => c.risk_uuid === riskId).length
        } else {
          riskMap.set(key, {
            id: riskId,
            riskName: riskName,
            department: risk.process_name || risk.sub_process_name || 'Corporate',
            controlCount: controls.filter((c: any) => c.risk_uuid === riskId).length,
          })
        }
      })
      
      return Array.from(riskMap.values())
    },
  })

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">3.3 Risk Mitigation</h1>
          <p className="text-sm text-muted-foreground mt-1">Active Risks</p>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-4 font-medium">Risk Name</th>
                <th className="text-left p-4 font-medium">Control Count</th>
                <th className="text-left p-4 font-medium">Department</th>
                <th className="text-right p-4 font-medium">View Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : (
                activeRisks.map((risk: any, index: number) => (
                  <tr key={risk.uuid || risk.id || `risk-${index}`} className="border-t">
                    <td className="p-4">{risk.riskName}</td>
                    <td className="p-4">{risk.controlCount}</td>
                    <td className="p-4">{risk.department}</td>
                    <td className="p-4 text-right">
                      <Button 
                        size="sm" 
                        className="transition-all duration-200 hover:scale-105 active:scale-95"
                        onClick={() => router.push(`/rcsa/mitigation/${risk.uuid || risk.id || `risk-${index}`}`)}
                      >
                        View Details <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
              {!isLoading && activeRisks.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No active risks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
