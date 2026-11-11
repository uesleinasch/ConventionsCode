Regras obrigatórias de Git neste projeto. Documentação completa no diretório GitFlow do plugin conventions-code.

## Branches
- `production`: produção e branch default. Origem de todo o trabalho. Muda só por PR: `release/vX.Y.Z` (merge commit), `hotfix/*` e `dependabot/*` (squash). Nunca push, commit ou merge local nela.
- `staging` (opcional): homologação. Recebe merge de `feature/*`, `bugfix/*`, `chore/*` para teste. É destino, nunca origem: nunca `git merge staging`, `git rebase staging`, `git pull origin staging`, nem criar branch a partir dela. Sem commit direto.
- `main`: backup estável, cópia de `production`. Recebe só o PR de sincronização (`staging` ou `production` → `main`). Nunca é origem.
- `release/vX.Y.Z`: nasce de `production`; recebe features aprovadas por PR com squash; vai para `production` por PR com merge commit.
- Branches de trabalho: `feature/`, `bugfix/`, `hotfix/`, `chore/` + descrição em minúsculas com hífens (ex.: `feature/proj-123-export-csv`). Nascem de `origin/production` (exceção: revert/correção de uma release, a partir dela). Para atualizar: `git rebase origin/production`.

## Commits e PRs (Conventional Commits 1.0.0)
- Cabeçalho: `<tipo>(escopo opcional)!: descrição` — descrição imperativa, começando em minúscula, sem ponto final, até 100 caracteres (ideal ≤ 72).
- Tipos: feat, fix, perf, refactor, docs, test, build, ci, style, chore, revert.
- `!` ou rodapé `BREAKING CHANGE:` para quebra de compatibilidade.
- O título do PR vira o commit na release ou em `production` (squash): ele também deve seguir o formato acima.
- Bump: feat → minor, fix/perf → patch, breaking → major.

## Releases e tags
- Tags `vX.Y.Z` sempre anotadas (`git tag -a`), criadas no HEAD de `origin/production` depois do merge da release ou do hotfix, e enviadas pelo nome (`git push origin vX.Y.Z`). Nunca mover nem apagar tags `v*`.
- Passos do mantenedor (criar `release/*`, PR para `production` ou `main`, tag, reset de `staging`) seguem a seção "Uso diário" de `05-automacao.md`.
- Sem autorização de release no projeto: mostre os comandos ao usuário. Com autorização: execute um passo por vez quando o usuário pedir, espere cada workflow/check (`gh run watch`, `gh pr checks --watch`) e pare no primeiro erro.
- Não existe bot nem GitHub App de release: nunca propor App, PAT, secrets de release ou workflows que criem refs.
- Nunca usar `git push --force` sem lease. Reset de `staging` só com `--force-with-lease` e autorização. Nunca `--all`, `--mirror`, `--tags`.

## Segurança
- Não desabilitar proteções, assinatura de commits, rulesets ou checks para "destravar" algo; explique o bloqueio ao usuário.
- Em workflows: `permissions` mínimas, nada de `${{ }}` interpolado direto em `run:`, sem `pull_request_target` com checkout do PR.
