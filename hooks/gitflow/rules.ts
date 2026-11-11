export const COMMIT_TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'test',
  'build',
  'ci',
  'style',
  'chore',
  'revert',
] as const

export const HEADER_MAX_LENGTH = 100

export const PRODUCTION = 'production'
export const BACKUP = 'main'
export const STAGING = 'staging'

export const RELEASE_LOCKED =
  'é um passo de release do mantenedor. Autorize o agente neste projeto com /conventions release on, ou execute você mesmo.'

const HEADER = new RegExp(
  `^(${COMMIT_TYPES.join('|')})(\\([a-z0-9][a-z0-9._/-]*\\))?!?: [a-z](.*[^.\\s])?$`,
)

const WORK_BRANCH = /^(feature|bugfix|hotfix|chore)\/[a-z0-9]+(-[a-z0-9]+)*$/
const RELEASE_BRANCH = /^release\/v[0-9]+\.[0-9]+\.[0-9]+$/
const VERSION_TAG = /^v[0-9]/
const RELEASE_TAG = /^v[0-9]+\.[0-9]+\.[0-9]+$/

export function branchName(ref: string): string {
  return ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/[^/]+\//, '').replace(/^origin\//, '')
}

export function isProtectedBranch(branch: string): boolean {
  return branch === PRODUCTION || branch === BACKUP || branch.startsWith('release/')
}

export function isReleaseBranch(branch: string): boolean {
  return RELEASE_BRANCH.test(branch)
}

export function isKnownBranch(branch: string): boolean {
  return (
    branch === PRODUCTION ||
    branch === BACKUP ||
    branch === STAGING ||
    branch.startsWith('release/') ||
    WORK_BRANCH.test(branch)
  )
}

export function isVersionTag(name: string): boolean {
  return VERSION_TAG.test(name.replace(/^refs\/tags\//, ''))
}

export function checkVersionTagName(name: string): string | undefined {
  const tag = name.replace(/^refs\/tags\//, '')
  return RELEASE_TAG.test(tag) ? undefined : `tag de versão "${tag}" fora do padrão; use vX.Y.Z.`
}

export function checkCommitHeader(message: string): string | undefined {
  const header = message.split('\n')[0]!.trim()
  if (header.length > HEADER_MAX_LENGTH) {
    return `cabeçalho do commit com ${header.length} caracteres (máximo ${HEADER_MAX_LENGTH}).`
  }
  if (!HEADER.test(header)) {
    return (
      `"${header}" não segue Conventional Commits. ` +
      `Formato: <tipo>(escopo opcional)!: descrição em minúscula sem ponto final. ` +
      `Tipos: ${COMMIT_TYPES.join(', ')}.`
    )
  }
  return undefined
}

export function checkNewBranch(name: string, start: string | undefined): string | undefined {
  const origin = start === undefined ? undefined : branchName(start)
  const fromOther = origin !== undefined && isKnownBranch(origin) && origin !== PRODUCTION

  if (name === PRODUCTION || name === BACKUP || name === STAGING) {
    return `${name} é uma branch permanente.`
  }
  if (name.startsWith('release/')) {
    if (!RELEASE_BRANCH.test(name)) return `"${name}" fora do padrão; branches de release usam release/vX.Y.Z.`
    return fromOther ? `${name} deve nascer de ${PRODUCTION}, não de ${origin}.` : undefined
  }
  if (!WORK_BRANCH.test(name)) {
    return (
      `"${name}" não segue Conventional Branch. ` +
      `Use feature/, bugfix/, hotfix/ ou chore/ + descrição em minúsculas com hífens (ex.: feature/issue-42-export-csv).`
    )
  }
  if (origin === STAGING) return `${STAGING} é destino, nunca origem: crie ${name} a partir de ${PRODUCTION}.`
  if (fromOther && origin !== undefined && !RELEASE_BRANCH.test(origin)) return `${name} deve nascer de ${PRODUCTION}, não de ${origin}.`
  return undefined
}

export function checkSyncSource(ref: string): string | undefined {
  const source = branchName(ref)
  if (source === STAGING) {
    return `${STAGING} é destino, nunca origem: sincronize com git rebase origin/${PRODUCTION}.`
  }
  if (source === BACKUP) {
    return `${BACKUP} é só backup: sincronize com git rebase origin/${PRODUCTION}.`
  }
  return undefined
}

const WORK = /^(feature|bugfix|chore)\//

export function checkPullRequestRoute(head: string, base: string): string | undefined {
  const isWork = WORK.test(head) && WORK_BRANCH.test(head)
  if (base === PRODUCTION) {
    const ok =
      RELEASE_BRANCH.test(head) ||
      (head.startsWith('hotfix/') && WORK_BRANCH.test(head)) ||
      head.startsWith('dependabot/')
    return ok ? undefined : `PR de "${head}" para ${PRODUCTION} não é permitido (aceita release/vX.Y.Z, hotfix/* e dependabot/*).`
  }
  if (RELEASE_BRANCH.test(base)) {
    return isWork ? undefined : `PR de "${head}" para ${base} não é permitido (aceita feature/*, bugfix/*, chore/*).`
  }
  if (base === BACKUP) {
    return head === PRODUCTION
      ? undefined
      : `${BACKUP} é o backup estável: só recebe PR de ${PRODUCTION}. Para trabalho, use --base release/vX.Y.Z, --base ${STAGING} ou --base ${PRODUCTION} (hotfix).`
  }
  if (base === STAGING) {
    return isWork ? undefined : `PR de "${head}" para ${STAGING} não é permitido (aceita feature/*, bugfix/*, chore/*).`
  }
  return `PRs para "${base}" não são permitidos (destinos: ${PRODUCTION}, release/vX.Y.Z, ${STAGING} ou ${BACKUP}).`
}
