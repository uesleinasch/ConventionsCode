import type { EngineInterface } from 'claude-code'

export const MARKER_PATH = '.claude/conventions.json'

export type Marker = { enabled: string[] }

export type ProjectState = {
  root: string
  enabled: ReadonlySet<string>
  blockedBy: string | undefined
}

export async function projectRoot($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()
  const run = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd }).catch(() => undefined)
  const top = run?.exitCode === 0 ? run.stdout.trim() : ''
  return top || cwd
}

export async function readMarker($: EngineInterface, root: string): Promise<Marker> {
  const text = await $.fs.read(`${root}/${MARKER_PATH}`).catch(() => undefined)
  if (typeof text !== 'string') return { enabled: [] }
  try {
    const parsed = JSON.parse(text) as Partial<Marker>
    return { enabled: Array.isArray(parsed.enabled) ? parsed.enabled.filter(m => typeof m === 'string') : [] }
  } catch {
    return { enabled: [] }
  }
}

export async function writeMarker($: EngineInterface, root: string, marker: Marker): Promise<void> {
  await $.fs.write(`${root}/${MARKER_PATH}`, `${JSON.stringify(marker, null, 2)}\n`)
}

export function parsePatterns(raw: string | number | boolean | readonly string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  return list.map(p => p.trim().toLowerCase()).filter(p => p.length > 0)
}

export async function blockedPattern(
  $: EngineInterface,
  root: string,
  patterns: readonly string[],
): Promise<string | undefined> {
  if (patterns.length === 0) return undefined
  const run = await $.process.run(['git', 'remote', '-v'], { cwd: root }).catch(() => undefined)
  const haystack = `${root}\n${run?.stdout ?? ''}`.toLowerCase()
  return patterns.find(p => haystack.includes(p))
}

export async function projectState($: EngineInterface, patterns: readonly string[]): Promise<ProjectState> {
  const root = await projectRoot($)
  const blockedBy = await blockedPattern($, root, patterns)
  if (blockedBy) return { root, enabled: new Set(), blockedBy }
  const marker = await readMarker($, root)
  return { root, enabled: new Set(marker.enabled), blockedBy }
}
