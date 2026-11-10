# 01 — Branches

Nomenclatura baseada em [Conventional Branch](https://conventionalbranch.org/pt-br/).

## Branches permanentes

### `main`

- Branch **default** do repositório; destino de todo o desenvolvimento.
- Funciona como **backup e integração**: tudo que foi desenvolvido e revisado está aqui, lançado ou não.
- Nunca é deployada diretamente em produção.
- Recebe:
  - PRs de `feature/*`, `bugfix/*`, `chore/*` → **squash merge**;
  - back-merge de `release/vX.Y.Z` → **merge commit** (obrigatório, ver abaixo).

### `production`

- Representa **exatamente** o que está em produção. O HEAD de `production` sempre tem uma tag `vX.Y.Z`.
- **Não recebe PR.** É atualizada somente pelo bot de release no workflow `promote`, via **fast-forward** para o commit do RC aprovado.
- Sem force push, sem deleção, sem commits diretos — nem de administradores.

## Branches temporárias

| Prefixo      | Uso                                                   | Criada a partir de                 | PR para               | Merge  |
|--------------|-------------------------------------------------------|------------------------------------|-----------------------|--------|
| `feature/`   | Nova funcionalidade                                   | `main`                             | `main`                | squash |
| `bugfix/`    | Correção de bug                                       | `main` **ou** `release/vX.Y.Z`     | mesma branch de origem | squash |
| `hotfix/`    | Correção urgente do que está em produção              | `release/vX.Y.Z` de hotfix         | `release/vX.Y.Z`      | squash |
| `chore/`     | Manutenção sem impacto funcional (deps, docs, CI)     | `main` (ou release, se necessário) | mesma branch de origem | squash |
| `release/`   | Estabilização de uma versão                           | `main` (regular) ou `production` (hotfix) | — (criada pelo bot) | — |

Branches de bots (ex.: `dependabot/*`) são aceitas como exceção, desde que os commits sigam Conventional Commits.

## Regras de nomenclatura

Formato: `<tipo>/<descrição>`

- Apenas **minúsculas**, números e **hífens** na descrição.
- Sem hífens consecutivos, no início ou no fim.
- **Pontos** só são permitidos em `release/` (para a versão).
- Número de ticket é bem-vindo: `feature/issue-123-login-sso`.
- `release/` usa sempre a versão completa com `v`: `release/v1.4.0`.

Expressões regulares usadas na validação automática:

```text
feature|bugfix|hotfix|chore:  ^(feature|bugfix|hotfix|chore)/[a-z0-9]+(-[a-z0-9]+)*$
release:                      ^release/v[0-9]+\.[0-9]+\.[0-9]+$
```

| Válido                         | Inválido                    | Motivo                      |
|--------------------------------|-----------------------------|-----------------------------|
| `feature/issue-42-export-csv`  | `feature/Export_CSV`        | maiúscula e underscore      |
| `bugfix/null-pointer-on-save`  | `bugfix/--fix`              | hífens consecutivos/início  |
| `hotfix/cve-2026-1234`         | `hotfix/v1.2.3`             | ponto fora de `release/`    |
| `release/v2.0.0`               | `release/2.0`               | sem `v` e sem patch         |
| `chore/bump-node-22`           | `misc/cleanup`              | tipo inexistente            |

> A especificação Conventional Branch também aceita os apelidos `feat/` e `fix/`. Esta convenção padroniza **apenas** os nomes completos (`feature/`, `bugfix/`) para manter uma única forma.

## Matriz de PR permitido

| Destino            | Origens aceitas                                                   |
|--------------------|-------------------------------------------------------------------|
| `main`             | `feature/*`, `bugfix/*`, `chore/*`, `release/v*` (back-merge), `dependabot/*` |
| `release/vX.Y.Z`   | `bugfix/*`, `hotfix/*`, `chore/*`                                 |
| `production`       | **nenhuma** (somente fast-forward do bot)                         |

Validado pelo workflow [`pr-checks.yml`](templates/.github/workflows/pr-checks.yml).

## Por que squash em uma direção e merge commit na outra

- **Squash** para PRs de trabalho: cada PR vira **um** commit Conventional Commit em `main`, cujo título é o título do PR. O changelog e o cálculo de versão ficam limpos.
- **Merge commit** no back-merge `release → main` (e nunca squash): preserva a ancestralidade. Assim `production` sempre é ancestral da próxima `release/*`, o que permite o **fast-forward** na promoção. Um squash aqui quebraria o fast-forward da próxima release.

## Ciclo de vida

- `feature/*`, `bugfix/*`, `hotfix/*`, `chore/*`: removidas automaticamente após o merge (opção *Automatically delete head branches*).
- `release/vX.Y.Z`: removida após o back-merge concluído. A tag `vX.Y.Z` preserva o histórico.
