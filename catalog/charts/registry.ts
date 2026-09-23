import type { CatalogComponent } from '../component.js'
import { areaChartComponent } from './area-chart.js'
import { barChartComponent } from './bar-chart.js'
import { heatmapComponent } from './heatmap.js'
import { histogramComponent } from './histogram.js'
import { lineChartComponent } from './line-chart.js'
import { proportionBarComponent } from './proportion-bar.js'
import { rangePlotComponent } from './range-plot.js'
import { scatterPlotComponent } from './scatter-plot.js'
import { sparklineComponent } from './sparkline.js'
import { timeStripsComponent } from './time-strips.js'

/**
 * Charts category registry. Phase-2 chart workers add their component here;
 * no other shared file changes.
 */

export const chartsComponents: ReadonlyArray<CatalogComponent> = [
  lineChartComponent,
  timeStripsComponent,
  barChartComponent,
  areaChartComponent,
  scatterPlotComponent,
  sparklineComponent,
  heatmapComponent,
  rangePlotComponent,
  proportionBarComponent,
  histogramComponent
]
