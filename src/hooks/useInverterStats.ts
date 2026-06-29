import { useQuery } from '@tanstack/react-query'
import { query } from '@/lib/duckdb'
import { buildInverterSummaryQuery } from '@/lib/queries'
import { useDataStore } from '@/store/dataStore'

export interface InverterStatsRow {
  serial_number: string
  site_id: string
  sku_name: string | null
  total_energy: number
  avg_ac_power: number
  avg_dc_power: number
  avg_temperature: number
  first_timestamp: string
  last_timestamp: string
  row_count: number
}

export type InverterStatus = 'normal' | 'warning' | 'alert'

export interface InverterStatsWithZ extends InverterStatsRow {
  z_score: number
  status: InverterStatus
}

function computeZScores(rows: InverterStatsRow[]): InverterStatsWithZ[] {
  if (rows.length === 0) return []

  const energies = rows.map((r) => r.total_energy)
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length
  const variance =
    energies.reduce((a, v) => a + (v - mean) ** 2, 0) / energies.length
  const stdDev = Math.sqrt(variance)

  return rows.map((row) => {
    const z = stdDev > 0 ? Math.abs((row.total_energy - mean) / stdDev) : 0
    let status: InverterStatus = 'normal'
    if (z > 2) status = 'alert'
    else if (z > 1.5) status = 'warning'
    return { ...row, z_score: z, status }
  })
}

export function useInverterStats(siteId: string) {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)

  return useQuery<InverterStatsWithZ[]>({
    queryKey: ['inverterStats', siteId],
    queryFn: async () => {
      const sql = buildInverterSummaryQuery(siteId)
      const rows = await query<InverterStatsRow>(sql)
      return computeZScores(rows)
    },
    enabled: isDataLoaded && siteId.length > 0,
  })
}
