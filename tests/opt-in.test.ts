import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const ROOT = '/projeto'
const MARKER = `${ROOT}/.claude/conventions.json`

type Fake = { files: Map<string, string>; branch: string; remotes: string }

function fakeHost(on: On, fake: Fake) {
  on('session.cwd', () => ({ value: ROOT }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('fs.read', (_, e) => {
    const text =
      fake.files.get(e.path) ??
      (e.path.endsWith('regras-agente.md') ? `REGRAS ${e.path}` : e.path.endsWith('templates/python/ruff.toml') ? '[lint]' : undefined)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.list', (_, e) => ({
    value: e.path.includes('CleanCode/templates/python')
      ? [{ name: 'ruff.toml', kind: 'file', size: 6, mtimeMs: 0, isLink: false }]
      : [],
  }))
  on('fs.exists', (_, e) => ({ value: fake.files.has(e.path) }))
  on('fs.write', (_, e) => {
    fake.files.set(e.path, e.text)
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    const [, sub] = e.argv
    const stdout =
      sub === 'rev-parse' ? `${ROOT}\n` : sub === 'symbolic-ref' ? `${fake.branch}\n` : sub === 'remote' ? fake.remotes : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }))
}

const run = (args: string) =>
  ({ command: 'conventions', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } }) as const

const BAD_COMMIT = { tool: 'Bash', command: 'git commit -m "ajustes"' } as const

test('sem opt-in o plugin não interfere', async ($, on) => {
  const fake: Fake = { files: new Map(), branch: 'main', remotes: '' }
  fakeHost(on, fake)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

  const ran = await $.tool.call(BAD_COMMIT)
  expect(ran.deny).toBeUndefined()
})

test('enable cria o marcador e passa a bloquear; disable libera', async ($, on) => {
  const fake: Fake = { files: new Map(), branch: 'feature/x', remotes: '' }
  fakeHost(on, fake)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

  const enabled = await $.command.run(run('enable gitflow'))
  expect(enabled.text).toMatch(/ativada/)
  expect(enabled.context?.[0]).toMatch(/REGRAS/)
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['gitflow'], releaseAgent: true, mainSyncEvery: 2 })

  const blocked = await $.tool.call(BAD_COMMIT)
  expect(blocked.deny ?? blocked.text).toMatch(/conventions-code\/gitflow/)

  await $.command.run(run('disable gitflow'))
  const freed = await $.tool.call(BAD_COMMIT)
  expect(freed.deny).toBeUndefined()
})

test('remote bloqueado impede ativação e ignora marcador existente', { options: { blockedRemotes: 'acme-corp' } }, async ($, on) => {
  const fake: Fake = {
    files: new Map([[MARKER, '{"enabled":["gitflow"]}']]),
    branch: 'main',
    remotes: 'origin\tgit@github.com:acme-corp/app.git (fetch)\n',
  }
  fakeHost(on, fake)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

  const ran = await $.tool.call(BAD_COMMIT)
  expect(ran.deny).toBeUndefined()

  const refused = await $.command.run(run('enable gitflow'))
  expect(refused.text).toMatch(/Recusado/)
})

test('clean-code injeta regras próprias, não bloqueia Bash e exige stack no setup', async ($, on) => {
  const fake: Fake = { files: new Map(), branch: 'main', remotes: '' }
  fakeHost(on, fake)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

  const enabled = await $.command.run(run('enable clean-code'))
  expect(enabled.context?.[0]).toMatch(/CleanCode\/regras-agente\.md/)
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['clean-code'] })

  const ran = await $.tool.call(BAD_COMMIT)
  expect(ran.deny).toBeUndefined()

  const missingStack = await $.command.run(run('setup clean-code'))
  expect(missingStack.text).toMatch(/javascript\|python\|dotnet/)

  const setup = await $.command.run(run('setup clean-code python'))
  expect(setup.text).toMatch(/\+ ruff\.toml/)
  expect(fake.files.get(`${ROOT}/ruff.toml`)).toBe('[lint]')

  const again = await $.command.run(run('setup clean-code python'))
  expect(again.text).toMatch(/= ruff\.toml \(já existia/)
})

test('setup gitflow relata as branches permanentes', async ($, on) => {
  const fake: Fake = { files: new Map(), branch: 'main', remotes: '' }
  fakeHost(on, fake)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

  await $.command.run(run('enable gitflow'))
  const setup = await $.command.run(run('setup gitflow'))
  expect(setup.text).toMatch(/Branches permanentes:/)
  expect(setup.text).toMatch(/setup gitflow <ref>/)
})

test('release vem autorizado por padrão; off/on e main-sync ficam gravados', async ($, on) => {
  const fake: Fake = { files: new Map(), branch: 'production', remotes: '' }
  fakeHost(on, fake)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  const TAG = { tool: 'Bash', command: 'git tag -a v1.0.0 -m "Release v1.0.0"' } as const

  const notEnabled = await $.command.run(run('release on'))
  expect(notEnabled.text).toMatch(/enable gitflow/)

  await $.command.run(run('enable gitflow'))
  const byDefault = await $.tool.call(TAG)
  expect(byDefault.deny).toBeUndefined()

  await $.command.run(run('release off'))
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['gitflow'], releaseAgent: false, mainSyncEvery: 2 })
  const locked = await $.tool.call(TAG)
  expect(locked.deny ?? locked.text).toMatch(/release on/)

  await $.command.run(run('release on'))
  const freed = await $.tool.call(TAG)
  expect(freed.deny).toBeUndefined()

  const every = await $.command.run(run('main-sync 3'))
  expect(every.text).toMatch(/a cada 3/)
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['gitflow'], releaseAgent: true, mainSyncEvery: 3 })
  const invalid = await $.command.run(run('main-sync 0'))
  expect(invalid.text).toMatch(/n ≥ 1/)

  await $.command.run(run('disable gitflow'))
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: [] })
})

test('auto on libera merge de PR e liga release; release off revoga a autonomia', async ($, on) => {
  const fake: Fake = { files: new Map(), branch: 'feature/x', remotes: '' }
  fakeHost(on, fake)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  const MERGE = { tool: 'Bash', command: 'gh pr merge 42 --squash' } as const

  expect((await $.command.run(run('auto on'))).text).toMatch(/enable gitflow/)

  await $.command.run(run('enable gitflow'))
  await $.command.run(run('release off'))
  const locked = await $.tool.call(MERGE)
  expect(locked.deny ?? locked.text).toMatch(/auto on/)

  const enabled = await $.command.run(run('auto on'))
  expect(enabled.context?.[0]).toMatch(/Autonomia: ATIVA/)
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['gitflow'], releaseAgent: true, autonomy: true, mainSyncEvery: 2 })
  expect((await $.tool.call(MERGE)).deny).toBeUndefined()
  expect((await $.command.run(run('status'))).text).toMatch(/Autonomia .*: ativa/)

  await $.command.run(run('release off'))
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['gitflow'], releaseAgent: false, mainSyncEvery: 2 })
  const revoked = await $.tool.call(MERGE)
  expect(revoked.deny ?? revoked.text).toMatch(/auto on/)

  await $.command.run(run('auto on'))
  await $.command.run(run('auto off'))
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['gitflow'], releaseAgent: true, autonomy: false, mainSyncEvery: 2 })
  const off = await $.tool.call(MERGE)
  expect(off.deny ?? off.text).toMatch(/auto on/)
})
