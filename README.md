# CompDash — Microinverter Telemetry Comparison Dashboard

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![ECharts](https://img.shields.io/badge/ECharts-6-AA344D)
![DuckDB](https://img.shields.io/badge/DuckDB--WASM-In--Browser_SQL-FFC107)

> *Dashboard for analyzing Microinverter telemetry data*

A fully client-side dashboard for analyzing and comparing microinverter telemetry data. Upload CSV/Excel files and instantly explore performance across sites and inverters — no backend required.

**Live Demo:** [https://Akhlad123.github.io/CompDash/](https://Akhlad123.github.io/CompDash/)

<!-- ![Screenshot](docs/screenshot.png) -->

## Features

### Data Ingestion
- **Drag-and-drop** CSV/Excel upload with automatic column mapping and fuzzy matching
- **Resilient ingestion** — malformed rows are skipped individually instead of failing entire batches
- **Session persistence** — data survives page reloads via DuckDB session storage
- **Flexible date parsing** — handles various `local_date` formats (M/D/YY, YYYY-MM-DD, null)

### Computed Metrics
- **DC Power** — `DC Voltage × DC Current` (W), computed at query time
- **AC Power** — `Energy Produced × 3600 / Duration` (W), computed at query time
- Both are available in all metric selectors, charts, and threshold analysis

### Pages

| Page | Description |
|------|-------------|
| **Upload** | File import, column mapping, data preview, DuckDB ingestion |
| **Overview** | KPI cards (total energy, sites, inverters, date range), site summary table with 7-day sparklines |
| **Site Comparison** | Multi-site line charts with overlay or split view, summary statistics |
| **Inverter Drilldown** | Z-score anomaly badges, energy bar chart, threshold analysis, multi-inverter comparison |
| **Time Series** | By-site or by-inverter mode, markLine means, DataZoom, collapsible statistics |
| **Anomaly Detection** | Z-score threshold slider, flagged inverter table, heatmap, distribution chart |
| **Developer** | Advanced multi-axis chart builder with drag-and-drop metrics, per-metric statistics |

### Threshold Analysis
- **Above**: Computes marginal energy above a threshold — `SUM((param − threshold) × duration / 3600)` for rows where the parameter exceeds the threshold
- **Below**: Identifies days where the parameter *never crossed* the threshold, then sums energy for those days
- Supports **multiple parameters** with AND/OR logic and customizable threshold values
- Works with DC Power, AC Power, AC Voltage, AC Frequency, Temperature, DC Current, DC Voltage

### Multi-Metric Charting
- Select up to 4 metrics simultaneously in Site Comparison, Time Series, Inverter Drilldown, and Developer pages
- **Overlay mode** (default): All metrics on a single chart with multiple Y-axes
- **Split mode**: Separate chart per metric — toggle with Overlay/Split buttons

### Cross-Site Inverter Comparison
- Compare inverters from **different sites** in Inverter Drilldown and Time Series
- Multi-site selector in Time Series "By Inverter" mode
- "Compare across sites" button in Inverter Drilldown detail panel

### Statistics & Export
- Statistics tables show **Total/Sum only for Energy** — other metrics display mean, max, min, std dev
- **Export**: PDF, PNG, Excel export + shareable URL with compressed state

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite + TypeScript (strict) |
| Routing | HashRouter (GitHub Pages compatible) |
| State | Zustand |
| Async Data | TanStack Query v5 |
| SQL Engine | DuckDB-WASM (in-browser) |
| Charts | Apache ECharts via echarts-for-react |
| UI | shadcn/ui + TailwindCSS + Lucide React |
| Export | html2canvas + jsPDF + SheetJS |
| Sharing | lz-string compressed URL state |

## Local Setup

```bash
# Clone
git clone https://github.com/Akhlad123/CompDash.git
cd CompDash

# Install
npm install

# Dev server
npm run dev
```

Open [http://localhost:5173/CompDash/](http://localhost:5173/CompDash/)

## Sample Data

A sample dataset is included at `public/sample/sample_telemetry.csv`:

- **5 sites** (SITE-A through SITE-E)
- **10 inverters per site** (50 total)
- **7 days** of 15-minute interval data (June 1–7, 2025)
- **33,600 rows** with realistic solar production curves

To use it:

1. Start the dev server (`npm run dev`)
2. On the Upload page, click "Browse" and select `public/sample/sample_telemetry.csv`
3. Column mapping is automatic — click "Ingest Data"
4. Navigate to Overview, Site Comparison, or any other page

## Deployment

Pushing to `main` triggers GitHub Actions (`.github/workflows/deploy.yml`) which builds and deploys to the `gh-pages` branch automatically.

### Manual deployment

```bash
npm run build
# dist/ folder is ready to serve from any static host
```

## Project Structure

```
src/
├── components/
│   ├── charts/       # LineChart, BarChart, HeatmapChart
│   ├── export/       # ExportToolbar, ShareLinkButton, ExportPDF/Excel
│   ├── filters/      # DateRangePicker, GranularityToggle, SiteSelector, MetricPicker, MultiMetricPicker
│   ├── layout/       # PageWrapper, AppSidebar, ThemeToggle, KPICard
│   └── upload/       # ColumnMapper, DropZone, DataPreview
├── hooks/            # TanStack Query hooks (useMultiMetricTimeSeries, useInverterStats, etc.)
├── lib/              # duckdb, queries, parsers, schema, exportUtils, shareLink, sessionStore
├── pages/            # UploadPage, OverviewPage, SiteComparisonPage, InverterDrilldownPage,
│                     #   TimeSeriesPage, AnomalyPage, DeveloperPage
└── store/            # dataStore (Zustand), uiStore (Zustand)
```

## License

MIT
