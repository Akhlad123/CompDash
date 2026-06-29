import { useMemo, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  MapPin,
  Cpu,
  Zap,
  CalendarDays,
  ArrowUpDown,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import KPICard from '@/components/layout/KPICard'
import DateRangePicker from '@/components/filters/DateRangePicker'
import GranularityToggle from '@/components/filters/GranularityToggle'
import ExportToolbar from '@/components/export/ExportToolbar'
import { useDataStore } from '@/store/dataStore'
import { useUIStore } from '@/store/uiStore'
import { useKPITotals } from '@/hooks/useKPITotals'
import { useSiteStats } from '@/hooks/useSiteStats'
import { useDailySiteEnergy } from '@/hooks/useDailySiteEnergy'
import type { SiteSummaryRow } from '@/hooks/useSiteStats'

echarts.use([LineChart, GridComponent, CanvasRenderer])

type SortKey = keyof Pick<
  SiteSummaryRow,
  | 'site_id'
  | 'inverter_count'
  | 'total_energy'
  | 'avg_ac_power'
  | 'avg_dc_power'
  | 'avg_temperature'
>

function formatEnergy(wh: number): string {
  const kwh = wh / 1000
  if (kwh >= 1_000_000) return `${(kwh / 1_000_000).toFixed(1)} GWh`
  if (kwh >= 1_000) return `${(kwh / 1_000).toFixed(1)} MWh`
  return `${kwh.toFixed(1)} kWh`
}

function formatNum(n: number, decimals = 1): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const setSelectedSites = useUIStore((s) => s.setSelectedSites)

  const { data: kpi, isLoading: kpiLoading } = useKPITotals()
  const { data: sites, isLoading: sitesLoading } = useSiteStats()
  const { data: dailyEnergy } = useDailySiteEnergy()

  const [sortKey, setSortKey] = useState<SortKey>('site_id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey]
  )

  const sortedSites = useMemo(() => {
    if (!sites) return []
    const sorted = [...sites]
    sorted.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      const diff = (aVal as number) - (bVal as number)
      return sortDir === 'asc' ? diff : -diff
    })
    return sorted
  }, [sites, sortKey, sortDir])

  const sparklineMap = useMemo(() => {
    if (!dailyEnergy) return new Map<string, number[]>()
    const grouped = new Map<string, { date: string; energy: number }[]>()
    for (const row of dailyEnergy) {
      const list = grouped.get(row.site_id) ?? []
      list.push({ date: row.date, energy: row.daily_energy })
      grouped.set(row.site_id, list)
    }
    const result = new Map<string, number[]>()
    for (const [siteId, rows] of grouped) {
      const sorted = rows.sort((a, b) => a.date.localeCompare(b.date))
      const last7 = sorted.slice(-7)
      result.set(siteId, last7.map((r) => r.energy / 1000))
    }
    return result
  }, [dailyEnergy])

  if (!isDataLoaded) {
    return <Navigate to="/" replace />
  }

  const loading = kpiLoading || sitesLoading

  const SortHeader = ({
    label,
    field,
  }: {
    label: string
    field: SortKey
  }) => (
    <TableHead
      className="cursor-pointer select-none"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <ExportToolbar
          elementId="overview-content"
          filename="compdash-overview"
          data={(sortedSites as unknown as Record<string, unknown>[])}
        />
      </div>

      <div id="overview-content">
      {/* KPI Cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading KPIs…
        </div>
      ) : kpi ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            icon={MapPin}
            label="Total Sites"
            value={String(kpi.total_sites)}
          />
          <KPICard
            icon={Cpu}
            label="Total Microinverters"
            value={String(kpi.total_inverters)}
          />
          <KPICard
            icon={Zap}
            label="Total Energy Produced"
            value={formatEnergy(kpi.total_energy)}
          />
          <KPICard
            icon={CalendarDays}
            label="Date Range"
            value={
              kpi.date_from && kpi.date_to
                ? `${format(new Date(kpi.date_from), 'MMM d, yyyy')} — ${format(new Date(kpi.date_to), 'MMM d, yyyy')}`
                : 'N/A'
            }
          />
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 rounded-lg border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <DateRangePicker />
        <div className="ml-auto">
          <GranularityToggle />
        </div>
      </div>

      {/* Site Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Site Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {sitesLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sites…
            </div>
          ) : sortedSites.length === 0 ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              No site data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Site ID" field="site_id" />
                    <SortHeader label="# Inverters" field="inverter_count" />
                    <SortHeader label="Total Energy (kWh)" field="total_energy" />
                    <SortHeader label="Avg AC Power (W)" field="avg_ac_power" />
                    <SortHeader label="Avg DC Power (W)" field="avg_dc_power" />
                    <SortHeader label="Avg Temp (°F)" field="avg_temperature" />
                    <TableHead>7-Day Sparkline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSites.map((site) => (
                    <TableRow
                      key={site.site_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedSites([site.site_id])
                        navigate('/sites')
                      }}
                    >
                      <TableCell className="font-medium">
                        {site.site_id}
                      </TableCell>
                      <TableCell>{site.inverter_count}</TableCell>
                      <TableCell>
                        {formatNum(site.total_energy / 1000)}
                      </TableCell>
                      <TableCell>{formatNum(site.avg_ac_power)}</TableCell>
                      <TableCell>{formatNum(site.avg_dc_power)}</TableCell>
                      <TableCell>{formatNum(site.avg_temperature)}</TableCell>
                      <TableCell>
                        <Sparkline
                          data={sparklineMap.get(site.site_id) ?? []}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate('/sites')}>
          Compare Sites
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => navigate('/anomaly')}>
          Detect Anomalies
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const option = {
    grid: { top: 2, right: 2, bottom: 2, left: 2 },
    xAxis: { type: 'category' as const, show: false },
    yAxis: { type: 'value' as const, show: false },
    series: [
      {
        type: 'line' as const,
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: 'hsl(var(--primary))' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'hsl(var(--primary) / 0.3)' },
            { offset: 1, color: 'hsl(var(--primary) / 0.05)' },
          ]),
        },
      },
    ],
    tooltip: { show: false },
  }

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ width: 100, height: 40 }}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
    />
  )
}
