'use client'

import React, { useState } from 'react'
import { RotateCcw, Send, Star, X, FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth, Role } from '@/components/providers/auth-provider'
import { resetAllDemoStores } from '@/lib/localStore'
import { recordAudit } from '@/lib/auditLog'
import { toast } from 'sonner'

const ROLES_LIST: Array<{ id: string; name: string; role: Role; department: string }> = [
  { id: 'U-001', name: 'Srivatsan B', role: 'Administrator', department: 'Risk Office' },
  { id: 'U-002', name: 'Priya Sharma', role: 'Risk Manager', department: 'Finance' },
  { id: 'U-003', name: 'Anthony Muller', role: 'Assessor', department: 'Operations' },
  { id: 'U-004', name: 'Lin Wei', role: 'Auditor', department: 'Internal Audit' },
  { id: 'U-005', name: 'Karen Diaz', role: 'Viewer', department: 'Compliance' },
]

export function DemoFeedbackWidget() {
  const { user, switchUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'persona' | 'feedback' | 'pack'>('persona')
  
  // Feedback state
  const [rating, setRating] = useState<number>(5)
  const [category, setCategory] = useState<string>('General')
  const [feedbackText, setFeedbackText] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const handlePersonaSwitch = (userId: string) => {
    switchUser(userId)
    const p = ROLES_LIST.find(x => x.id === userId)
    toast.success(`Active role: ${p?.role} (${p?.name})`)
  }

  const handleResetSandbox = () => {
    if (confirm('Reset all demo records back to baseline state?')) {
      resetAllDemoStores()
      recordAudit({
        action: 'SETTINGS_CHANGE',
        entity: 'Sandbox Data Store',
        description: `Reset sandbox data stores to baseline seed`,
        result: 'SUCCESS',
      })
      toast.success('Sandbox data has been reset to baseline state.')
      setTimeout(() => window.location.reload(), 500)
    }
  }

  const handleSubmitFeedback = () => {
    if (!feedbackText.trim()) {
      toast.error('Please enter comments.')
      return
    }
    setIsSubmitting(true)

    recordAudit({
      action: 'CREATE',
      entity: 'Review',
      description: `[${category}] Rating: ${rating}/5 — "${feedbackText.trim()}"`,
      result: 'SUCCESS',
      actor: user || undefined,
    })

    setTimeout(() => {
      setIsSubmitting(false)
      toast.success('Feedback recorded.')
      setFeedbackText('')
      setIsOpen(false)
    }, 300)
  }

  const handleExportRiskPack = () => {
    window.print()
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="h-8 px-3 rounded text-xs bg-white border-slate-300 shadow-sm text-slate-700 hover:bg-slate-50"
        >
          Quick tools
        </Button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-sm bg-white h-full shadow-lg flex flex-col border-l border-slate-200 text-xs">
            {/* Header */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="font-semibold text-slate-900">Evaluation Tools</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setActiveTab('persona')}
                className={`flex-1 py-2 text-center border-b-2 font-medium ${
                  activeTab === 'persona'
                    ? 'border-blue-900 text-blue-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Roles
              </button>
              <button
                onClick={() => setActiveTab('feedback')}
                className={`flex-1 py-2 text-center border-b-2 font-medium ${
                  activeTab === 'feedback'
                    ? 'border-blue-900 text-blue-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Feedback
              </button>
              <button
                onClick={() => setActiveTab('pack')}
                className={`flex-1 py-2 text-center border-b-2 font-medium ${
                  activeTab === 'pack'
                    ? 'border-blue-900 text-blue-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Print view
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'persona' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    {ROLES_LIST.map(p => {
                      const isActive = user?.id === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePersonaSwitch(p.id)}
                          className={`w-full p-2.5 rounded border text-left flex items-center justify-between transition-colors ${
                            isActive
                              ? 'bg-blue-50 border-blue-300 font-medium text-blue-900'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-[11px] text-slate-500">{p.department}</div>
                          </div>
                          <span className="text-[11px] text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">
                            {p.role}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetSandbox}
                      className="w-full text-xs h-8 border-slate-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Reset demo data
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'feedback' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Rating</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-0.5 focus:outline-none"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-slate-500 text-xs ml-2">{rating}/5</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Notes</label>
                    <Textarea
                      placeholder="Enter feedback or observations..."
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      className="text-xs min-h-[90px]"
                    />
                  </div>

                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={isSubmitting}
                    className="w-full h-8 text-xs font-medium bg-blue-900 hover:bg-blue-800 text-white"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Submit
                  </Button>
                </div>
              )}

              {activeTab === 'pack' && (
                <div className="space-y-3">
                  <p className="text-slate-600">
                    Generate a print-ready report containing the current risk matrix, active risk registers, and control summaries.
                  </p>
                  <Button
                    onClick={handleExportRiskPack}
                    className="w-full h-8 text-xs font-medium bg-blue-900 hover:bg-blue-800 text-white"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Print / Save as PDF
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
