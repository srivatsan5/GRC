'use client'

import React, { useState, useEffect } from 'react'
import {
  Bell,
  Lock,
  Users,
  Key,
  Globe,
  HardDrive,
  AlertCircle,
  Save,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useAuth, Role } from '@/components/providers/auth-provider'
import { recordAudit } from '@/lib/auditLog'

const tabs = [
  { id: 'general', name: 'Organization', icon: Globe },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'security', name: 'Security & Auth', icon: Lock },
  { id: 'api', name: 'API & Integrations', icon: Key },
  { id: 'data', name: 'Data Retention', icon: HardDrive },
]

const SETTINGS_KEY = 'pericope_settings_v1'

interface OrgSettings {
  orgName: string
  industry: string
  currency: string
  maturityTarget: string
  telemetryRetention: string
  notifications: { critical: boolean; sla: boolean; weekly: boolean }
  security: { mfa: boolean; encryption: string; sessionTimeout: number }
  dataRetention: { auditLog: string; assessment: string; report: string; piiHandling: string }
}

const DEFAULT_SETTINGS: OrgSettings = {
  orgName: 'Acme Financial Services',
  industry: 'Financial Services',
  currency: 'USD',
  maturityTarget: 'Optimized',
  telemetryRetention: '5 Years',
  notifications: { critical: true, sla: true, weekly: false },
  security: { mfa: true, encryption: 'AES-256 GCM', sessionTimeout: 30 },
  dataRetention: { auditLog: '7 Years', assessment: '5 Years', report: '3 Years', piiHandling: 'Pseudonymized' },
}

const INDUSTRIES = ['Financial Services', 'Healthcare', 'Technology', 'Manufacturing', 'Retail', 'Energy & Utilities', 'Telecommunications', 'Public Sector', 'Education', 'Insurance']
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD', 'SGD', 'AED']

export function SettingsPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<OrgSettings>(DEFAULT_SETTINGS)
  const [draft, setDraft] = useState<OrgSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSettings(parsed)
        setDraft(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  const handleSave = async () => {
    if (!hasPermission('admin')) {
      toast({ title: 'Read-only mode', description: 'Only Administrators can modify settings.', variant: 'destructive' })
      return
    }
    setSaving(true)
    await new Promise(r => setTimeout(r, 250))
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(draft))
    setSettings(draft)
    recordAudit({
      action: 'SETTINGS_CHANGE',
      entity: 'Settings',
      description: `Updated platform configuration (${activeTab})`,
      before: settings,
      after: draft,
      result: 'SUCCESS',
    })
    setSaving(false)
    toast({ title: 'Settings saved' })
  }

  const handleReset = () => {
    setDraft(settings)
    toast({ title: 'Changes reverted' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">System Configuration</h1>
          <p className="text-xs text-slate-500">Manage organization parameters, security, and data retention</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasPermission('admin')}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {!hasPermission('admin') && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Read-only view. Only Administrators can save configuration changes.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Tabs */}
        <div className="bg-white rounded border border-slate-200 p-1.5 space-y-0.5">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-left transition-colors font-medium',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 bg-white rounded border border-slate-200 p-5 space-y-5">
          {/* GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Organization profile</h2>
                <p className="text-xs text-slate-500">Corporate parameters and baseline currency</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Organization name</label>
                  <Input
                    value={draft.orgName}
                    onChange={e => setDraft({ ...draft, orgName: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Industry sector</label>
                  <select
                    value={draft.industry}
                    onChange={e => setDraft({ ...draft, industry: e.target.value })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reporting currency</label>
                  <select
                    value={draft.currency}
                    onChange={e => setDraft({ ...draft, currency: e.target.value })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Maturity model</label>
                  <select
                    value={draft.maturityTarget}
                    onChange={e => setDraft({ ...draft, maturityTarget: e.target.value })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {['Initial', 'Developing', 'Defined', 'Managed', 'Optimized'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Email & alert routing</h2>
                <p className="text-xs text-slate-500">Configure operational alert triggers</p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={draft.notifications.critical}
                    onChange={e => setDraft({ ...draft, notifications: { ...draft.notifications, critical: e.target.checked } })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Email alerts immediately when critical risks (score &ge; 16) are identified</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={draft.notifications.sla}
                    onChange={e => setDraft({ ...draft, notifications: { ...draft.notifications, sla: e.target.checked } })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Send reminders 7 days before RCSA assessment deadlines</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={draft.notifications.weekly}
                    onChange={e => setDraft({ ...draft, notifications: { ...draft.notifications, weekly: e.target.checked } })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Weekly executive summary report to risk owners</span>
                </label>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Authentication & session controls</h2>
                <p className="text-xs text-slate-500">Session policies and cryptographic parameters</p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Session timeout (minutes)</label>
                    <Input
                      type="number"
                      value={draft.security.sessionTimeout}
                      onChange={e => setDraft({ ...draft, security: { ...draft.security, sessionTimeout: Number(e.target.value) || 30 } })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Database encryption standard</label>
                    <Input
                      disabled
                      value={draft.security.encryption}
                      className="h-8 text-xs bg-slate-50"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer text-xs pt-2">
                  <input
                    type="checkbox"
                    checked={draft.security.mfa}
                    onChange={e => setDraft({ ...draft, security: { ...draft.security, mfa: e.target.checked } })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Require two-factor authentication (2FA) for all Administrator roles</span>
                </label>
              </div>
            </div>
          )}

          {/* API */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">API & webhooks</h2>
                <p className="text-xs text-slate-500">Backend connectivity and integration tokens</p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Backend API Base URL</label>
                  <Input
                    disabled
                    value={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}
                    className="h-8 text-xs bg-slate-50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Audit webhook destination</label>
                  <Input
                    placeholder="https://api.company.com/webhook/grc-events"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DATA RETENTION */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Data retention & archival</h2>
                <p className="text-xs text-slate-500">Compliance retention windows per regulation</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Audit log retention</label>
                  <select
                    value={draft.dataRetention.auditLog}
                    onChange={e => setDraft({ ...draft, dataRetention: { ...draft.dataRetention, auditLog: e.target.value } })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {['3 Years', '5 Years', '7 Years (SOX)', '10 Years', 'Indefinite'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assessment cycles retention</label>
                  <select
                    value={draft.dataRetention.assessment}
                    onChange={e => setDraft({ ...draft, dataRetention: { ...draft.dataRetention, assessment: e.target.value } })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {['1 Year', '3 Years', '5 Years', '7 Years'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
