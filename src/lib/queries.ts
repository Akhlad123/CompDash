export const QUERY_SITE_SUMMARY = `
  SELECT
    site_id,
    COUNT(DISTINCT serial_number) AS inverter_count,
    SUM(energy_produced)          AS total_energy,
    AVG((duration * energy_produced) / 3600.0) AS avg_ac_power,
    AVG(dc_current * dc_voltage)  AS avg_dc_power,
    AVG(temperature_f)            AS avg_temperature,
    MIN(timestamp)                AS first_timestamp,
    MAX(timestamp)                AS last_timestamp,
    COUNT(*)                      AS row_count
  FROM telemetry
  GROUP BY site_id
  ORDER BY site_id
`

export const QUERY_DAILY_SITE_ENERGY = `
  SELECT
    site_id,
    CAST(timestamp AS DATE) AS date,
    SUM(energy_produced)    AS daily_energy
  FROM telemetry
  GROUP BY site_id, CAST(timestamp AS DATE)
  ORDER BY site_id, date
`

export const QUERY_INVERTER_SUMMARY = `
  SELECT
    serial_number,
    site_id,
    sku_name,
    SUM(energy_produced)          AS total_energy,
    AVG((duration * energy_produced) / 3600.0) AS avg_ac_power,
    AVG(dc_current * dc_voltage)  AS avg_dc_power,
    AVG(temperature_f)            AS avg_temperature,
    MIN(timestamp)                AS first_timestamp,
    MAX(timestamp)                AS last_timestamp,
    COUNT(*)                      AS row_count
  FROM telemetry
  WHERE site_id = '{site_id}'
  GROUP BY serial_number, site_id, sku_name
  ORDER BY serial_number
`

export const QUERY_TIMESERIES = `
  SELECT
    {bucket_expr}                   AS bucket,
    site_id,
    serial_number,
    AVG({metric_expr})              AS metric_value,
    COUNT(*)                        AS sample_count
  FROM telemetry
  WHERE 1=1
    {site_filter}
    {inverter_filter}
  GROUP BY bucket, site_id, serial_number
  ORDER BY bucket, site_id, serial_number
`

export const QUERY_ANOMALY_ZSCORE = `
  SELECT
    serial_number,
    site_id,
    CAST(timestamp AS DATE) AS date,
    SUM(energy_produced)    AS daily_energy,
    AVG(SUM(energy_produced)) OVER (PARTITION BY site_id)  AS site_avg_energy,
    STDDEV(SUM(energy_produced)) OVER (PARTITION BY site_id) AS site_std_energy,
    CASE
      WHEN STDDEV(SUM(energy_produced)) OVER (PARTITION BY site_id) > 0
      THEN (SUM(energy_produced) - AVG(SUM(energy_produced)) OVER (PARTITION BY site_id))
           / STDDEV(SUM(energy_produced)) OVER (PARTITION BY site_id)
      ELSE 0
    END AS z_score
  FROM telemetry
  GROUP BY serial_number, site_id, CAST(timestamp AS DATE)
  ORDER BY ABS(z_score) DESC
`

export const QUERY_HEATMAP = `
  SELECT
    serial_number,
    CAST(timestamp AS DATE) AS date,
    SUM(energy_produced)    AS daily_energy
  FROM telemetry
  WHERE site_id = '{site_id}'
  GROUP BY serial_number, CAST(timestamp AS DATE)
  ORDER BY serial_number, date
`

export const QUERY_ANOMALY_INVERTER_TOTALS = `
  SELECT
    t.serial_number,
    t.site_id,
    t.sku_name,
    SUM(t.energy_produced)  AS total_energy,
    s.site_mean,
    s.site_std,
    CASE
      WHEN s.site_std > 0
      THEN (SUM(t.energy_produced) - s.site_mean) / s.site_std
      ELSE 0
    END AS z_score
  FROM telemetry t
  JOIN (
    SELECT
      site_id,
      AVG(inv_energy) AS site_mean,
      STDDEV(inv_energy) AS site_std
    FROM (
      SELECT site_id, serial_number, SUM(energy_produced) AS inv_energy
      FROM telemetry
      WHERE 1=1 {site_filter}
      GROUP BY site_id, serial_number
    ) sub
    GROUP BY site_id
  ) s ON t.site_id = s.site_id
  WHERE 1=1 {site_filter}
  GROUP BY t.serial_number, t.site_id, t.sku_name, s.site_mean, s.site_std
  ORDER BY z_score ASC
`

