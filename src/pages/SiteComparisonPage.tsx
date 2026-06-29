import { useMemo, useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Layers, LayoutGrid } from 'lucide-react'
import type { EChartsOption } from 'echarts'
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
import SiteSelector from '@/components/filters/SiteSelector'
import DateRangePicker from '@/components/filters/DateRangePicker'
import GranularityToggle from '@/components/filters/GranularityToggle'
import MetricPicker from '@/components/filters/MetricPicker'
import LineChart from '@/components/charts/LineChart'
import ExportToolbar from '@/components/export/ExportToolbar'
import { useDataStore } from '@/store/dataStore'
import { useUIStore } from '@/store/uiStore'
import { useTimeSeries } from '@/hooks/useTimeSeries'
import type { TimeSeriesRow } from '@/hooks/useTimeSeries'

const SITE_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#14b8a6', '#a855f7',
]

const METRIC_LABELS: Record<string, string> = {
  ac_power: 'AC Power (W)',
  dc_power: 'DC Power (W)',
  energy_produced: 'Energy (Wh)',
  temperature_f: 'Temperature (°F)',
  ac_voltage: 'AC Voltage (V)',
  ac_frequency: 'AC Frequency (Hz)',
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export default function SiteComparisonPage() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const allSites = useDataStore((s) => s.sites)
  const selectedSites = useUIStore((s) => s.selectedSites)
  const setSelectedSites = useUIStore((s) => s.setSelectedSites)
  const granularity = useUIStore((s) => s.granularity)
  const metric = useUIStore((s) => s.metric)

  const [displayMode, setDisplayMode] = useState<'overlay' | 'sideBySide'>('overlay')

  // Default: select all sites if none selected
  useEffect(() => {
    if (selectedSites.length === 0 && allSites.length > 0) {
      setSelectedSites([...allSites])
    }
  }, [allSites, selectedSites.length, setSelectedSites])

  const { data: tsData, isLoading: tsLoading } = useTimeSeries(
    selectedSites,
    metric,
    granularity
  )

  const { data: voltageData } = useTimeSeries(
    selectedSites,
    'ac_voltage',
    granularity
  )

  const { data: freqData } = useTimeSeries(
    selectedSites,
    'ac_frequency',
    granularity
  )

  // ── Group time series by site ──────────────────────────────────────

  const siteSeriesMap = useMemo(() => {
    if (!tsData) return new Map<string, TimeSeriesRow[]>()
    const map = new Map<string, TimeSeriesRow[]>()
    for (const row of tsData) {
      const list = map.get(row.site_id) ?? []
      list.push(row)
      map.set(row.site_id, list)
    }
    return map
  }, [tsData])

  // ── Summary stats ─────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    return selectedSites.map((siteId, idx) => {
      const rows = siteSeriesMap.get(siteId) ?? []
      const values = rows.map((r) => r.metric_value).filter((v) => v != null)
      const sum = values.reduce((a, b) => a + b, 0)
      const mean = values.length > 0 ? sum / values.length : 0
      const max = values.length > 0 ? Math.max(...values) : 0
      const min = values.length > 0 ? Math.min(...values) : 0
      const variance =
        values.length > 0
          ? values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length
          : 0
      const stdDev = Math.sqrt(variance)
      const totalEnergy = rows.reduce((a, r) => a + r.metric_value, 0)
      return { siteId, mean, max, min, stdDev, totalEnergy, count: values.length, idx }
    })
  }, [selectedSites, siteSeriesMap])

  const bestSite = useMemo(() => {
    if (summaryStats.length === 0) return ''
    return summaryStats.reduce((best, s) =>
      s.totalEnergy > best.totalEnergy ? s : best
    ).siteId
  }, [summaryStats])

  // ── Chart options ─────────────────────────────────────────────────

  const overlayOption = useMemo((): EChartsOption => {
    const buckets = tsData
      ? [...new Set(tsData.map((r) => r.bucket))].sort()
      : []

    const series = selectedSites.map((siteId, idx) => {
      const rows = siteSeriesMap.get(siteId) ?? []
      const dataMap = new Map(rows.map((r) => [r.bucket, r.metric_value]))
      return {
        name: siteId,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        data: buckets.map((b) => dataMap.get(b) ?? null),
        lineStyle: { color: SITE_COLORS[idx % SITE_COLORS.length] },
        itemStyle: { color: SITE_COLORS[idx % SITE_COLORS.length] },
      }
    })

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: { top: 0 },
      grid: { top: 40, right: 20, bottom: 60, left: 60 },
      xAxis: {
        type: 'category',
        data: buckets,
        axisLabel: { rotate: 30, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: METRIC_LABELS[metric] ?? metric,
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 5 }],
      series,
    }
  }, [tsData, selectedSites, siteSeriesMap, metric])

  const sideBySideOptions = useMemo((): EChartsOption[] => {
    const buckets = tsData
      ? [...new Set(tsData.map((r) => r.bucket))].sort()
      : []

    // Find global Y range
    const allValues = tsData?.map((r) => r.metric_value) ?? []
    const yMin = allValues.length > 0 ? Math.min(...allValues) * 0.95 : 0
    const yMax = allValues.length > 0 ? Math.max(...allValues) * 1.05 : 100

    return selectedSites.map((siteId, idx) => {
      const rows = siteSeriesMap.get(siteId) ?? []
      const dataMap = new Map(rows.map((r) => [r.bucket, r.metric_value]))
      return {
        title: { text: siteId, left: 'center', textStyle: { fontSize: 13 } },
        tooltip: { trigger: 'axis' },
        grid: { top: 35, right: 15, bottom: 45, left: 50 },
        xAxis: {
          type: 'category',
          data: buckets,
          axisLabel: { rotate: 30, fontSize: 9 },
        },
        yAxis: { type: 'value', min: yMin, max: yMax },
        dataZoom: [{ type: 'inside' }],
        series: [
          {
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: buckets.map((b) => dataMap.get(b) ?? null),
            lineStyle: { color: SITE_COLORS[idx % SITE_COLORS.length] },
            areaStyle: { color: SITE_COLORS[idx % SITE_COLORS.length] + '20' },
          },
        ],
      } as EChartsOption
    })
  }, [tsData, selectedSites, siteSeriesMap])

  // ── Secondary strips ──────────────────────────────────────────────

  function buildSecondaryOption(
    data: TimeSeriesRow[] | undefined,
    label: string
  ): EChartsOption {
    const buckets = data
      ? [...new Set(data.map((r) => r.bucket))].sort()
      : []
    const grouped = new Map<string, Map<string, number>>()
    if (data) {
      for (const row of data) {
        const m = grouped.get(row.site_id) ?? new Map()
        m.set(row.bucket, row.metric_value)
        grouped.set(row.site_id, m)
      }
    }

    const series = selectedSites.map((siteId, idx) => {
      const dataMap = grouped.get(siteId) ?? new Map()
      return {
        name: siteId,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        data: buckets.map((b) => dataMap.get(b) ?? null),
        lineStyle: { color: SITE_COLORS[idx % SITE_COLORS.length], width: 1.5 },
        itemStyle: { color: SITE_COLORS[idx % SITE_COLORS.length] },
      }
    })

    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { fontSize: 10 } },
      grid: { top: 30, right: 15, bottom: 30, left: 55 },
      xAxis: {
        type: 'category',
        data: buckets,
        axisLabel: { fontSize: 9, rotate: 20 },
      },
      yAxis: { type: 'value', name: label, nameTextStyle: { fontSize: 10 } },
      series,
    }
  }

  if (!isDataLoaded) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Site Comparison</h1>
        <ExportToolbar
          elementId="site-comparison-content"
          filename="compdash-site-comparison"
          data={(summaryStats as unknown as Record<string, unknown>[])}
        />
      </div>

      <div id="site-comparison-content">
      {/* Filter bar */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <SiteSelector
            allSites={allSites}
            selectedSites={selectedSites}
            onChange={setSelectedSites}
          />
          <div className="flex flex-wrap items-center gap-4">
            <DateRangePicker />
            <GranularityToggle />
            <MetricPicker />
            <div className="ml-auto flex gap-1 rounded-lg border p-1">
              <Button
                variant={displayMode === 'overlay' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('overlay')}
              >
                <Layers className="mr-1 h-3.5 w-3.5" />
                Overlay
              </Button>
              <Button
                variant={displayMode === 'sideBySide' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('sideBySide')}
              >
                <LayoutGrid className="mr-1 h-3.5 w-3.5" />
                Side by Side
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats table */}
      {summaryStats.length > 0 && !tsLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Mean</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>Std Dev</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryStats.map((s) => (
                  <TableRow
                    key={s.siteId}
                    className={s.siteId === bestSite ? 'bg-green-50 dark:bg-green-950/30' : ''}
                  >
                    <TableCell className="font-medium">{s.siteId}</TableCell>
                    <TableCell>{s.count.toLocaleString()}</TableCell>
                    <TableCell>{fmt(s.mean)}</TableCell>
                    <TableCell>{fmt(s.max)}</TableCell>
                    <TableCell>{fmt(s.min)}</TableCell>
                    <TableCell>{fmt(s.stdDev)}</TableCell>
                    <TableCell>{fmt(s.totalEnergy)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Main chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {METRIC_LABELS[metric] ?? metric} — {displayMode === 'overlay' ? 'Overlay' : 'Side by Side'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tsLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading chart data…
            </div>
          ) : displayMode === 'overlay' ? (
            <LineChart option={overlayOption} height={420} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sideBySideOptions.map((opt, i) => (
                <LineChart key={selectedSites[i]} option={opt} height={300} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary metric strips */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AC Voltage Stability</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              option={buildSecondaryOption(voltageData, 'AC Voltage (V)')}
              height={220}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AC Frequency Stability</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              option={buildSecondaryOption(freqData, 'AC Frequency (Hz)')}
              height={220}
            />
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
