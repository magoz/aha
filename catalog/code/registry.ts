import type { CatalogComponent } from '../component.js'
import { annotatedCodeComponent } from './annotated-code.js'
import { commandComponent } from './command.js'
import { fileTreeComponent } from './file-tree.js'
import { schemaTableComponent } from './schema-table.js'
import { sideBySideComponent } from './side-by-side.js'

/**
 * Code category registry. Components in this category are added here; no other
 * shared file changes.
 */

export const codeComponents: ReadonlyArray<CatalogComponent> = [
  annotatedCodeComponent,
  fileTreeComponent,
  schemaTableComponent,
  commandComponent,
  sideBySideComponent
]
