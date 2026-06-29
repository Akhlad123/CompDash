# CompDash — Microinverter Telemetry Comparison Dashboard

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![ECharts](https://img.shields.io/badge/ECharts-6-AA344D)
![DuckDB](https://img.shields.io/badge/DuckDB--WASM-In--Browser_SQL-FFC107)

A fully client-side dashboard for analyzing and comparing microinverter telemetry data. Upload CSV/Excel files and instantly explore performance across sites and inverters — no backend required.

**Live Demo:** [https://Akhlad123.github.io/CompDash/](https://Akhlad123.github.io/CompDash/)

<!-- ![Screenshot](docs/screenshot.png) -->

## Features

- **Upload & Map** — Drag-and-drop CSV/Excel with automatic column mapping and fuzzy matching
- **Overview** — KPI cards, site summary table with 7-day sparklines
- **Site Comparison** — Multi-site overlay/side-by-side line charts with brush/zoom
- **Inverter Drilldown** — Z-score anomaly status badges, energy bar chart, multi-inverter overlay
- **Time Series** — By-site or by-inverter mode, markLine means, DataZoom, collapsible stats
- **Anomaly Detection** — Z-score threshold slider, flagged inverter table, heatmap, distribution chart
- **Export** — PDF, PNG, Excel export + shareable URL with compressed state

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
│   ├── filters/      # DateRangePicker, GranularityToggle, SiteSelector, etc.
│   ├── layout/       # PageWrapper, AppSidebar, KPICard
│   └── upload/       # ColumnMapper, DropZone
├── hooks/            # TanStack Query hooks wrapping DuckDB queries
├── lib/              # duckdb, queries, parsers, schema, exportUtils, shareLink
├── pages/            # UploadPage, OverviewPage, SiteComparisonPage, etc.
└── store/            # dataStore (Zustand), uiStore (Zustand)
```

## License

MIT
