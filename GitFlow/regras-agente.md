Regras obrigatórias de Git neste projeto. Documentação completa no diretório GitFlow do plugin conventions-code.

## Branches
- `main`: default, integração/backup. Nunca commitar direto; só recebe PR.
- `production`: espelho de produção. Nunca fazer push, merge ou PR para ela; só o mantenedor a atualiza na promoção.
- `release/vX.Y.Z`: criada só pelo mantenedor. Nunca criar.
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
- Nunca criar, mover, apagar ou dar push em tags `v*`; RCs (`vX.Y.Z-rc.N`) e versões finais (`vX.Y.Z`) são criados pelo mantenedor com `git tag -a` + `git push`.
- Corte, RC, promoção e back-merge são comandos `git`/`gh` do mantenedor (seção "Uso diário" de `05-automacao.md`). Mostre os comandos para o usuário executar; não os rode.
- Não existe bot nem GitHub App de release: nunca propor App, PAT, secrets de release ou workflows que criem refs.
- Nunca usar `git push --force`; em branches de trabalho use `--force-with-lease`. Nunca `--all`, `--mirror`, `--tags`.

## Segurança
- Não desabilitar proteções, assinatura de commits, rulesets ou checks para "destravar" algo; explique o bloqueio ao usuário.
- Em workflows: `permissions` mínimas, nada de `${{ }}` interpolado direto em `run:`, sem `pull_request_target` com checkout do PR.
