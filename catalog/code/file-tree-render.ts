import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { FileTreeEntry, FileTreeInput } from './file-tree-schema.js'

/**
 * File-tree renderer. Groups a flat path list into folders, preserving
 * author order, and draws one row per file with a glyph-plus-word
 * status marker and a muted note column. Folders render expanded;
 * the client adds collapsing. Pure builders, no DOM.
 */

export interface FileTreeRenderOptions {
  readonly idPrefix: string
}

export interface FileTreeLeaf {
  readonly name: string
  readonly status: string | undefined
  readonly previous: string | undefined
  readonly note: string | undefined
}

interface TreeDir {
  readonly name: string
  readonly dirs: Array<TreeDir>
  readonly files: Array<FileTreeLeaf>
}

/** Split a path into segments, or null when it is empty or unsafe. */
export function parseTreePath(path: string): ReadonlyArray<string> | null {
  let clean = path.trim()

  while (clean.startsWith('./')) {
    clean = clean.slice(2)
  }

  while (clean.startsWith('/')) {
    clean = clean.slice(1)
  }

  while (clean.endsWith('/')) {
    clean = clean.slice(0, -1)
  }

  if (clean.length === 0 || clean.length > 200) {
    return null
  }

  const parts = clean.split('/')

  for (const part of parts) {
    if (part.length === 0 || part === '.' || part === '..') {
      return null
    }

    if (part.indexOf('\\') !== -1) {
      return null
    }
  }

  return parts
}

function findDir(parent: TreeDir, name: string): TreeDir | null {
  for (const dir of parent.dirs) {
    if (dir.name === name) {
      return dir
    }
  }

  return null
}

/** Group entries into a folder tree, keeping first-appearance order. */
export function buildFileTree(entries: ReadonlyArray<FileTreeEntry>): TreeDir {
  const root: TreeDir = { name: '', dirs: [], files: [] }

  for (const entry of entries) {
    const segments = parseTreePath(entry.path)

    if (segments === null) {
      continue
    }

    let parent = root

    for (let depth = 0; depth < segments.length - 1; depth += 1) {
      const segment = segments[depth] ?? ''
      let next = findDir(parent, segment)

      if (next === null) {
        next = { name: segment, dirs: [], files: [] }
        parent.dirs.push(next)
      }

      parent = next
    }

    const leaf = segments[segments.length - 1] ?? ''

    parent.files.push({
      name: leaf,
      status: entry.status,
      previous: entry.previous,
      note: entry.note
    })
  }

  return root
}

export function countTreeFiles(dir: TreeDir): number {
  let total = dir.files.length

  for (const child of dir.dirs) {
    total += countTreeFiles(child)
  }

  return total
}

function statusGlyph(status: string): string {
  if (status === 'added') {
    return '+'
  }

  if (status === 'changed') {
    return '~'
  }

  if (status === 'removed') {
    return '-'
  }

  return '→'
}

function statusClass(status: string): string {
  if (status === 'added') {
    return 'st-added'
  }

  if (status === 'changed') {
    return 'st-changed'
  }

  if (status === 'removed') {
    return 'st-removed'
  }

  return 'st-renamed'
}

function renderMarker(status: string | undefined): string {
  if (status === undefined) {
    return '<span class="st" aria-hidden="true"></span>'
  }

  return `<span class="st ${statusClass(status)}"><span aria-hidden="true">${statusGlyph(status)}</span><span class="vh">${escapeHtml(status)}: </span></span>`
}

function renderLeafName(leaf: FileTreeLeaf): string {
  const struck = leaf.status === 'removed' ? ' struck' : ''
  let name = `<span class="nm${struck}">${escapeHtml(leaf.name)}</span>`

  if (leaf.status === 'renamed' && leaf.previous !== undefined) {
    const segments = parseTreePath(leaf.previous)

    const oldName =
      segments === null ? leaf.previous : (segments[segments.length - 1] ?? leaf.previous)

    name = `<span class="was">${escapeHtml(oldName)}</span><span class="was-arrow" aria-hidden="true"> → </span>${name}`
  }

  return name
}

function renderLeaf(leaf: FileTreeLeaf): string {
  const note = leaf.note === undefined ? '' : `<span class="note">${escapeHtml(leaf.note)}</span>`

  return `<li class="file">${renderMarker(leaf.status)}${renderLeafName(leaf)}${note}</li>`
}

function renderDir(dir: TreeDir, idPrefix: string, trail: string): string {
  let inner = ''

  for (const child of dir.dirs) {
    inner += renderDir(child, idPrefix, `${trail}/${child.name}`)
  }

  for (const leaf of dir.files) {
    inner += renderLeaf(leaf)
  }

  const count = countTreeFiles(dir)
  const dirId = `${idPrefix}${trail}`

  return `<li class="dir"><button type="button" class="dirname" aria-expanded="true" aria-controls="${escapeAttr(dirId)}"><span class="twisty" aria-hidden="true">▾</span><span class="nm">${escapeHtml(dir.name)}/</span><span class="count">${String(count)}</span></button><ul id="${escapeAttr(dirId)}">${inner}</ul></li>`
}

export function renderFileTree(input: FileTreeInput, options: FileTreeRenderOptions): string {
  const root = buildFileTree(input.entries)

  let inner = ''

  for (const child of root.dirs) {
    inner += renderDir(child, options.idPrefix, `-${child.name}`)
  }

  for (const leaf of root.files) {
    inner += renderLeaf(leaf)
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-ftree" data-ftree="file-tree" data-ftree-id="${escapeAttr(options.idPrefix)}">${title}<ul class="tree">${inner}</ul></div>`
}
