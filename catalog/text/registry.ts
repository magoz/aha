import type { CatalogComponent } from '../component.js'
import { calloutComponent } from './callout.js'

/**
 * Text category registry. Phase-2 text workers add their component here;
 * no other shared file changes.
 */

export const textComponents: ReadonlyArray<CatalogComponent> = [calloutComponent]
