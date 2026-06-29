import { useQuery } from '@tanstack/react-query'
import { query } from '@/lib/duckdb'
import { QUERY_SITE_SUMMARY } from '@/lib/queries'
import { useDataStore } from '@/store/dataStore'

export interface SiteSummaryRow {
  site_id: string
  inverter_count: number
  total_energy: number
  avg_ac_power: number
  avg_dc_power: number
  avg_temperature: number
  first_timestamp: string
  last_timestamp: string
  row_count: number
}

export function useSiteStats() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)

  return useQuery<SiteSummaryRow[]>({
    queryKey: ['siteSummary'],
    queryFn: () => query<SiteSummaryRow>(QUERY_SITE_SUMMARY),
    enabled: isDataLoaded,
  })
}
