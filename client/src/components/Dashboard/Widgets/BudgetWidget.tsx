import React, { useEffect, useState } from 'react'
import { DollarSign, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { budgetApi } from '../../../api/client'
import LiquidGlass from '../LiquidGlass'

interface BudgetItem {
  id: number
  category: string
  name: string
  total_price: number
  currency?: string
}

interface BudgetWidgetProps {
  tripId: number
  dark?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f87060',
  Transport: '#60a5fa',
  Accommodation: '#a78bfa',
  Activities: '#34d399',
  Shopping: '#fbbf24',
  Other: '#94a3b8',
}

const CATEGORY_ICONS: Record<string, string> = {
  Food: '🍜',
  Transport: '✈️',
  Accommodation: '🏨',
  Activities: '🎯',
  Shopping: '🛍️',
  Other: '💼',
}

function getCategoryColor(cat: string): string {
  const key = Object.keys(CATEGORY_COLORS).find(k => cat.toLowerCase().includes(k.toLowerCase()))
  return key ? CATEGORY_COLORS[key] : '#94a3b8'
}

function getCategoryIcon(cat: string): string {
  const key = Object.keys(CATEGORY_ICONS).find(k => cat.toLowerCase().includes(k.toLowerCase()))
  return key ? CATEGORY_ICONS[key] : '💼'
}

const STORAGE_KEY = 'widget_budget_collapsed'

export default function BudgetWidget({ tripId, dark = false }: BudgetWidgetProps) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
  }

  const fetchBudget = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await budgetApi.list(tripId)
      setItems(data.items || [])
    } catch {
      setError('Failed to load budget')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBudget() }, [tripId])

  // Aggregate by category
  const byCategory = items.reduce<Record<string, number>>((acc, item) => {
    const cat = item.category || 'Other'
    acc[cat] = (acc[cat] || 0) + (item.total_price || 0)
    return acc
  }, {})

  const total = Object.values(byCategory).reduce((a, b) => a + b, 0)
  const allSorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a)
  const sorted = allSorted.slice(0, 4)
  const extraCount = allSorted.length - 4

  return (
    <LiquidGlass
      dark={dark}
      style={{
        borderRadius: 16,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
      }}
    >
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: collapsed ? 0 : 12 }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #34d399 0%, #6ee7b7 100%)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>💰 Budget</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); fetchBudget() }}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-faint)' }}
              title="Refresh"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapsed() }}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-faint)' }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Collapsible content */}
        <div style={{
          overflow: 'hidden',
          maxHeight: collapsed ? 0 : 400,
          opacity: collapsed ? 0 : 1,
          transition: 'max-height 0.3s ease, opacity 0.2s ease',
        }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="trek-skeleton" style={{ height: 14, borderRadius: 6, width: i === 1 ? '80%' : i === 2 ? '60%' : '70%' }} />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="text-center" style={{ padding: '16px 0' }}>
              <DollarSign size={20} className="mx-auto mb-1.5 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>No budget data</p>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center" style={{ padding: '16px 0' }}>
              <DollarSign size={20} className="mx-auto mb-1.5 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>No expenses tracked yet</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              {/* Total */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
                <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  total · {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Category breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map(([cat, amount]) => {
                  const pct = total > 0 ? Math.round((amount / total) * 100) : 0
                  const color = getCategoryColor(cat)
                  const icon = getCategoryIcon(cat)
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{icon}</span>
                          <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            {amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          <span
                            className="text-[10px] font-medium"
                            style={{
                              color: 'var(--text-faint)',
                              background: 'var(--bg-secondary)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 5, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 4,
                            width: `${pct}%`,
                            background: color,
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {extraCount > 0 && (
                <p className="text-[11px]" style={{ color: 'var(--text-faint)', marginTop: 8 }}>
                  +{extraCount} more {extraCount === 1 ? 'category' : 'categories'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </LiquidGlass>
  )
}
