import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderFlowDiagram } from './flow-diagram-render.js'
import { FlowDiagramSchema } from './flow-diagram-schema.js'
import { FLOW_DIAGRAM_CSS } from './flow-diagram-css.js'

/**
 * flow-diagram component definition. A directed graph of steps or
 * services laid out automatically from structure, with optional clusters
 * and one highlighted path.
 */

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<never, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({
      blockIndex: request.blockIndex,
      component: 'flow-diagram',
      path,
      detail
    })
  )
}

function checkRefs(
  request: JsonRenderRequest,
  decoded: (typeof FlowDiagramSchema)['Type']
): Effect.Effect<void, BlockDecodeError> {
  const known = new Set<string>()
  const groups = new Set<string>()

  for (const group of decoded.groups ?? []) {
    groups.add(group.id)
  }

  for (const node of decoded.nodes) {
    if (known.has(node.id)) {
      return fail(request, 'nodes', `duplicate node id "${node.id}"`)
    }

    known.add(node.id)

    if (node.group !== undefined && !groups.has(node.group)) {
      return fail(request, 'nodes', `node "${node.id}" names unknown group "${node.group}"`)
    }
  }

  let edgeIndex = 0

  for (const edge of decoded.edges) {
    if (!known.has(edge.from)) {
      return fail(
        request,
        'edges',
        `edges[${String(edgeIndex)}].from names unknown node "${edge.from}"`
      )
    }

    if (!known.has(edge.to)) {
      return fail(
        request,
        'edges',
        `edges[${String(edgeIndex)}].to names unknown node "${edge.to}"`
      )
    }

    edgeIndex += 1
  }

  for (const id of decoded.highlight ?? []) {
    if (!known.has(id)) {
      return fail(request, 'highlight', `unknown node "${id}"`)
    }
  }

  return Effect.void
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(FlowDiagramSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'flow-diagram',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.nodes.length === 0) {
        return fail(request, 'nodes', 'expected at least one node')
      }

      return checkRefs(request, decoded).pipe(
        Effect.map(() =>
          renderFlowDiagram(decoded, { width: request.width, idPrefix: request.idPrefix })
        )
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Aha request flow",
  "direction": "auto",
  "groups": [
    { "id": "publish", "label": "publish path" },
    { "id": "public", "label": "public read" },
    { "id": "tailnet", "label": "tailnet read" }
  ],
  "nodes": [
    { "id": "agent", "label": "Agent", "group": "publish" },
    { "id": "cli", "label": "CLI", "group": "publish" },
    { "id": "api", "label": "Vercel API", "group": "publish" },
    { "id": "r2", "label": "R2 store", "group": "publish" },
    { "id": "reader", "label": "Reader", "group": "public" },
    { "id": "dns", "label": "Public DNS", "group": "public" },
    { "id": "check", "label": "Marker check", "group": "public" },
    { "id": "page", "label": "Served page", "group": "public" },
    { "id": "gateway", "label": "Tailnet gateway", "group": "tailnet" }
  ],
  "edges": [
    { "from": "agent", "to": "cli", "label": "writes html" },
    { "from": "cli", "to": "api", "label": "upload" },
    { "from": "api", "to": "r2", "label": "put html" },
    { "from": "reader", "to": "dns", "label": "resolve" },
    { "from": "dns", "to": "api", "label": "GET /<id>" },
    { "from": "api", "to": "check", "label": "marker?" },
    { "from": "check", "to": "page", "label": "serve" },
    { "from": "reader", "to": "gateway", "label": "tailnet GET" },
    { "from": "gateway", "to": "r2", "label": "private read" },
    { "from": "gateway", "to": "page", "label": "serve private" }
  ],
  "highlight": ["agent", "cli", "api", "r2"]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'aha-request-flow',
    title: 'Aha request flow',
    caption:
      'Fig. 1. Publish, public read and tailnet read paths; the publish path is highlighted.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const flowDiagramComponent: CatalogComponent = {
  name: 'flow-diagram',
  category: 'diagrams',
  summary: 'Directed graph of steps or services with optional groups and one highlighted path.',
  inputKind: 'json',
  fields: describeSchemaFields(FlowDiagramSchema),
  css: FLOW_DIAGRAM_CSS,
  clientBundle: 'flow-diagram.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
