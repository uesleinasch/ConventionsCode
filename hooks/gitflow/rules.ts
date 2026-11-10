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

const HEADER = new RegExp(
  `^(${COMMIT_TYPES.join('|')})(\\([a-z0-9][a-z0-9._/-]*\\))?!?: [a-z](.*[^.\\s])?$`,
)

const WORK_BRANCH = /^(feature|bugfix|hotfix|chore)\/[a-z0-9]+(-[a-z0-9]+)*$/
const RELEASE_BRANCH = /^release\/v[0-9]+\.[0-9]+\.[0-9]+$/
const VERSION_TAG = /^v[0-9]/

export function isProtectedBranch(branch: string): boolean {
  return branch === 'main' || branch === 'production' || branch.startsWith('release/')
}

export function isVersionTag(name: string): boolean {
  return VERSION_TAG.test(name.replace(/^refs\/tags\//, ''))
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

export function checkNewBranch(name: string): string | undefined {
  if (name.startsWith('release/')) {
    return `branches release/* são criadas apenas pelo workflow cut-release (bot de release).`
  }
  if (name === 'main' || name === 'production') {
    return `${name} é uma branch permanente.`
  }
  if (!WORK_BRANCH.test(name)) {
    return (
      `"${name}" não segue Conventional Branch. ` +
      `Use feature/, bugfix/, hotfix/ ou chore/ + descrição em minúsculas com hífens (ex.: feature/issue-42-export-csv).`
    )
  }
  return undefined
}

export function checkPullRequestRoute(head: string, base: string): string | undefined {
  const isBot = head.startsWith('dependabot/')
  if (base === 'main') {
    const ok =
      (/^(feature|bugfix|chore)\//.test(head) && WORK_BRANCH.test(head)) ||
      RELEASE_BRANCH.test(head) ||
      isBot
    return ok ? undefined : `PR de "${head}" para main não é permitido (aceita feature/*, bugfix/*, chore/* e back-merge release/v*).`
  }
  if (RELEASE_BRANCH.test(base)) {
    const ok = /^(bugfix|hotfix|chore)\//.test(head) && WORK_BRANCH.test(head)
    return ok ? undefined : `PR de "${head}" para ${base} não é permitido (aceita bugfix/*, hotfix/*, chore/*).`
  }
  if (base === 'production') {
    return `production não recebe PR; é atualizada só pelo workflow promote.`
  }
  return `PRs para "${base}" não são permitidos (destinos: main ou release/vX.Y.Z).`
}
