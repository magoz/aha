import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderTreeDiagram } from './tree-diagram-render.js'
import { countTreeNodes, treeDepth, treeLabelsValid } from './tree-diagram-schema.js'
import { TreeDiagramSchema } from './tree-diagram-schema.js'
import { TREE_DIAGRAM_CSS } from './tree-diagram-css.js'

/**
 * tree-diagram component definition. A hierarchy rendered as a tidy
 * tree on wide containers and an indented list on narrow ones, with
 * collapsible nodes when scripts run.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(TreeDiagramSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'tree-diagram',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (!treeLabelsValid(decoded.root)) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'tree-diagram',
            path: 'root',
            detail: 'every node needs a non-empty label'
          })
        )
      }

      if (treeDepth(decoded.root) > 8) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'tree-diagram',
            path: 'root',
            detail: 'hierarchy is deeper than 8 levels'
          })
        )
      }

      if (countTreeNodes(decoded.root) > 150) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'tree-diagram',
            path: 'root',
            detail: 'hierarchy has more than 150 nodes'
          })
        )
      }

      return Effect.succeed(
        renderTreeDiagram(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Make this page public?",
  "root": {
    "label": "Make this page public?",
    "children": [
      { "label": "Publish now", "edge": "owner said publish" },
      {
        "label": "Is it time-boxed?",
        "edge": "not yet",
        "children": [
          { "label": "Schedule a publish date", "edge": "yes" },
          {
            "label": "Stay private",
            "edge": "no",
            "children": [
              { "label": "Share read link on tailnet", "edge": "needs eyes" },
              { "label": "Keep local draft", "edge": "solo" }
            ]
          }
        ]
      }
    ]
  }
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'publish-decision',
    title: 'Make this page public?',
    caption: 'Fig. 3. Decision tree for publishing; links carry the answers.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const treeDiagramComponent: CatalogComponent = {
  name: 'tree-diagram',
  category: 'diagrams',
  summary: 'Hierarchy with collapsible nodes: tidy tree wide, indented list narrow.',
  inputKind: 'json',
  fields: describeSchemaFields(TreeDiagramSchema),
  css: TREE_DIAGRAM_CSS,
  clientBundle: 'tree-diagram.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
