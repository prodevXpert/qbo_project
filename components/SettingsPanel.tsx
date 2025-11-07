'use client'

import { useState, useEffect } from 'react'
import { ProcessingSettings } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface SettingsPanelProps {
  onSettingsChange: (settings: ProcessingSettings) => void
}

export function SettingsPanel({ onSettingsChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<ProcessingSettings>({
    autoCreate: true,
    alsoAttachToInvoice: false,
    fromBillableExpenses: true,
    defaultCurrency: 'USD',
    strictDateParsing: false,
    environment: 'sandbox',
  })

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem('processingSettings')
    if (saved) {
      try {
        const savedSettings = JSON.parse(saved)
        setSettings(savedSettings)
        onSettingsChange(savedSettings)
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    } else {
      onSettingsChange(settings)
    }
  }, [])

  const updateSetting = <K extends keyof ProcessingSettings>(
    key: K,
    value: ProcessingSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    onSettingsChange(newSettings)
    localStorage.setItem('processingSettings', JSON.stringify(newSettings))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Processing Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Auto-create missing entities
          </label>
          <input
            type="checkbox"
            checked={settings.autoCreate}
            onChange={(e) => updateSetting('autoCreate', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Attach files to Invoice (in addition to Bill)
          </label>
          <input
            type="checkbox"
            checked={settings.alsoAttachToInvoice}
            onChange={(e) => updateSetting('alsoAttachToInvoice', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Create Invoice from billable expenses
          </label>
          <input
            type="checkbox"
            checked={settings.fromBillableExpenses}
            onChange={(e) => updateSetting('fromBillableExpenses', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Strict date parsing
          </label>
          <input
            type="checkbox"
            checked={settings.strictDateParsing}
            onChange={(e) => updateSetting('strictDateParsing', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Default Currency
          </label>
          <select
            value={settings.defaultCurrency}
            onChange={(e) => updateSetting('defaultCurrency', e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600">
            Settings are automatically saved and will persist across sessions.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

