import { invocationOf, resolveMessage, splitSegments } from '../shared/shell'
import {
  BACKUP,
  PRODUCTION,
  RELEASE_LOCKED,
  STAGING,
  branchName,
  checkCommitHeader,
  checkNewBranch,
  checkPullRequestRoute,
  checkSyncSource,
  checkVersionTagName,
  isProtectedBranch,
  isReleaseBranch,
  isVersionTag,
} from './rules'

export type GitContext = {
  currentBranch: () => Promise<string | undefined>
  releaseAuthorized: boolean
}

type Scan = {
  args: readonly string[]
  ctx: GitContext
  branchOverride: string | undefined
}

const positionals = (args: readonly string[], withValue: ReadonlySet<string>): string[] => {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--') {
      out.push(...args.slice(i + 1))
      break
    }
    if (arg.startsWith('-')) {
      if (withValue.has(arg)) i++
      continue
    }
    out.push(arg)
  }
  return out
}

const valueOf = (args: readonly string[], names: readonly string[]): string | undefined => {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    for (const name of names) {
      if (arg === name) return args[i + 1]
      if (name.startsWith('--') && arg.startsWith(`${name}=`)) return arg.slice(name.length + 1)
    }
  }
  return undefined
}

const currentBranch = async (scan: Scan) => scan.branchOverride ?? (await scan.ctx.currentBranch())

const SWITCH_CREATE = new Set(['-c', '-C', '--create', '--force-create', '--orphan'])
const CHECKOUT_CREATE = new Set(['-b', '-B', '--orphan'])

type Creation = { name: string; start: string | undefined }

const createdBranch = (sub: string, args: readonly string[]): Creation | undefined => {
  if (sub === 'switch') {
    const name = valueOf(args, [...SWITCH_CREATE])
    return name === undefined ? undefined : { name, start: positionals(args, SWITCH_CREATE)[0] }
  }
  if (sub === 'checkout') {
    const name = valueOf(args, [...CHECKOUT_CREATE])
    return name === undefined ? undefined : { name, start: positionals(args, CHECKOUT_CREATE)[0] }
  }
  if (sub === 'worktree' && args[0] === 'add') {
    const rest = args.slice(1)
    const name = valueOf(rest, ['-b', '-B'])
    return name === undefined ? undefined : { name, start: positionals(rest, new Set(['-b', '-B']))[1] }
  }
  if (sub === 'branch') {
    const passive = args.some(a => a.startsWith('-') && !['-f', '--force', '-t', '--track', '--no-track'].includes(a))
    if (passive) return undefined
    const [name, start] = positionals(args, new Set())
    return name === undefined ? undefined : { name, start }
  }
  return undefined
}

const switchedBranch = (sub: string, args: readonly string[]): string | undefined => {
  if (sub !== 'switch' && sub !== 'checkout') return undefined
  const names = positionals(args, new Set(['-c', '-C', '-b', '-B', '--create', '--orphan']))
  return names.length === 1 && !args.includes('--') ? names[0] : undefined
}

const commitMessage = (args: readonly string[]): string | undefined | null => {
  if (args.some(a => /^(-F|--file|-C|-c|--reuse-message|--reedit-message|--fixup|--squash)(=|$)/.test(a))) {
    return null
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '-m' || arg === '--message' || /^-[a-z]*m$/.test(arg)) return args[i + 1]
    if (arg.startsWith('--message=')) return arg.slice('--message='.length)
    if (/^-m.+/.test(arg)) return arg.slice(2)
  }
  return undefined
}

async function checkCreation(created: Creation, scan: Scan): Promise<string | undefined> {
  const start = created.start ?? (await currentBranch(scan))
  const issue = checkNewBranch(created.name, start)
  if (issue) return issue
  if (created.name.startsWith('release/') && !scan.ctx.releaseAuthorized) {
    return `criar ${created.name} ${RELEASE_LOCKED}`
  }
  return undefined
}

