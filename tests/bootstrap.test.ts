import { describe, expect, test } from 'claude-code/testing'

import { bootstrapBranches, type GitResult } from '../hooks/gitflow/bootstrap'

type Repo = { remote: Map<string, string>; local: Map<string, string>; refs: Map<string, string>; tags: string; reachable: boolean }

const ok = (stdout = ''): GitResult => ({ exitCode: 0, stdout, stderr: '' })
const fail = (stderr = ''): GitResult => ({ exitCode: 1, stdout: '', stderr })

function fakeGit(repo: Repo) {
  const calls: string[] = []
  const git = async (args: readonly string[]): Promise<GitResult> => {
    calls.push(args.join(' '))
    const [sub, ...rest] = args
    if (sub === 'ls-remote') {
      if (!repo.reachable) return fail('fatal: could not read from remote')
      return ok([...repo.remote].map(([b, sha]) => `${sha}\trefs/heads/${b}`).join('\n'))
    }
    if (sub === 'rev-parse') {
      const ref = rest.at(-1)!.replace(/\^\{commit\}$/, '')
      const sha = ref.startsWith('refs/heads/')
        ? repo.local.get(ref.slice('refs/heads/'.length))
        : ref.startsWith('origin/')
          ? repo.remote.get(ref.slice('origin/'.length))
          : repo.refs.get(ref)
      return sha ? ok(`${sha}\n`) : fail()
    }
    if (sub === 'push') {
      const [sha = '', dst = ''] = rest[1]!.split(':')
      repo.remote.set(dst.replace(/^refs\/heads\//, ''), sha)
      return ok()
    }
    if (sub === 'branch') {
      const [, name = '', start = ''] = rest
      repo.local.set(name, repo.remote.get(start.replace(/^origin\//, '')) ?? '')
      return ok()
    }
    if (sub === 'tag') return ok(repo.tags)
    return ok()
  }
  return { git, calls }
}

const repo = (partial: Partial<Repo>): Repo => ({
  remote: new Map(),
  local: new Map(),
  refs: new Map(),
  tags: 'v0.1.0\n',
  reachable: true,
  ...partial,
})

describe('bootstrap das branches permanentes', () => {
  test('sem production em origin exige a ref e não publica nada', async () => {
    const r = repo({ remote: new Map([['main', 'aaa111']]) })
    const { git, calls } = fakeGit(r)
    const lines = await bootstrapBranches(git, undefined)
    expect(lines.join('\n')).toMatch(/setup gitflow <ref>/)
    expect(calls.some(c => c.startsWith('push'))).toBe(false)
  })

  test('cria production a partir da ref, main a partir de production e cópias locais', async () => {
    const r = repo({ refs: new Map([['v-no-ar', 'bbb222']]), tags: '' })
    const { git } = fakeGit(r)
    const lines = (await bootstrapBranches(git, 'v-no-ar')).join('\n')
    expect(r.remote.get('production')).toBe('bbb222')
    expect(r.remote.get('main')).toBe('bbb222')
    expect(r.local.get('production')).toBe('bbb222')
    expect(r.local.get('main')).toBe('bbb222')
    expect(r.remote.has('staging')).toBe(false)
    expect(lines).toMatch(/staging não existe \(opcional/)
    expect(lines).toMatch(/nenhuma tag/)
  })

  test('production já em origin: só cria cópia local, sem push', async () => {
    const r = repo({ remote: new Map([['production', 'ccc333'], ['main', 'ddd444']]), local: new Map([['main', 'ddd444']]) })
    const { git, calls } = fakeGit(r)
    const lines = (await bootstrapBranches(git, 'main')).join('\n')
    expect(calls.some(c => c.startsWith('push'))).toBe(false)
    expect(r.local.get('production')).toBe('ccc333')
    expect(lines).toMatch(/ref "main" ignorada/)
    expect(lines).toMatch(/main local já existe/)
  })

  test('ref inexistente ou remote inacessível param sem alterar nada', async () => {
    const missing = fakeGit(repo({}))
    expect((await bootstrapBranches(missing.git, 'nao-existe')).join('\n')).toMatch(/não encontrada/)
    expect(missing.calls.some(c => c.startsWith('push'))).toBe(false)

    const offline = fakeGit(repo({ reachable: false }))
    expect((await bootstrapBranches(offline.git, 'main')).join('\n')).toMatch(/sem acesso ao remote/)
  })
})
