import { allCatalogComponents, catalogCategories, findCatalogComponent } from './categories.js'
import { escapeHtml } from './shared/svg.js'

/**
 * `aha components` output. Lists the catalog and prints field docs (from
 * schema annotations) plus a paste-ready example block for one component.
 */

export function formatComponentsList(asJson: boolean): string {
  if (asJson) {
    const entries = allCatalogComponents().map((component) => ({
      name: component.name,
      category: component.category,
      summary: component.summary
    }))

    return JSON.stringify(entries, null, 2)
  }

  let out = ''

  for (const category of catalogCategories) {
    if (category.components.length === 0) {
      continue
    }

    out += `${category.id} — ${category.title}\n`

    for (const component of category.components) {
      out += `  ${component.name}: ${component.summary}\n`
    }
  }

  return out.trimEnd()
}

function exampleBlock(name: string): string {
  const component = findCatalogComponent(name)

  if (component === null) {
    return ''
  }

  const example = component.examples[0]

  if (example === undefined) {
    return ''
  }

  if (component.inputKind === 'markup' && example.markup !== null) {
    const tag = component.markupTag ?? 'div'
    const kindAttr = example.markupKind === null ? '' : ` data-kind="${example.markupKind}"`

    return `<${tag} data-aha="${name}"${kindAttr}>\n${example.markup}\n</${tag}>`
  }

  if (example.json !== null) {
    const caption =
      example.caption.length === 0
        ? ''
        : `\n<figcaption>${escapeHtml(example.caption)}</figcaption>`

    return `<figure data-aha="${name}">\n<script type="application/json">${example.json}</script>${caption}\n</figure>`
  }

  return ''
}

export function formatComponentDetail(name: string, asJson: boolean): string | null {
  const component = findCatalogComponent(name)

  if (component === null) {
    return null
  }

  if (asJson) {
    return JSON.stringify(
      {
        name: component.name,
        category: component.category,
        summary: component.summary,
        fields: component.fields,
        example: exampleBlock(name)
      },
      null,
      2
    )
  }

  let out = `${component.name} [${component.category}]\n${component.summary}\n\nfields:\n`

  for (const field of component.fields) {
    const optional = field.required ? 'required' : 'optional'
    const description = field.description.length === 0 ? '' : ` — ${field.description}`
    out += `  ${field.path} (${field.type}, ${optional})${description}\n`
  }

  out += `\nexample:\n${exampleBlock(name)}\n`

  return out.trimEnd()
}