async function checkCommit(scan: Scan): Promise<string | undefined> {
  const branch = await currentBranch(scan)
  const raw = commitMessage(scan.args)
  if (branch && isProtectedBranch(branch)) {
    return `commit direto em ${branch} não é permitido. Crie uma branch feature/*, bugfix/*, hotfix/* ou chore/* a partir de ${PRODUCTION} e abra um PR.`
  }
  if (branch === STAGING && typeof raw === 'string') {
    return `${STAGING} só recebe merges de feature/*, bugfix/* e chore/*; não faça commit direto nela.`
  }
  if (raw === null || raw === undefined) return undefined
  const message = resolveMessage(raw)
  return message === undefined ? undefined : checkCommitHeader(message)
}

const MERGE_WITH_VALUE = new Set(['-m', '--message', '-F', '--file', '-s', '--strategy', '-X', '--strategy-option', '--onto'])

async function checkIntegration(sub: string, scan: Scan): Promise<string | undefined> {
  if (scan.args.includes('--abort') || scan.args.includes('--continue') || scan.args.includes('--skip')) return undefined

  if (sub === 'merge' || sub === 'rebase' || sub === 'pull') {
    const refs = positionals(scan.args, MERGE_WITH_VALUE)
    for (const ref of sub === 'pull' ? refs.slice(1) : refs) {
      const issue = checkSyncSource(ref)
      if (issue) return issue
    }
  }

  if (sub === 'pull') return undefined
  const branch = await currentBranch(scan)
  if (!branch || !isProtectedBranch(branch)) return undefined
  if (sub === 'revert' && isReleaseBranch(branch)) {
    return scan.ctx.releaseAuthorized ? undefined : `revert em ${branch} ${RELEASE_LOCKED}`
  }
  return `git ${sub} em ${branch} não é permitido localmente; ${branch} só muda via PR.`
}

const PUSH_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])

async function checkPush(scan: Scan): Promise<string | undefined> {
  const { args, ctx } = scan
  if (args.some(a => a === '--mirror' || a === '--all' || a === '--tags' || a === '--follow-tags')) {
    return `push em massa (--all/--mirror/--tags/--follow-tags) não é permitido; envie cada ref pelo nome.`
  }
  const hardForce = args.some(a => a === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a))
  const lease = args.some(a => /^--force-(with-lease|if-includes)(=|$)/.test(a))
  const deleting = args.some(a => a === '--delete' || a === '-d')
  const [, ...refspecs] = positionals(args, PUSH_WITH_VALUE)

  const targets: { dst: string; force: boolean; remove: boolean }[] = []
  if (refspecs.length === 0) {
    const branch = await currentBranch(scan)
    if (branch) targets.push({ dst: branch, force: hardForce, remove: deleting })
  }
  for (const spec of refspecs) {
    const force = hardForce || spec.startsWith('+')
    const clean = spec.replace(/^\+/, '')
    const [src = '', dst] = clean.split(':')
    let target = dst === undefined ? src : dst
    if (target === 'HEAD') target = (await currentBranch(scan)) ?? target
    targets.push({ dst: target, force, remove: deleting || (dst !== undefined && src === '') })
  }

  for (const target of targets) {
    if (target.dst.startsWith('refs/tags/') || isVersionTag(target.dst)) {
      if (target.remove || target.force) return `tags de versão são imutáveis; não mova nem apague ${target.dst}.`
      const issue = checkVersionTagName(target.dst)
      if (issue) return issue
      if (!ctx.releaseAuthorized) return `push da tag ${target.dst} ${RELEASE_LOCKED}`
      continue
    }

    const branch = branchName(target.dst)
    const rewrites = target.force || lease

    if (branch === PRODUCTION || branch === BACKUP) {
      if (target.remove) return `remover ${branch} não é permitido.`
      return `push direto para ${branch} não é permitido; ${branch} só muda via PR.`
    }
    if (branch.startsWith('release/')) {
      if (!isReleaseBranch(branch)) return `"${branch}" fora do padrão; branches de release usam release/vX.Y.Z.`
      if (rewrites) return `force push em ${branch} não é permitido.`
      if (!ctx.releaseAuthorized) return `push em ${branch} ${RELEASE_LOCKED}`
      continue
    }
    if (branch === STAGING) {
      if (target.remove) return `remover ${STAGING} não é permitido.`
      if (rewrites && !ctx.releaseAuthorized) return `resetar ${STAGING} ${RELEASE_LOCKED}`
      continue
    }
    if (target.force) {
      return `force push sem lease não é permitido; use --force-with-lease em branches de trabalho.`
    }
  }
  return undefined
}

