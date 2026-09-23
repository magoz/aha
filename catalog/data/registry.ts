import type { CatalogComponent } from '../component.js'
import { comparisonMatrixComponent } from './comparison-matrix.js'
import { dataTableComponent } from './data-table.js'
import { keyFiguresComponent } from './key-figures.js'

/**
 * Data category registry. Phase-2 data workers add their component here;
 * no other shared file changes.
 */

export const dataComponents: ReadonlyArray<CatalogComponent> = [
  dataTableComponent,
  keyFiguresComponent,
  comparisonMatrixComponent
]
