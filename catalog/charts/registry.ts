import type { CatalogComponent } from '../component.js'
import { lineChartComponent } from './line-chart.js'
import { timeStripsComponent } from './time-strips.js'

/**
 * Charts category registry. Phase-2 chart workers add their component here;
 * no other shared file changes.
 */

export const chartsComponents: ReadonlyArray<CatalogComponent> = [
  lineChartComponent,
  timeStripsComponent
]
