import { useQuery } from '@tanstack/react-query'
import { query } from '@/lib/duckdb'
import { QUERY_DAILY_SITE_ENERGY } from '@/lib/queries'
import { useDataStore } from '@/store/dataStore'

export interface DailySiteEnergyRow {
  site_id: string
  date: string
  daily_energy: number
}

export function useDailySiteEnergy() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)

  return useQuery<DailySiteEnergyRow[]>({
    queryKey: ['dailySiteEnergy'],
    queryFn: () => query<DailySiteEnergyRow>(QUERY_DAILY_SITE_ENERGY),
    enabled: isDataLoaded,
  })
}
