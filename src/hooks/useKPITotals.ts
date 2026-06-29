import { useQuery } from '@tanstack/react-query'
import { query } from '@/lib/duckdb'
import { QUERY_KPI_TOTALS } from '@/lib/queries'
import { useDataStore } from '@/store/dataStore'

export interface KPITotalsRow {
  total_sites: number
  total_inverters: number
  total_energy: number
  date_from: string
  date_to: string
}

export function useKPITotals() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)

  return useQuery<KPITotalsRow | null>({
    queryKey: ['kpiTotals'],
    queryFn: async () => {
      const rows = await query<KPITotalsRow>(QUERY_KPI_TOTALS)
      return rows[0] ?? null
    },
    enabled: isDataLoaded,
  })
}
