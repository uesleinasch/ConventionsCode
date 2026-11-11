import { describe, expect, test } from 'claude-code/testing'

import { checkCommand } from '../hooks/gitflow/guard'

const on = (branch: string | undefined, releaseAuthorized = false) => ({
  currentBranch: async () => branch,
  releaseAuthorized,
})

const allowed = async (command: string, branch = 'feature/x', authorized = false) =>
  expect(await checkCommand(command, on(branch, authorized))).toBeUndefined()

const denied = async (command: string, branch = 'feature/x', match?: RegExp, authorized = false) => {
  const issue = await checkCommand(command, on(branch, authorized))
  expect(issue).toBeDefined()
  if (match) expect(issue).toMatch(match)
}

const authorized = (command: string, branch = 'feature/x') => allowed(command, branch, true)

describe('branches', () => {
  test('aceita branches de trabalho nascendo de production', async () => {
    await allowed('git switch -c feature/issue-42-export-csv', 'production')
    await allowed('git checkout -b bugfix/null-on-save origin/production', 'staging')
    await allowed('git branch chore/bump-node-22 production')
    await allowed('git worktree add ../wt -b hotfix/cve-2026-1234 origin/production')
  })

  test('recusa nomes fora do padrão', async () => {
    await denied('git switch -c Feature/Export_CSV', 'production', /Conventional Branch/)
    await denied('git checkout -b misc/cleanup', 'production')
    await denied('git checkout -b feature/v1.2', 'production')
    await denied('git switch -c release/1.2', 'production', /release\/vX.Y.Z/, true)
  })

  test('recusa nascer de staging ou main', async () => {
    await denied('git switch -c feature/nova', 'staging', /destino, nunca origem/)
    await denied('git switch -c feature/nova origin/staging', 'production', /destino, nunca origem/)
    await denied('git switch -c feature/nova', 'main', /production/)
    await allowed('git switch -c chore/remove-proj-456 origin/release/v1.4.0', 'production')
  })

  test('release exige autorização e nasce de production', async () => {
    await denied('git switch -c release/v1.2.0', 'production', /\/conventions release on/)
    await authorized('git switch -c release/v1.2.0 origin/production', 'staging')
    await denied('git switch -c release/v1.2.0', 'staging', /production/, true)
  })

  test('ignora operações que não criam branch', async () => {
    await allowed('git branch -d feature/old')
    await allowed('git branch --show-current')
    await allowed('git switch production')
  })
})

describe('commits', () => {
  test('aceita Conventional Commits', async () => {
    await allowed('git commit -m "feat(auth): adiciona login com SSO"')
    await allowed("git commit -am 'fix: corrige timeout'")
    await allowed('git add . && git commit -m "feat(api)!: remove endpoint v1" -m "BREAKING CHANGE: use v2"')
    await allowed('git commit --amend --no-edit')
    await allowed('git commit -F msg.txt')
  })

  test('recusa mensagens fora do padrão', async () => {
    await denied('git commit -m "ajustes"', 'feature/x', /Conventional Commits/)
    await denied('git commit -m "Feat: Adiciona login"')
    await denied('git commit -m "feat: adiciona login."')
    await denied('git commit -m "feature: adiciona login"')
  })

  test('lê a mensagem de um heredoc', async () => {
    const good = `git commit -m "$(cat <<'EOF'\nfeat(report): adiciona exportação em CSV\n\nCorpo.\nEOF\n)"`
    const bad = `git commit -m "$(cat <<'EOF'\nAdiciona CSV\nEOF\n)"`
    await allowed(good)
    await denied(bad)
  })

  test('recusa commit direto em branches protegidas e em staging', async () => {
    await denied('git commit -m "fix: x"', 'production', /commit direto em production/)
    await denied('git commit -m "fix: x"', 'main')
    await denied('git commit -m "fix: x"', 'release/v1.0.0')
    await denied('git commit -m "fix: x"', 'staging', /merges/)
    await allowed('git commit --no-edit', 'staging')
  })

  test('considera a branch criada no mesmo comando', async () => {
    await allowed('git switch -c feature/nova && git commit -m "feat: nova"', 'production')
    await denied('git switch production && git commit -m "feat: nova"', 'feature/x', /production/)
  })
})

describe('integração', () => {
  test('staging recebe merges de branches de trabalho e cherry-pick de hotfix', async () => {
    await allowed('git switch staging && git merge feature/x && git push origin staging', 'feature/x')
    await allowed('git cherry-pick abc123', 'staging')
  })

  test('nunca puxa staging nem main para outra branch', async () => {
    await denied('git merge staging', 'feature/x', /destino, nunca origem/)
    await denied('git merge origin/staging', 'feature/x', /destino, nunca origem/)
    await denied('git pull origin staging', 'feature/x', /destino, nunca origem/)
    await denied('git rebase main', 'feature/x', /backup/)
    await allowed('git rebase origin/production', 'feature/x')
    await allowed('git pull', 'production')
  })

  test('recusa merge/rebase local em branch protegida', async () => {
    await denied('git merge feature/x', 'production')
    await denied('git merge staging', 'main')
    await allowed('git merge --abort', 'production')
  })

  test('revert na release exige autorização', async () => {
    await denied('git revert abc123 --no-edit', 'release/v1.2.0', /\/conventions release on/)
    await authorized('git revert abc123 --no-edit', 'release/v1.2.0')
  })
})

