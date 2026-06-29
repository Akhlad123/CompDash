import { useMemo, useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, ChevronDown, ChevronRight, Info, MapPin, Cpu } from 'lucide-react'
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
import SiteSelector from '@/components/filters/SiteSelector'
import InverterSelector from '@/components/filters/InverterSelector'
import DateRangePicker from '@/components/filters/DateRangePicker'
import GranularityToggle from '@/components/filters/GranularityToggle'
import MetricPicker from '@/components/filters/MetricPicker'
import LineChart from '@/components/charts/LineChart'
import ExportToolbar from '@/components/export/ExportToolbar'
import { useDataStore } from '@/store/dataStore'
import { useUIStore } from '@/store/uiStore'
import { useTimeSeries } from '@/hooks/useTimeSeries'
import type { TimeSeriesRow } from '@/hooks/useTimeSeries'

type AnalysisMode = 'site' | 'inverter'

const SERIES_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
]

const METRIC_UNITS: Record<string, string> = {
  ac_power: 'W',
  dc_power: 'W',
  energy_produced: 'Wh',
  temperature_f: '°F',
  ac_voltage: 'V',
  ac_frequency: 'Hz',
  dc_current: 'A',
  dc_voltage: 'V',
}

const METRIC_LABELS: Record<string, string> = {
  ac_power: 'AC Power',
  dc_power: 'DC Power',
  energy_produced: 'Energy Produced',
  temperature_f: 'Temperature',
  ac_voltage: 'AC Voltage',
  ac_frequency: 'AC Frequency',
  dc_current: 'DC Current',
  dc_voltage: 'DC Voltage',
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function TimeSeriesPage() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const allSites = useDataStore((s) => s.sites)
  const allInverters = useDataStore((s) => s.inverters)

  const selectedSites = useUIStore((s) => s.selectedSites)
  const setSelectedSites = useUIStore((s) => s.setSelectedSites)
  const granularity = useUIStore((s) => s.granularity)
  const metric = useUIStore((s) => s.metric)

  const [mode, setMode] = useState<AnalysisMode>('site')
  const [invSiteId, setInvSiteId] = useState('')
  const [selectedInverters, setSelectedInverters] = useState<string[]>([])
  const [statsOpen, setStatsOpen] = useState(true)

  // Defaults
  useEffect(() => {
    if (mode === 'site' && selectedSites.length === 0 && allSites.length > 0) {
      setSelectedSites([...allSites])
    }
  }, [mode, allSites, selectedSites.length, setSelectedSites])

  useEffect(() => {
    if (mode === 'inverter' && !invSiteId && allSites.length > 0) {
      setInvSiteId(allSites[0])
    }
  }, [mode, allSites, invSiteId])

  // Inverters for selected site
  const siteInverterSerials = useMemo(
    () =>
      allInverters
        .filter((i) => i.site_id === invSiteId)
        .map((i) => i.serial_number),
    [allInverters, invSiteId]
  )

  // Query params
  const querySites = mode === 'site' ? selectedSites : invSiteId ? [invSiteId] : []
  const queryInverters = mode === 'inverter' ? selectedInverters : []

  const { data: tsData, isLoading } = useTimeSeries(
    querySites,
    metric,
    granularity,
    queryInverters
  )

  // Detect granularity from data
  const detectedGranularity = useMemo(() => {
    if (!tsData || tsData.length < 2) return null
    const buckets = [...new Set(tsData.map((r) => r.bucket))].sort()
    if (buckets.length < 2) return null
    const d1 = new Date(buckets[0]).getTime()
    const d2 = new Date(buckets[1]).getTime()
    const diffMin = (d2 - d1) / 60_000
    if (diffMin <= 5) return '5-min'
    if (diffMin <= 15) return '15-min'
    if (diffMin <= 60) return 'hourly'
    return 'daily+'
  }, [tsData])

  // Group by entity
  const entityKey = mode === 'site' ? 'site_id' : 'serial_number'
  const entities = useMemo(() => {
    if (!tsData) return [] as string[]
    return [...new Set(tsData.map((r) => r[entityKey]))]
  }, [tsData, entityKey])

  const entitySeriesMap = useMemo(() => {
    if (!tsData) return new Map<string, TimeSeriesRow[]>()
    const map = new Map<string, TimeSeriesRow[]>()
    for (const row of tsData) {
      const key = row[entityKey]
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [tsData, entityKey])

  // Stats
  const stats = useMemo(() => {
    return entities.map((entity) => {
      const rows = entitySeriesMap.get(entity) ?? []
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
      return { entity, mean, max, min, stdDev, sum, count: values.length }
    })
  }, [entities, entitySeriesMap])

  // Chart option
  const chartOption = useMemo((): EChartsOption => {
    const buckets = tsData
      ? [...new Set(tsData.map((r) => r.bucket))].sort()
      : []

    const unit = METRIC_UNITS[metric] ?? ''
    const label = METRIC_LABELS[metric] ?? metric

    const series = entities.map((entity, idx) => {
      const rows = entitySeriesMap.get(entity) ?? []
      const dataMap = new Map(rows.map((r) => [r.bucket, r.metric_value]))
      const values = rows.map((r) => r.metric_value)
      const mean =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0

      return {
        name: entity,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        data: buckets.map((b) => dataMap.get(b) ?? null),
        lineStyle: { color: SERIES_COLORS[idx % SERIES_COLORS.length] },
        itemStyle: { color: SERIES_COLORS[idx % SERIES_COLORS.length] },
        markLine: {
          silent: true,
          data: [
            {
              yAxis: mean,
              lineStyle: {
                color: SERIES_COLORS[idx % SERIES_COLORS.length],
                type: 'dashed' as const,
                width: 1,
                opacity: 0.6,
              },
              label: {
                formatter: `μ ${fmt(mean)}`,
                fontSize: 9,
              },
            },
          ],
        },
      }
    })

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: { top: 0 },
      grid: { top: 40, right: 20, bottom: 70, left: 65 },
      xAxis: {
        type: 'category',
        data: buckets,
        axisLabel: { rotate: 30, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: `${label} (${unit})`,
        nameTextStyle: { fontSize: 11 },
      },
      dataZoom: [
        { type: 'inside' },
        { type: 'slider', bottom: 5, height: 25 },
      ],
      series,
    }
  }, [tsData, entities, entitySeriesMap, metric])

  if (!isDataLoaded) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Time Series</h1>
        <ExportToolbar
          elementId="timeseries-content"
          filename="compdash-timeseries"
          data={(stats as unknown as Record<string, unknown>[])}
        />
      </div>

      <div id="timeseries-content">
      {/* Filter bar */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Mode + entity selectors */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex gap-1 rounded-lg border p-1">
              <Button
                variant={mode === 'site' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('site')}
              >
                <MapPin className="mr-1 h-3.5 w-3.5" />
                By Site
              </Button>
              <Button
                variant={mode === 'inverter' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('inverter')}
              >
                <Cpu className="mr-1 h-3.5 w-3.5" />
                By Inverter
              </Button>
            </div>

            {mode === 'site' ? (
              <SiteSelector
                allSites={allSites}
                selectedSites={selectedSites}
                onChange={setSelectedSites}
              />
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                <Select
                  value={invSiteId}
                  onValueChange={(v) => {
                    if (v) {
                      setInvSiteId(v)
                      setSelectedInverters([])
                    }
                  }}
                >
                  <SelectTrigger className="w-44">
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
                <InverterSelector
                  serials={siteInverterSerials}
                  selected={selectedInverters}
                  onChange={setSelectedInverters}
                  maxSelect={8}
                />
              </div>
            )}
          </div>

          {/* Other filters */}
          <div className="flex flex-wrap items-center gap-4">
            <DateRangePicker />
            <GranularityToggle />
            <MetricPicker />
            {detectedGranularity && (
              <Badge variant="secondary" className="gap-1">
                <Info className="h-3 w-3" />
                Detected: {detectedGranularity}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {METRIC_LABELS[metric] ?? metric} — {mode === 'site' ? 'By Site' : 'By Inverter'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading time series…
            </div>
          ) : entities.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {mode === 'inverter'
                ? 'Select at least one inverter above.'
                : 'No data for the selected sites.'}
            </p>
          ) : (
            <LineChart option={chartOption} height={440} />
          )}
        </CardContent>
      </Card>

      {/* Collapsible stats panel */}
      {stats.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setStatsOpen((o) => !o)}
          >
            <CardTitle className="flex items-center gap-2 text-base">
              {statsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Statistics
            </CardTitle>
          </CardHeader>
          {statsOpen && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{mode === 'site' ? 'Site' : 'Inverter'}</TableHead>
                    <TableHead>Samples</TableHead>
                    <TableHead>Mean</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Std Dev</TableHead>
                    <TableHead>Total / Sum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s) => (
                    <TableRow key={s.entity}>
                      <TableCell className="font-medium">{s.entity}</TableCell>
                      <TableCell>{s.count.toLocaleString()}</TableCell>
                      <TableCell>{fmt(s.mean)}</TableCell>
                      <TableCell>{fmt(s.max)}</TableCell>
                      <TableCell>{fmt(s.min)}</TableCell>
                      <TableCell>{fmt(s.stdDev)}</TableCell>
                      <TableCell>{fmt(s.sum)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}
      </div>
    </div>
  )
}
