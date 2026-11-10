import { describe, expect, test } from 'claude-code/testing'

import { checkCommand } from '../hooks/gitflow/guard'

const on = (branch: string | undefined) => ({ currentBranch: async () => branch })

const allowed = async (command: string, branch = 'feature/x') =>
  expect(await checkCommand(command, on(branch))).toBeUndefined()

const denied = async (command: string, branch = 'feature/x', match?: RegExp) => {
  const issue = await checkCommand(command, on(branch))
  expect(issue).toBeDefined()
  if (match) expect(issue).toMatch(match)
}

describe('branches', () => {
  test('aceita nomes de Conventional Branch', async () => {
    await allowed('git switch -c feature/issue-42-export-csv', 'main')
    await allowed('git checkout -b bugfix/null-on-save', 'main')
    await allowed('git branch chore/bump-node-22')
    await allowed('git worktree add ../wt -b hotfix/cve-2026-1234')
  })

  test('recusa nomes fora do padrão', async () => {
    await denied('git switch -c Feature/Export_CSV', 'main', /Conventional Branch/)
    await denied('git checkout -b misc/cleanup', 'main')
    await denied('git checkout -b feature/v1.2', 'main')
    await denied('git switch -c release/v1.2.0', 'main', /mantenedor/)
  })

  test('ignora operações que não criam branch', async () => {
    await allowed('git branch -d feature/old')
    await allowed('git branch --show-current')
    await allowed('git switch main')
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

  test('recusa commit direto em branches protegidas', async () => {
    await denied('git commit -m "fix: x"', 'main', /commit direto em main/)
    await denied('git commit -m "fix: x"', 'production')
    await denied('git commit -m "fix: x"', 'release/v1.0.0')
  })

  test('considera a branch criada no mesmo comando', async () => {
    await allowed('git switch -c feature/nova && git commit -m "feat: nova"', 'main')
    await denied('git switch main && git commit -m "feat: nova"', 'feature/x', /main/)
  })

  test('recusa merge/rebase em branch protegida', async () => {
    await denied('git merge feature/x', 'main')
    await allowed('git rebase main', 'feature/x')
    await allowed('git merge --abort', 'main')
  })
})

describe('push', () => {
  test('aceita push da branch de trabalho', async () => {
    await allowed('git push -u origin feature/x')
    await allowed('git push')
    await allowed('git push --force-with-lease')
  })

  test('recusa push em branches protegidas', async () => {
    await denied('git push origin main', 'feature/x', /PR/)
    await denied('git push', 'main')
    await denied('git push origin HEAD:production')
    await denied('git push origin HEAD:refs/heads/release/v1.0.0')
    await denied('git push origin :main', 'feature/x', /remover/)
  })

  test('recusa force sem lease e push de tags', async () => {
    await denied('git push --force', 'feature/x', /force-with-lease/)
    await denied('git push -uf origin feature/x')
    await denied('git push origin +feature/x')
    await denied('git push --tags')
    await denied('git push origin v1.2.0', 'feature/x', /tag/)
    await denied('git push origin refs/tags/v1.2.0')
  })
})

describe('tags', () => {
  test('recusa tags de versão', async () => {
    await denied('git tag v1.0.0', 'feature/x', /mantenedor/)
    await denied('git tag -a v1.0.0 -m "Release"')
    await denied('git tag -d v1.0.0')
  })

  test('aceita listagem e tags que não são de versão', async () => {
    await allowed('git tag -l "v*"')
    await allowed('git tag --points-at HEAD')
    await allowed('git tag experimento-local')
  })
})

describe('gh pr create', () => {
  test('valida título e rota do PR', async () => {
    await allowed('gh pr create --base main --title "feat(report): adiciona CSV"', 'feature/x')
    await allowed('gh pr create -B release/v1.4.1 -t "fix(auth): corrige token"', 'hotfix/token')
    await denied('gh pr create --title "Adiciona CSV"', 'feature/x', /título/)
    await denied('gh pr create --base production --title "feat: x"', 'feature/x', /production/)
    await denied('gh pr create --base main --title "fix: x"', 'hotfix/token', /main/)
    await denied('gh pr create --base release/v1.0.0 --title "feat: x"', 'feature/x')
  })
})

test('ignora comandos que não são git/gh', async () => {
  await allowed('echo "git commit -m ruim"', 'main')
  await allowed('ls -la && npm test', 'main')
})
