import { BACKUP, PRODUCTION, STAGING } from './rules'

export type GitResult = { exitCode: number; stdout: string; stderr: string }
export type GitRun = (args: readonly string[]) => Promise<GitResult>

const PERMANENT = [PRODUCTION, BACKUP, STAGING] as const

async function remoteHeads(git: GitRun): Promise<Set<string> | undefined> {
  const run = await git(['ls-remote', '--heads', 'origin'])
  if (run.exitCode !== 0) return undefined
  const heads = run.stdout
    .split('\n')
    .map(line => line.split('\t')[1]?.trim().replace(/^refs\/heads\//, ''))
    .filter((head): head is string => Boolean(head))
  return new Set(heads)
}

async function commitOf(git: GitRun, ref: string): Promise<string | undefined> {
  const run = await git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
  return run.exitCode === 0 ? run.stdout.trim() : undefined
}

async function publish(git: GitRun, sha: string, branch: string): Promise<string | undefined> {
  const run = await git(['push', 'origin', `${sha}:refs/heads/${branch}`])
  return run.exitCode === 0 ? undefined : run.stderr.trim() || `git push saiu com ${run.exitCode}`
}

export async function bootstrapBranches(git: GitRun, source: string | undefined): Promise<string[]> {
  const remote = await remoteHeads(git)
  if (!remote) return ['  ! sem acesso ao remote origin; configure-o e rode o setup de novo.']

  const lines: string[] = []

  if (remote.has(PRODUCTION)) {
    if (source) lines.push(`  = ${PRODUCTION} já existe em origin; ref "${source}" ignorada.`)
  } else {
    if (!source) {
      return [
        `  ! ${PRODUCTION} não existe em origin. Rode /conventions setup gitflow <ref> com o commit que está no ar (ex.: main).`,
      ]
    }
    const sha = await commitOf(git, source)
    if (!sha) return [`  ! ref "${source}" não encontrada.`]
    const failure = await publish(git, sha, PRODUCTION)
    if (failure) return [`  ! falha ao criar ${PRODUCTION} em origin: ${failure}`]
    remote.add(PRODUCTION)
    lines.push(`  + ${PRODUCTION} criada em origin a partir de ${source} (${sha.slice(0, 7)})`)
  }

  await git(['fetch', 'origin', '--quiet'])

  if (!remote.has(BACKUP)) {
    const sha = await commitOf(git, `origin/${PRODUCTION}`)
    const failure = sha ? await publish(git, sha, BACKUP) : `origin/${PRODUCTION} não encontrada após o fetch`
    if (failure) return [...lines, `  ! falha ao criar ${BACKUP} em origin: ${failure}`]
    remote.add(BACKUP)
    lines.push(`  + ${BACKUP} criada em origin a partir de ${PRODUCTION}`)
    await git(['fetch', 'origin', '--quiet'])
  }

  for (const branch of PERMANENT) {
    if (!remote.has(branch)) {
      lines.push(`  = ${branch} não existe (opcional; só com homologação, a partir de ${PRODUCTION}).`)
      continue
    }
    if (await commitOf(git, `refs/heads/${branch}`)) {
      lines.push(`  = ${branch} local já existe`)
      continue
    }
    const tracked = await git(['branch', '--track', branch, `origin/${branch}`])
    lines.push(
      tracked.exitCode === 0
        ? `  + ${branch} local acompanhando origin/${branch}`
        : `  ! falha ao criar ${branch} local: ${tracked.stderr.trim()}`,
    )
  }

  const tags = await git(['tag', '-l', 'v*', '--merged', `origin/${PRODUCTION}`])
  if (tags.exitCode === 0 && tags.stdout.trim() === '') {
    lines.push(`  ! nenhuma tag vX.Y.Z em ${PRODUCTION}; crie a tag anotada inicial (ex.: v0.1.0) conforme o checklist.`)
  }

  return lines
}
