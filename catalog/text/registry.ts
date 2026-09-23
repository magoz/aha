import type { CatalogComponent } from '../component.js'
import { calloutComponent } from './callout.js'
import { codeDiffComponent } from './code-diff.js'
import { definitionListComponent } from './definition-list.js'

/**
 * Text category registry. Phase-2 text workers add their component here;
 * no other shared file changes.
 */

export const textComponents: ReadonlyArray<CatalogComponent> = [
  calloutComponent,
  definitionListComponent,
  codeDiffComponent
]
