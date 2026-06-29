import { useQuery } from '@tanstack/react-query'
import { query } from '@/lib/duckdb'
import { buildTimeseriesQuery } from '@/lib/queries'
import type { MetricKey, Granularity } from '@/lib/queries'
import { useDataStore } from '@/store/dataStore'

export interface TimeSeriesRow {
  bucket: string
  site_id: string
  serial_number: string
  metric_value: number
  sample_count: number
}

export function useTimeSeries(
  siteIds: string[],
  metric: MetricKey,
  granularity: Granularity,
  inverterIds: string[] = []
) {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)

  return useQuery<TimeSeriesRow[]>({
    queryKey: ['timeseries', metric, granularity, siteIds, inverterIds],
    queryFn: () => {
      const sql = buildTimeseriesQuery(metric, granularity, siteIds, inverterIds)
      return query<TimeSeriesRow>(sql)
    },
    enabled: isDataLoaded && siteIds.length > 0,
  })
}
