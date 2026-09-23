import type { CatalogComponent } from '../component.js'
import { claimsComponent } from './claims.js'
import { decisionRecordComponent } from './decision-record.js'
import { faqComponent } from './faq.js'
import { prosConsComponent } from './pros-cons.js'
import { riskMatrixComponent } from './risk-matrix.js'
import { sourcesComponent } from './sources.js'

/**
 * Research category registry. Components in this category are added here; no other
 * shared file changes.
 */

export const researchComponents: ReadonlyArray<CatalogComponent> = [
  sourcesComponent,
  claimsComponent,
  decisionRecordComponent,
  prosConsComponent,
  riskMatrixComponent,
  faqComponent
]
