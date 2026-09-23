import { calendarComponent } from './calendar.js'
import { factSetComponent } from './fact-set.js'
import { quoteComponent } from './quote.js'
import { scalableListComponent } from './scalable-list.js'
import { statusListComponent } from './status-list.js'
import type { CatalogComponent } from '../component.js'

/**
 * Plans category registry. Components in this category are added here; no other
 * shared file changes.
 */

export const plansComponents: ReadonlyArray<CatalogComponent> = [
  statusListComponent,
  calendarComponent,
  factSetComponent,
  scalableListComponent,
  quoteComponent
]