const TAG_WITH_VALUE = new Set(['-m', '--message', '-F', '--file', '-u', '--local-user', '--cleanup'])
const TAG_PASSIVE = /^(-l|--list|-n\d*|--contains|--no-contains|--merged|--no-merged|--points-at|--sort|--format|-v|--verify|--column|--no-column)(=|$)/
const TAG_REMOVE_OR_MOVE = /^(-d|--delete|-f|--force)$|^-[a-zA-Z]*[df][a-zA-Z]*$/
const TAG_ANNOTATED = /^(-a|--annotate|-s|--sign|-u|--local-user|-m|--message|-F|--file)(=|$)|^-[a-zA-Z]*[asm][a-zA-Z]*$/

function checkTag(args: readonly string[], ctx: GitContext): string | undefined {
  if (args.some(a => TAG_PASSIVE.test(a))) return undefined
  const [name] = positionals(args, TAG_WITH_VALUE)
  if (!name || !isVersionTag(name)) return undefined
  if (args.some(a => TAG_REMOVE_OR_MOVE.test(a))) return `tags de versão são imutáveis; não mova nem apague ${name}.`
  const issue = checkVersionTagName(name)
  if (issue) return issue
  if (!args.some(a => TAG_ANNOTATED.test(a))) {
    return `tag ${name} precisa ser anotada: git tag -a ${name} -m "..." (o release.yml recusa tags leves).`
  }
  return ctx.releaseAuthorized ? undefined : `criar a tag ${name} ${RELEASE_LOCKED}`
}

async function checkPullRequestCreate(scan: Scan): Promise<string | undefined> {
  const { args } = scan
  const title = valueOf(args, ['--title', '-t'])
  if (title !== undefined) {
    const titleIssue = checkCommitHeader(title)
    if (titleIssue) return `título do PR: ${titleIssue}`
  }
  const base = valueOf(args, ['--base', '-B']) ?? BACKUP
  const head = valueOf(args, ['--head', '-H']) ?? (await currentBranch(scan))
  if (!head) return undefined
  const routeIssue = checkPullRequestRoute(head, base)
  if (routeIssue) return routeIssue
  if ((base === BACKUP || (base === PRODUCTION && isReleaseBranch(head))) && !scan.ctx.releaseAuthorized) {
    return `PR de ${head} para ${base} ${RELEASE_LOCKED}`
  }
  return undefined
}

export async function checkCommand(command: string, ctx: GitContext): Promise<string | undefined> {
  let branchOverride: string | undefined

  for (const segment of splitSegments(command)) {
    const call = invocationOf(segment)
    if (!call) continue
    const [sub = '', ...args] = call.args
    const scan: Scan = { args, ctx, branchOverride }

    if (call.program === 'gh') {
      if (sub === 'pr' && args[0] === 'create') {
        const issue = await checkPullRequestCreate({ ...scan, args: args.slice(1) })
        if (issue) return issue
      }
      continue
    }

    const created = createdBranch(sub, args)
    if (created !== undefined) {
      const issue = await checkCreation(created, scan)
      if (issue) return issue
      if (sub !== 'branch' && sub !== 'worktree') branchOverride = created.name
      continue
    }

    const switched = switchedBranch(sub, args)
    if (switched !== undefined) {
      branchOverride = branchName(switched)
      continue
    }

    let issue: string | undefined
    if (sub === 'commit') issue = await checkCommit(scan)
    else if (['merge', 'cherry-pick', 'revert', 'rebase', 'pull'].includes(sub)) issue = await checkIntegration(sub, scan)
    else if (sub === 'push') issue = await checkPush(scan)
    else if (sub === 'tag') issue = checkTag(args, ctx)
    if (issue) return issue
  }

  return undefined
}
