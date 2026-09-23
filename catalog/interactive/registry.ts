import type { CatalogComponent } from '../component.js'
import { checklistComponent } from './checklist.js'
import { scenariosComponent } from './scenarios.js'
import { stepsComponent } from './steps.js'
import { tabsComponent } from './tabs.js'

/**
 * Interactive category registry. Components in this category are added here; no other
 * shared file changes.
 */

export const interactiveComponents: ReadonlyArray<CatalogComponent> = [
  tabsComponent,
  scenariosComponent,
  stepsComponent,
  checklistComponent
]
