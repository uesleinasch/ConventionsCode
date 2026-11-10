import { invocationOf, resolveMessage, splitSegments } from '../shared/shell'
import {
  checkCommitHeader,
  checkNewBranch,
  checkPullRequestRoute,
  isProtectedBranch,
  isVersionTag,
} from './rules'

export type GitContext = {
  currentBranch: () => Promise<string | undefined>
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

const createdBranch = (sub: string, args: readonly string[]): string | undefined => {
  if (sub === 'switch') return valueOf(args, ['-c', '-C', '--create', '--force-create', '--orphan'])
  if (sub === 'checkout') return valueOf(args, ['-b', '-B', '--orphan'])
  if (sub === 'worktree' && args[0] === 'add') return valueOf(args, ['-b', '-B'])
  if (sub === 'branch') {
    const passive = args.some(a => a.startsWith('-') && !['-f', '--force', '-t', '--track', '--no-track'].includes(a))
    return passive ? undefined : positionals(args, new Set())[0]
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

async function checkCommit(scan: Scan): Promise<string | undefined> {
  const branch = await currentBranch(scan)
  if (branch && isProtectedBranch(branch)) {
    return `commit direto em ${branch} não é permitido. Crie uma branch feature/*, bugfix/*, hotfix/* ou chore/* e abra um PR.`
  }
  const raw = commitMessage(scan.args)
  if (raw === null || raw === undefined) return undefined
  const message = resolveMessage(raw)
  return message === undefined ? undefined : checkCommitHeader(message)
}

async function checkHistoryRewrite(sub: string, scan: Scan): Promise<string | undefined> {
  const branch = await currentBranch(scan)
  return branch && isProtectedBranch(branch)
    ? `git ${sub} em ${branch} não é permitido localmente; ${branch} só muda via PR ou workflow de release.`
    : undefined
}

const PUSH_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])

async function checkPush(scan: Scan): Promise<string | undefined> {
  const { args } = scan
  if (args.some(a => a === '--mirror' || a === '--all' || a === '--tags' || a === '--follow-tags')) {
    return `push em massa (--all/--mirror/--tags/--follow-tags) não é permitido; tags de versão são criadas só pelo bot de release.`
  }
  const hardForce = args.some(a => a === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a))
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
      return `push de tag de versão (${target.dst}) não é permitido; tags v* são criadas só pelo bot de release.`
    }
    const branch = target.dst.replace(/^refs\/heads\//, '')
    if (isProtectedBranch(branch)) {
      return target.remove
        ? `remover ${branch} não é permitido.`
        : `push direto para ${branch} não é permitido; use PR (ou os workflows de release para production/release/*).`
    }
    if (target.force) {
      return `force push sem lease não é permitido; use --force-with-lease em branches de trabalho.`
    }
  }
  return undefined
}

const TAG_WITH_VALUE = new Set(['-m', '--message', '-F', '--file', '-u', '--local-user', '--cleanup'])
const TAG_PASSIVE = /^(-l|--list|-n\d*|--contains|--no-contains|--merged|--no-merged|--points-at|--sort|--format|-v|--verify|--column|--no-column)(=|$)/

function checkTag(args: readonly string[]): string | undefined {
  if (args.some(a => TAG_PASSIVE.test(a))) return undefined
  const [name] = positionals(args, TAG_WITH_VALUE)
  if (!name || !isVersionTag(name)) return undefined
  return `tags de versão (${name}) são criadas/removidas só pelo bot de release (workflows release-candidate e promote).`
}

async function checkPullRequestCreate(scan: Scan): Promise<string | undefined> {
  const { args } = scan
  const title = valueOf(args, ['--title', '-t'])
  if (title !== undefined) {
    const titleIssue = checkCommitHeader(title)
    if (titleIssue) return `título do PR: ${titleIssue}`
  }
  const base = valueOf(args, ['--base', '-B']) ?? 'main'
  const head = valueOf(args, ['--head', '-H']) ?? (await currentBranch(scan))
  return head ? checkPullRequestRoute(head, base) : undefined
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
      const issue = checkNewBranch(created)
      if (issue) return issue
      if (sub !== 'branch' && sub !== 'worktree') branchOverride = created
      continue
    }

    const switched = switchedBranch(sub, args)
    if (switched !== undefined) {
      branchOverride = switched
      continue
    }

    let issue: string | undefined
    if (sub === 'commit') issue = await checkCommit(scan)
    else if (sub === 'merge' || sub === 'cherry-pick' || sub === 'revert' || sub === 'rebase') {
      issue = args.includes('--abort') || args.includes('--continue') ? undefined : await checkHistoryRewrite(sub, scan)
    } else if (sub === 'push') issue = await checkPush(scan)
    else if (sub === 'tag') issue = checkTag(args)
    if (issue) return issue
  }

  return undefined
}
