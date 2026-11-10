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
    const text = fake.files.get(e.path) ?? (e.path.endsWith('regras-agente.md') ? 'REGRAS' : undefined)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
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
  expect(JSON.parse(fake.files.get(MARKER)!)).toEqual({ enabled: ['gitflow'] })

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
