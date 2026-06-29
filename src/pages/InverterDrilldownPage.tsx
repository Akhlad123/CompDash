import { useMemo, useState, useCallback, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import DateRangePicker from '@/components/filters/DateRangePicker'
import MetricPicker from '@/components/filters/MetricPicker'
import InverterSelector from '@/components/filters/InverterSelector'
import LineChart from '@/components/charts/LineChart'
import BarChart from '@/components/charts/BarChart'
import ExportToolbar from '@/components/export/ExportToolbar'
import { useDataStore } from '@/store/dataStore'
import { useUIStore } from '@/store/uiStore'
import { useInverterStats } from '@/hooks/useInverterStats'
import { useTimeSeries } from '@/hooks/useTimeSeries'
import type { InverterStatsWithZ, InverterStatus } from '@/hooks/useInverterStats'

const STATUS_COLORS: Record<InverterStatus, string> = {
  normal: '#22c55e',
  warning: '#f59e0b',
  alert: '#ef4444',
}

const STATUS_VARIANTS: Record<InverterStatus, 'default' | 'secondary' | 'destructive'> = {
  normal: 'default',
  warning: 'secondary',
  alert: 'destructive',
}

type SortKey = keyof Pick<
  InverterStatsWithZ,
  | 'serial_number'
  | 'total_energy'
  | 'avg_ac_power'
  | 'avg_dc_power'
  | 'avg_temperature'
  | 'row_count'
  | 'z_score'
>

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

const OVERLAY_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b']

export default function InverterDrilldownPage() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const allSites = useDataStore((s) => s.sites)
  const granularity = useUIStore((s) => s.granularity)
  const metric = useUIStore((s) => s.metric)

  const [siteId, setSiteId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('total_energy')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null)
  const [compareSerials, setCompareSerials] = useState<string[]>([])

  // Default site
  useEffect(() => {
    if (!siteId && allSites.length > 0) {
      setSiteId(allSites[0])
    }
  }, [allSites, siteId])

  const { data: stats, isLoading } = useInverterStats(siteId)

  // Filter + sort
  const filtered = useMemo(() => {
    if (!stats) return []
    const term = searchTerm.toLowerCase()
    return stats.filter((r) => {
      if (!term) return true
      return (
        r.serial_number.toLowerCase().includes(term) ||
        (r.sku_name?.toLowerCase().includes(term) ?? false)
      )
    })
  }, [stats, searchTerm])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const aNum = typeof aVal === 'number' ? aVal : 0
      const bNum = typeof bVal === 'number' ? bVal : 0
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })
    return rows
  }, [filtered, sortKey, sortDir])

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else { setSortKey(key); setSortDir('desc') }
    },
    [sortKey]
  )

  // Bar chart
  const barOption = useMemo((): EChartsOption => {
    const ranked = [...filtered].sort((a, b) => b.total_energy - a.total_energy)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 10, right: 20, bottom: 40, left: 120 },
      xAxis: { type: 'value', name: 'Energy (kWh)' },
      yAxis: {
        type: 'category',
        data: ranked.map((r) => r.serial_number),
        inverse: true,
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: ranked.map((r) => ({
            value: r.total_energy / 1000,
            itemStyle: {
              color:
                r.serial_number === selectedSerial
                  ? '#2563eb'
                  : STATUS_COLORS[r.status],
              borderColor:
                r.serial_number === selectedSerial ? '#1d4ed8' : undefined,
              borderWidth: r.serial_number === selectedSerial ? 2 : 0,
            },
          })),
        },
      ],
    }
  }, [filtered, selectedSerial])

  const barEvents = useMemo(
    () => ({
      click: (params: Record<string, unknown>) => {
        const name = params['name'] as string | undefined
        if (name) {
          setSelectedSerial(name)
          setCompareSerials([name])
        }
      },
    }),
    []
  )

  // Detail panel: time series for selected inverters
  const activeSerials = useMemo(() => {
    if (compareSerials.length > 0) return compareSerials
    if (selectedSerial) return [selectedSerial]
    return []
  }, [compareSerials, selectedSerial])

  const { data: tsData, isLoading: tsLoading } = useTimeSeries(
    siteId ? [siteId] : [],
    metric,
    granularity,
    activeSerials
  )

  const detailChartOption = useMemo((): EChartsOption => {
    if (!tsData) return {}
    const buckets = [...new Set(tsData.map((r) => r.bucket))].sort()
    const grouped = new Map<string, Map<string, number>>()
    for (const row of tsData) {
      const m = grouped.get(row.serial_number) ?? new Map()
      m.set(row.bucket, row.metric_value)
      grouped.set(row.serial_number, m)
    }

    const series = activeSerials.map((serial, idx) => {
      const dataMap = grouped.get(serial) ?? new Map()
      return {
        name: serial,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        data: buckets.map((b) => dataMap.get(b) ?? null),
        lineStyle: { color: OVERLAY_COLORS[idx % OVERLAY_COLORS.length] },
        itemStyle: { color: OVERLAY_COLORS[idx % OVERLAY_COLORS.length] },
      }
    })

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { top: 0 },
      grid: { top: 35, right: 20, bottom: 50, left: 55 },
      xAxis: {
        type: 'category',
        data: buckets,
        axisLabel: { rotate: 30, fontSize: 10 },
      },
      yAxis: { type: 'value' },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 5 }],
      series,
    }
  }, [tsData, activeSerials])

  // Selected inverter info
  const selectedInfo = useMemo(
    () => stats?.find((r) => r.serial_number === selectedSerial) ?? null,
    [stats, selectedSerial]
  )

  const siteSerials = useMemo(
    () => filtered.map((r) => r.serial_number),
    [filtered]
  )

  if (!isDataLoaded) {
    return <Navigate to="/" replace />
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      {label}
      {sortKey === field && (
        <span className="ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </TableHead>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Inverter Drilldown</h1>
        <ExportToolbar
          elementId="inverter-drilldown-content"
          filename="compdash-inverter-drilldown"
          data={(sorted as unknown as Record<string, unknown>[])}
        />
      </div>

      <div id="inverter-drilldown-content">
      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <Select
            value={siteId}
            onValueChange={(v) => {
              if (v) {
                setSiteId(v)
                setSelectedSerial(null)
                setCompareSerials([])
              }
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {allSites.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangePicker />

          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search serial / SKU…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table + Bar chart side by side */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Table */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Inverter Summary — {siteId}
              {filtered.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filtered.length} inverters)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader label="Serial Number" field="serial_number" />
                      <TableHead>SKU</TableHead>
                      <SortHeader label="Energy (kWh)" field="total_energy" />
                      <SortHeader label="AC Power (W)" field="avg_ac_power" />
                      <SortHeader label="DC Power (W)" field="avg_dc_power" />
                      <SortHeader label="Temp (°F)" field="avg_temperature" />
                      <SortHeader label="Readings" field="row_count" />
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((inv) => (
                      <TableRow
                        key={inv.serial_number}
                        className={`cursor-pointer ${
                          inv.serial_number === selectedSerial
                            ? 'bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setSelectedSerial(inv.serial_number)
                          setCompareSerials([inv.serial_number])
                        }}
                      >
                        <TableCell className="font-mono text-xs">
                          {inv.serial_number}
                        </TableCell>
                        <TableCell className="text-xs">
                          {inv.sku_name ?? '—'}
                        </TableCell>
                        <TableCell>{fmt(inv.total_energy / 1000)}</TableCell>
                        <TableCell>{fmt(inv.avg_ac_power)}</TableCell>
                        <TableCell>{fmt(inv.avg_dc_power)}</TableCell>
                        <TableCell>{fmt(inv.avg_temperature)}</TableCell>
                        <TableCell>{inv.row_count.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[inv.status]}>
                            {inv.status === 'normal'
                              ? 'Normal'
                              : inv.status === 'warning'
                                ? 'Warning'
                                : 'Alert'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Energy per Inverter</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length > 0 ? (
              <BarChart
                option={barOption}
                height={Math.max(300, filtered.length * 28)}
                onEvents={barEvents}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No data
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail panel */}
      {selectedSerial && selectedInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="font-mono">{selectedInfo.serial_number}</span>
              {selectedInfo.sku_name && (
                <Badge variant="secondary">{selectedInfo.sku_name}</Badge>
              )}
              <span className="text-sm font-normal text-muted-foreground">
                Site: {selectedInfo.site_id}
              </span>
              <Badge variant={STATUS_VARIANTS[selectedInfo.status]} className="ml-auto">
                Z-score: {selectedInfo.z_score.toFixed(2)} · {selectedInfo.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <MetricPicker />
              <InverterSelector
                serials={siteSerials}
                selected={compareSerials}
                onChange={setCompareSerials}
                maxSelect={4}
              />
            </div>

            {tsLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <LineChart option={detailChartOption} height={380} />
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedSerial(null)
                setCompareSerials([])
              }}
            >
              Close Detail
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}
