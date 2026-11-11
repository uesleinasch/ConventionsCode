import type { EngineInterface, Register } from 'claude-code'

import { checkCommand } from './gitflow/guard'
import {
  MARKER_PATH,
  parsePatterns,
  projectState,
  readMarker,
  writeMarker,
  type ProjectState,
} from './shared/project'
import { copyTemplates } from './shared/templates'

type Convention = {
  id: string
  title: string
  rulesPath: string
  docsPath: string
  templatesPath?: string
  templateVariants?: readonly string[]
  setupGuide?: string
  guardsBash: boolean
}

const CONVENTIONS: readonly Convention[] = [
  {
    id: 'gitflow',
    title: 'GitFlow (branches, commits, releases e tags)',
    rulesPath: 'GitFlow/regras-agente.md',
    docsPath: 'GitFlow',
    templatesPath: 'GitFlow/templates',
    setupGuide:
      'Siga o checklist de GitFlow/05-automacao.md e ajude o usuário a adaptar os placeholders ' +
      '(make lint/test/package, scripts/deploy.sh, linguagens do CodeQL, CODEOWNERS).',
    guardsBash: true,
  },
  {
    id: 'clean-code',
    title: 'Código limpo e comentários',
    rulesPath: 'CleanCode/regras-agente.md',
    docsPath: 'CleanCode',
    templatesPath: 'CleanCode/templates',
    templateVariants: ['javascript', 'python', 'dotnet'],
    setupGuide:
      'Veja CleanCode/04-ferramentas.md. Se o projeto já tinha configuração de lint (arquivo mantido), ' +
      'proponha mesclar as regras em vez de substituir. Ao rodar o linter, não corrija o legado inteiro sem o usuário pedir.',
    guardsBash: false,
  },
]

const COMMAND = 'conventions'
const USAGE = [
  `Uso: /${COMMAND} <ação> [convenção] [stack]`,
  '',
  '  status              mostra o que está ativo neste projeto',
  '  enable <convenção>  ativa a convenção SOMENTE neste projeto',
  '  disable <convenção> desativa a convenção neste projeto',
  '  setup <convenção> [stack]  copia os templates para o projeto (não sobrescreve)',
  '  release on|off      autoriza (ou não) o agente a executar os passos de release do gitflow neste projeto',
  '',
  ...CONVENTIONS.map(c =>
    `  ${c.id}${c.templateVariants ? ` (stacks: ${c.templateVariants.join(', ')})` : ''} — ${c.title}`,
  ),
].join('\n')

const findConvention = (id: string | undefined) => CONVENTIONS.find(c => c.id === id)

const activeConventions = (state: ProjectState) => CONVENTIONS.filter(c => state.enabled.has(c.id))

const releaseNote = (state: ProjectState) =>
  state.releaseAgent
    ? 'Autorização de release: ATIVA neste projeto. Quando o usuário pedir uma release ou hotfix, execute os passos de "Uso diário" de GitFlow/05-automacao.md de ponta a ponta, conferindo cada workflow (gh run watch) antes do próximo passo e parando no primeiro erro.'
    : 'Autorização de release: INATIVA neste projeto. Para passos de release (release/*, tags v*, PRs para production/main, reset de staging) mostre os comandos ao usuário; ele pode autorizar com /conventions release on.'

async function sectionText($: EngineInterface, convention: Convention, state: ProjectState): Promise<string> {
  const rules = await rulesOf($, convention)
  return convention.id === 'gitflow' ? `${rules}\n\n${releaseNote(state)}` : rules
}

async function rulesOf($: EngineInterface, convention: Convention): Promise<string> {
  const text = await $.fs.read(`${$.plugin.root}/${convention.rulesPath}`)
  return String(text)
}

