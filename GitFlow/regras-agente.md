Regras obrigatórias de Git neste projeto. Documentação completa no diretório GitFlow do plugin conventions-code.

## Branches
- `main`: default, integração/backup. Nunca commitar direto; só recebe PR.
- `production`: espelho de produção. Nunca merge, PR ou force push; só avança por fast-forward na promoção (`git push --atomic` junto com a tag final).
- `release/vX.Y.Z`: criada no corte da release a partir de `origin/main` (regular) ou `origin/production` (hotfix). Nunca commit direto; correções entram por PR.
- Branches de trabalho: `feature/`, `bugfix/`, `hotfix/`, `chore/` + descrição em minúsculas com hífens (ex.: `feature/issue-42-export-csv`). Sem maiúsculas, underscore ou ponto.
- Origem/destino:
  - `feature/*`, `bugfix/*`, `chore/*` saem de `main` e voltam para `main` por PR (squash).
  - `bugfix/*`, `hotfix/*`, `chore/*` de correção da release saem de `release/vX.Y.Z` e voltam para ela por PR (squash).

## Commits e PRs (Conventional Commits 1.0.0)
- Cabeçalho: `<tipo>(escopo opcional)!: descrição` — descrição imperativa, começando em minúscula, sem ponto final, até 100 caracteres (ideal ≤ 72).
- Tipos: feat, fix, perf, refactor, docs, test, build, ci, style, chore, revert.
- `!` ou rodapé `BREAKING CHANGE:` para quebra de compatibilidade.
- O título do PR vira o commit em `main` (squash): ele também deve seguir o formato acima.
- Bump: feat → minor, fix/perf → patch, breaking → major.

## Releases e tags
- Tags `vX.Y.Z-rc.N` e `vX.Y.Z` sempre anotadas (`git tag -a`) e enviadas pelo nome (`git push origin <tag>`). Nunca mover nem apagar tags `v*`.
- Corte, RC, promoção e back-merge seguem a seção "Uso diário" de `05-automacao.md`. Execute um passo por vez, só quando o usuário pedir, e espere ele conferir os workflows antes do próximo.
- Não existe bot nem GitHub App de release: nunca propor App, PAT, secrets de release ou workflows que criem refs.
- Nunca usar `git push --force`; em branches de trabalho use `--force-with-lease`. Nunca `--all`, `--mirror`, `--tags`.

## Segurança
- Não desabilitar proteções, assinatura de commits, rulesets ou checks para "destravar" algo; explique o bloqueio ao usuário.
- Em workflows: `permissions` mínimas, nada de `${{ }}` interpolado direto em `run:`, sem `pull_request_target` com checkout do PR.
