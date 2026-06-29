import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart as EBarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

echarts.use([
  EBarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

interface BarChartProps {
  option: EChartsOption
  height?: number | string
  className?: string
  onEvents?: Record<string, (params: Record<string, unknown>) => void>
}

export default function BarChart({
  option,
  height = 400,
  className,
  onEvents,
}: BarChartProps) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
      className={className}
      onEvents={onEvents}
    />
  )
}