export const QUERY_HEATMAP_MULTI = `
  SELECT
    serial_number,
    site_id,
    sku_name,
    CAST(timestamp AS DATE) AS date,
    SUM(energy_produced)    AS daily_energy
  FROM telemetry
  WHERE 1=1 {site_filter}
  GROUP BY serial_number, site_id, sku_name, CAST(timestamp AS DATE)
  ORDER BY serial_number, date
`

export const QUERY_KPI_TOTALS = `
  SELECT
    COUNT(DISTINCT site_id)         AS total_sites,
    COUNT(DISTINCT serial_number)   AS total_inverters,
    SUM(energy_produced)            AS total_energy,
    MIN(timestamp)                  AS date_from,
    MAX(timestamp)                  AS date_to
  FROM telemetry
`

// ── Helpers ──────────────────────────────────────────────────────────────

export type MetricKey =
  | 'ac_power'
  | 'dc_power'
  | 'energy_produced'
  | 'temperature_f'
  | 'ac_voltage'
  | 'ac_frequency'
  | 'dc_current'
  | 'dc_voltage'

export type Granularity = 'raw' | 'hourly' | 'daily' | 'monthly'

const METRIC_EXPR: Record<MetricKey, string> = {
  ac_power: '(duration * energy_produced) / 3600.0',
  dc_power: 'dc_current * dc_voltage',
  energy_produced: 'energy_produced',
  temperature_f: 'temperature_f',
  ac_voltage: 'ac_voltage',
  ac_frequency: 'ac_frequency',
  dc_current: 'dc_current',
  dc_voltage: 'dc_voltage',
}

const BUCKET_EXPR: Record<Granularity, string> = {
  raw: 'timestamp',
  hourly: "DATE_TRUNC('hour', timestamp)",
  daily: 'CAST(timestamp AS DATE)',
  monthly: "DATE_TRUNC('month', timestamp)",
}

export function buildTimeseriesQuery(
  metric: MetricKey,
  granularity: Granularity,
  siteIds: string[],
  inverterIds: string[]
): string {
  const metricExpr = METRIC_EXPR[metric]
  const bucketExpr = BUCKET_EXPR[granularity]

  const siteFilter =
    siteIds.length > 0
      ? `AND site_id IN (${siteIds.map((s) => `'${s}'`).join(', ')})`
      : ''

  const inverterFilter =
    inverterIds.length > 0
      ? `AND serial_number IN (${inverterIds.map((s) => `'${s}'`).join(', ')})`
      : ''

  return QUERY_TIMESERIES
    .replace('{bucket_expr}', bucketExpr)
    .replace('{metric_expr}', metricExpr)
    .replace('{site_filter}', siteFilter)
    .replace('{inverter_filter}', inverterFilter)
}

export function buildInverterSummaryQuery(siteId: string): string {
  return QUERY_INVERTER_SUMMARY.replace('{site_id}', siteId)
}

export function buildHeatmapQuery(siteId: string): string {
  return QUERY_HEATMAP.replace('{site_id}', siteId)
}

export function buildAnomalyQuery(siteIds: string[]): string {
  const siteFilter =
    siteIds.length > 0
      ? `AND site_id IN (${siteIds.map((s) => `'${s}'`).join(', ')})`
      : ''
  return QUERY_ANOMALY_INVERTER_TOTALS
    .replace(/{site_filter}/g, siteFilter)
}

export function buildHeatmapMultiQuery(siteIds: string[]): string {
  const siteFilter =
    siteIds.length > 0
      ? `AND site_id IN (${siteIds.map((s) => `'${s}'`).join(', ')})`
      : ''
  return QUERY_HEATMAP_MULTI.replace('{site_filter}', siteFilter)
}
