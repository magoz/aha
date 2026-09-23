import type { CatalogComponent } from './component.js'
import { chartsComponents } from './charts/registry.js'
import { dataComponents } from './data/registry.js'
import { diagramsComponents } from './diagrams/registry.js'
import { interactiveComponents } from './interactive/registry.js'
import { researchComponents } from './research/registry.js'
import { codeComponents } from './code/registry.js'
import { plansComponents } from './plans/registry.js'
import { textComponents } from './text/registry.js'

/**
 * The one list of categories. Each entry points at its category registry;
 * adding a component to an existing category touches only that registry.
 * Adding a new category touches only this file plus the new directory.
 */

export interface CatalogCategory {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly components: ReadonlyArray<CatalogComponent>
}

export const catalogCategories: ReadonlyArray<CatalogCategory> = [
  {
    id: 'charts',
    title: 'Charts',
    description: 'Interactive charts with direct labels, tooltips and keyboard support.',
    components: chartsComponents
  },
  {
    id: 'data',
    title: 'Data',
    description: 'Tables and structured values that read without scripts.',
    components: dataComponents
  },
  {
    id: 'diagrams',
    title: 'Diagrams',
    description: 'Flows, sequences, trees and timelines laid out automatically from structure.',
    components: diagramsComponents
  },
  {
    id: 'interactive',
    title: 'Interactive',
    description: 'Controls that change what the page shows: scenarios, tabs, steps and checklists.',
    components: interactiveComponents
  },
  {
    id: 'research',
    title: 'Research and decisions',
    description: 'Sources, claims, decisions, trade-offs and risks.',
    components: researchComponents
  },
  {
    id: 'code',
    title: 'Code',
    description: 'Annotated code, file trees, schemas, commands and before/after views.',
    components: codeComponents
  },
  {
    id: 'plans',
    title: 'Plans and everyday',
    description: 'Status, calendars, fact sheets, scalable quantities and quotes.',
    components: plansComponents
  },
  {
    id: 'text',
    title: 'Text',
    description: 'Prose wrappers matching the house style.',
    components: textComponents
  }
]

export function allCatalogComponents(): ReadonlyArray<CatalogComponent> {
  const out: Array<CatalogComponent> = []

  for (const category of catalogCategories) {
    for (const component of category.components) {
      out.push(component)
    }
  }

  return out
}

export function findCatalogComponent(name: string): CatalogComponent | null {
  for (const component of allCatalogComponents()) {
    if (component.name === name) {
      return component
    }
  }

  return null
}
