import type { CatalogComponent } from '../component.js'
import { flowDiagramComponent } from './flow-diagram.js'
import { sequenceDiagramComponent } from './sequence-diagram.js'
import { treeDiagramComponent } from './tree-diagram.js'
import { timelineComponent } from './timeline.js'
import { stateDiagramComponent } from './state-diagram.js'

/**
 * Diagrams category registry. Components in this category are added here; no other
 * shared file changes.
 */

export const diagramsComponents: ReadonlyArray<CatalogComponent> = [
  flowDiagramComponent,
  sequenceDiagramComponent,
  treeDiagramComponent,
  timelineComponent,
  stateDiagramComponent
]