async function currentBranch($: EngineInterface, root: string): Promise<string | undefined> {
  const run = await $.process.run(['git', 'symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: root })
  return run.exitCode === 0 ? run.stdout.trim() : undefined
}

async function guardBash($: EngineInterface, id: string, command: string, state: ProjectState): Promise<string | undefined> {
  if (id === 'gitflow') {
    return checkCommand(command, {
      currentBranch: () => currentBranch($, state.root),
      releaseAuthorized: state.releaseAgent,
    })
  }
  return undefined
}

function statusLine($: EngineInterface, state: ProjectState) {
  const active = activeConventions(state)
  $.ui.status(active.length > 0 ? `conventions: ${active.map(c => c.id).join(', ')}` : undefined)
}

export const register: Register = (on, options) => {
  const blockedPatterns = parsePatterns(options.blockedRemotes)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Ativa/desativa convenções (GitFlow etc.) apenas neste projeto',
      argumentHint: '[status|enable|disable|setup|release] [convenção|on|off]',
    })
    const state = await projectState($, blockedPatterns).catch(() => undefined)
    if (state) statusLine($, state)
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const state = await projectState($, blockedPatterns)
    const active = activeConventions(state)
    if (active.length === 0) return composed

    const sections = await Promise.all(
      active.map(async c => ({
        id: `conventions-code:${c.id}`,
        text: `# Convenção ativa neste projeto: ${c.title}\n\n${await sectionText($, c, state)}`,
        scope: 'session' as const,
      })),
    )
    return { sections: [...composed.sections, ...sections] }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!/\b(git|gh)\b/.test(e.command)) return next(e)

    const state = await projectState($, blockedPatterns).catch(() => undefined)
    const guarded = state ? activeConventions(state).filter(c => c.guardsBash) : []
    if (!state || guarded.length === 0) return next(e)

    for (const convention of guarded) {
      const issue = await guardBash($, convention.id, e.command, state).catch(
        (error: unknown) => `não foi possível validar o comando (${String(error)}).`,
      )
      if (issue) return { deny: `[conventions-code/${convention.id}] ${issue}` }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND }, async ($, e) => {
    const [action = 'status', id, variant] = e.args.trim().split(/\s+/).filter(Boolean)
    const state = await projectState($, blockedPatterns)

    if (action === 'status') {
      const active = activeConventions(state)
      const lines = [
        `Projeto: ${state.root}`,
        state.blockedBy
          ? `Bloqueado: o remote/caminho casa com "${state.blockedBy}" (blockedRemotes). Nenhuma convenção é aplicada aqui.`
          : `Ativas: ${active.length > 0 ? active.map(c => c.id).join(', ') : 'nenhuma'} (${MARKER_PATH})`,
        `Autorização de release do gitflow: ${state.releaseAgent ? 'ativa' : 'inativa'}`,
        '',
        USAGE,
      ]
      return { text: lines.join('\n') }
    }

    if (action === 'release') {
      if (state.blockedBy) return { text: `Recusado: este projeto casa com o padrão bloqueado "${state.blockedBy}".` }
      if (!state.enabled.has('gitflow')) return { text: `Ative antes: /${COMMAND} enable gitflow` }
      if (id !== 'on' && id !== 'off') {
        return { text: `Autorização de release: ${state.releaseAgent ? 'ativa' : 'inativa'}. Use /${COMMAND} release on|off.` }
      }
      const marker = await readMarker($, state.root)
      const authorized = id === 'on'
      await writeMarker($, state.root, authorized ? { ...marker, releaseAgent: true } : { enabled: marker.enabled })
      const next = { ...state, releaseAgent: authorized }
      return {
        text: authorized
          ? `Agente autorizado a executar os passos de release do gitflow em ${state.root}.`
          : `Autorização de release revogada em ${state.root}.`,
        context: [releaseNote(next)],
      }
    }

    const convention = findConvention(id)
    if (!convention) return { text: `Convenção desconhecida: "${id ?? ''}".\n\n${USAGE}` }

    if (state.blockedBy) {
      return {
        text: `Recusado: este projeto casa com o padrão bloqueado "${state.blockedBy}" (opção blockedRemotes do plugin).`,
      }
    }

    const marker = await readMarker($, state.root)
    const isEnabled = marker.enabled.includes(convention.id)

    if (action === 'enable') {
      if (!isEnabled) await writeMarker($, state.root, { ...marker, enabled: [...marker.enabled, convention.id] })
      statusLine($, { ...state, enabled: new Set([...marker.enabled, convention.id]) })
      return {
        text: `${convention.title} ativada em ${state.root} (${MARKER_PATH}).`,
        context: [
          `A convenção "${convention.id}" foi ativada SOMENTE neste projeto (${state.root}). A partir de agora siga estas regras:\n\n${await sectionText($, convention, state)}`,
        ],
      }
    }

    if (action === 'disable') {
      const enabled = marker.enabled.filter(m => m !== convention.id)
      await writeMarker($, state.root, convention.id === 'gitflow' ? { enabled } : { ...marker, enabled })
      statusLine($, { ...state, enabled: new Set(enabled) })
      return {
        text: `${convention.title} desativada em ${state.root}.`,
        context: [`A convenção "${convention.id}" foi desativada neste projeto; desconsidere as regras dela daqui em diante.`],
      }
    }

    if (action === 'setup') {
      if (!isEnabled) return { text: `Ative antes: /${COMMAND} enable ${convention.id}` }
      if (!convention.templatesPath) return { text: `${convention.id} não possui templates.` }
      const variants = convention.templateVariants
      if (variants && !variants.includes(variant ?? '')) {
        return { text: `Informe a stack: /${COMMAND} setup ${convention.id} <${variants.join('|')}>` }
      }
      const source = variants ? `${convention.templatesPath}/${variant}` : convention.templatesPath
      const report = await copyTemplates($, `${$.plugin.root}/${source}`, state.root)
      const lines = [
        `Templates de ${convention.id}${variants ? ` (${variant})` : ''} em ${state.root}:`,
        ...report.created.map(f => `  + ${f}`),
        ...report.skipped.map(f => `  = ${f} (já existia, não alterado)`),
      ]
      return {
        text: lines.join('\n'),
        context: [
          `Templates copiados para o projeto: ${report.created.join(', ') || 'nenhum'}. ` +
            `Já existentes (não alterados): ${report.skipped.join(', ') || 'nenhum'}. ` +
            `Documentação em ${$.plugin.root}/${convention.docsPath}. ${convention.setupGuide ?? ''}`,
        ],
      }
    }

    return { text: `Ação desconhecida: "${action}".\n\n${USAGE}` }
  })
}
