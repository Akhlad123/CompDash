import { useState, useCallback } from 'react'
import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/store/dataStore'
import type { DateRange } from '@/store/dataStore'

export default function DateRangePicker() {
  const dateRange = useDataStore((s) => s.dateRange)
  const setDateRange = useDataStore((s) => s.setDateRange)

  const [fromStr, setFromStr] = useState(
    dateRange ? format(dateRange.from, 'yyyy-MM-dd') : ''
  )
  const [toStr, setToStr] = useState(
    dateRange ? format(dateRange.to, 'yyyy-MM-dd') : ''
  )

  const handleApply = useCallback(() => {
    if (!fromStr || !toStr) return
    const from = new Date(fromStr)
    const to = new Date(toStr)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return
    const range: DateRange = { from, to }
    setDateRange(range)
  }, [fromStr, toStr, setDateRange])

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-muted-foreground" />
      <input
        type="date"
        value={fromStr}
        onChange={(e) => setFromStr(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
      />
      <span className="text-sm text-muted-foreground">—</span>
      <input
        type="date"
        value={toStr}
        onChange={(e) => setToStr(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
      />
      <Button variant="outline" size="sm" onClick={handleApply}>
        Apply
      </Button>
    </div>
  )
}
