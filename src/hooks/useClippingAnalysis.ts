import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { query } from '@/lib/duckdb'
import { buildClippingHourlyQuery } from '@/lib/queries'
import { useDataStore } from '@/store/dataStore'
import {
  detectClippingEvents,
  DEFAULT_CLIPPING_OPTIONS,
} from '@/lib/clippingAnalysis'
import type { ClippingEvent, ClippingOptions, HourlyPoint } from '@/lib/clippingAnalysis'

/**
 * Fetches hourly AC power / DC current series for the given sites (respecting
 * the global date range) and runs the clipping-detection algorithm client
 * side. The hourly aggregation happens in DuckDB (cheap, columnar); the
 * flat-run scan happens in JS since it's a small, already-reduced dataset.
 */
export function useClippingAnalysis(
  siteIds: string[],
  options: ClippingOptions = DEFAULT_CLIPPING_OPTIONS,
) {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const dateRange = useDataStore((s) => s.dateRange)

  const { data: hourlyRows, isLoading, error } = useQuery({
    queryKey: [
      'clipping-hourly',
      siteIds,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: () => query<HourlyPoint>(buildClippingHourlyQuery(siteIds, dateRange)),
    enabled: isDataLoaded,
  })

  const events = useMemo<ClippingEvent[]>(() => {
    if (!hourlyRows || hourlyRows.length === 0) return []
    const allEvents = detectClippingEvents(hourlyRows, options)
    allEvents.sort((a, b) => b.duration_hours - a.duration_hours)
    return allEvents
  }, [hourlyRows, options])

  return {
    hourlyRows: hourlyRows ?? [],
    events,
    isLoading,
    error,
  }
}