describe('push', () => {
  test('aceita push da branch de trabalho e de staging', async () => {
    await allowed('git push -u origin feature/x')
    await allowed('git push')
    await allowed('git push --force-with-lease')
    await allowed('git push origin staging', 'staging')
  })

  test('production e main só mudam via PR', async () => {
    await denied('git push origin production', 'feature/x', /PR/, true)
    await denied('git push', 'main', /PR/, true)
    await denied('git push origin HEAD:production', 'feature/x', /PR/, true)
    await denied('git push origin :main', 'feature/x', /remover/, true)
  })

  test('release/* exige autorização e não aceita force', async () => {
    await denied('git push origin origin/production:refs/heads/release/v1.4.0', 'feature/x', /\/conventions release on/)
    await authorized('git push origin "origin/production:refs/heads/release/v1.4.0"')
    await authorized('git push origin --delete release/v1.4.0')
    await denied('git push origin HEAD:refs/heads/release/1.4', 'feature/x', /release\/vX.Y.Z/, true)
    await denied('git push --force origin release/v1.4.0', 'feature/x', /force/, true)
  })

  test('reset de staging exige autorização', async () => {
    await denied('git push --force-with-lease origin origin/production:staging', 'feature/x', /\/conventions release on/)
    await authorized('git push --force-with-lease origin origin/production:staging')
    await denied('git push origin :staging', 'feature/x', /remover/, true)
  })

  test('recusa force sem lease e push em massa', async () => {
    await denied('git push --force', 'feature/x', /force-with-lease/)
    await denied('git push -uf origin feature/x')
    await denied('git push origin +feature/x')
    await denied('git push --tags', 'feature/x', /massa/, true)
  })

  test('tags de versão: autorização, formato e imutabilidade', async () => {
    await denied('git push origin v1.2.0', 'feature/x', /\/conventions release on/)
    await authorized('git push origin v1.2.0')
    await authorized('git push origin refs/tags/v1.2.0')
    await denied('git push origin v1.2.0-rc.1', 'feature/x', /fora do padrão/, true)
    await denied('git push origin :refs/tags/v1.2.0', 'feature/x', /imutáveis/, true)
    await denied('git push --delete origin v1.2.0', 'feature/x', /imutáveis/, true)
    await denied('git push origin +v1.2.0', 'feature/x', /imutáveis/, true)
  })
})

describe('tags', () => {
  test('aceita tag anotada com autorização', async () => {
    await authorized('git tag -a v1.0.0 -m "Release v1.0.0"')
    await authorized('git tag -a v1.0.0 origin/production -m "Release"')
    await authorized('git tag -s v1.0.0 -m "Release"')
    await denied('git tag -a v1.0.0 -m "Release"', 'feature/x', /\/conventions release on/)
  })

  test('recusa tag leve, fora do padrão, movida ou apagada', async () => {
    await denied('git tag v1.0.0', 'feature/x', /anotada/, true)
    await denied('git tag -a v1.0 -m "x"', 'feature/x', /fora do padrão/, true)
    await denied('git tag -d v1.0.0', 'feature/x', /imutáveis/, true)
    await denied('git tag -fa v1.0.0 -m "x"', 'feature/x', /imutáveis/, true)
  })

  test('aceita listagem e tags que não são de versão', async () => {
    await allowed('git tag -l "v*"')
    await allowed('git tag --points-at HEAD')
    await allowed('git tag experimento-local')
  })
})

describe('gh pr create', () => {
  test('valida título e rota do PR', async () => {
    await allowed('gh pr create --base release/v1.4.0 --title "feat(report): adiciona CSV"', 'feature/x')
    await allowed('gh pr create --base staging --title "feat(report): adiciona CSV"', 'feature/x')
    await allowed('gh pr create -B production -t "fix(auth): corrige token"', 'hotfix/token')
    await denied('gh pr create --base release/v1.4.0 --title "Adiciona CSV"', 'feature/x', /título/)
    await denied('gh pr create --title "feat: x"', 'feature/x', /backup estável/)
    await denied('gh pr create --base main --title "feat: x"', 'feature/x', /main/)
    await denied('gh pr create --base release/v1.0.0 --title "fix: x"', 'hotfix/token')
  })

  test('PRs de release e sincronização exigem autorização', async () => {
    await denied('gh pr create --base production --head release/v1.4.0 --title "chore(release): publica v1.4.0"', 'feature/x', /\/conventions release on/)
    await authorized('gh pr create --base production --head release/v1.4.0 --title "chore(release): publica v1.4.0"')
    await authorized('gh pr create --base main --head production --title "chore(release): backup estável v1.4.0"')
    await denied('gh pr create --base main --head production --title "chore(release): backup estável"', 'feature/x', /\/conventions release on/)
    await denied('gh pr create --base main --head staging --title "chore(release): backup"', 'feature/x', /só recebe PR de production/, true)
  })
})

test('comandos do Uso diário passam com autorização', async () => {
  await authorized('git fetch origin && git switch -c feature/proj-123-export-csv origin/production', 'production')
  await authorized('git switch staging && git reset --hard origin/staging && git merge --no-ff feature/proj-123-export-csv && git push origin staging', 'feature/proj-123-export-csv')
  await authorized('git push --force-with-lease origin "origin/release/v1.4.0:staging"')
  await authorized('gh pr create --base production --head release/v1.4.0 --title "chore(release): publica v1.4.0"')
  await authorized('git tag -a "v1.4.0" origin/production -m "Release v1.4.0" && git push origin "v1.4.0"')
  await authorized('git switch staging && git reset --hard origin/staging && git cherry-pick origin/production && git push origin staging', 'production')
  await authorized('gh pr create --base main --head production --title "chore(release): backup estável v1.4.1"')
})

test('ignora comandos que não são git/gh', async () => {
  await allowed('echo "git commit -m ruim"', 'production')
  await allowed('ls -la && npm test', 'production')
})
