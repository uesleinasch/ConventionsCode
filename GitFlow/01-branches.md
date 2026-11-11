# 01 — Branches

Nomenclatura baseada em [Conventional Branch](https://conventionalbranch.org/pt-br/).

## Branches permanentes

### `production`

- Branch **principal** e **origem de todo o trabalho**: features, correções, hotfixes e releases nascem dela.
- Não precisa ser a branch default do repositório. Como o `gh pr create` usa a default quando `--base` é omitido, informe sempre `--base`.
- Representa **exatamente** o que está em produção. Cada publicação recebe uma tag `vX.Y.Z` no seu HEAD.
- Recebe somente por PR:
  - `release/vX.Y.Z` → **merge commit** (publicação regular);
  - `hotfix/*` → **squash** (correção urgente);
  - `dependabot/*` → **squash** (atualização de dependências).
- Sem push direto, force push ou deleção — nem de administradores.

### `staging` (opcional)

- Homologação integrada: recebe **merge normal** de `feature/*`, `bugfix/*` e `chore/*` livremente, sem PR obrigatório. Cada push faz deploy no ambiente de homologação.
- **Destino, nunca origem.** Nunca é puxada para outra branch (`git merge staging`, `git rebase staging`, `git pull origin staging`), nunca é base de branch nova e nunca abre PR para `production` ou `release/*`.
- Acumula features aprovadas e reprovadas; por isso é **resetada** para a release na validação final e para `production` depois de cada publicação.
- Sem commit direto: só merges (e o commit de resolução de conflito).
- Projetos sem homologação simplesmente não criam `staging`.

### `main`

- **Backup estável e seguro**: só contém versões publicadas e já validadas em produção.
- Recebe **somente** PR de `production`, e só quando o HEAD de `production` tem tag `vX.Y.Z` (validado pelo `pr-checks.yml`). Nenhum outro caminho: nem `staging`, nem release, nem hotfix direto.
- O PR é aberto a cada **N releases publicadas** (padrão 2, configurável com `/conventions main-sync <n>`).
- Nunca é origem de branch nem de sincronização.

## Branches temporárias

| Prefixo      | Uso                                               | Criada a partir de | Vai para                                         | Merge  |
|--------------|---------------------------------------------------|--------------------|--------------------------------------------------|--------|
| `feature/`   | Nova funcionalidade                               | `production`       | `staging` (teste) e `release/vX.Y.Z` (aprovada)  | merge em `staging`; **squash** na release |
| `bugfix/`    | Correção de bug não urgente                       | `production`       | `staging` e `release/vX.Y.Z`                     | idem   |
| `chore/`     | Manutenção sem impacto funcional (deps, docs, CI) | `production`       | `staging` e `release/vX.Y.Z`                     | idem   |
| `hotfix/`    | Correção urgente do que está em produção          | `production`       | `production` (PR direto)                         | squash |
| `release/`   | Conjunto de features aprovadas de uma versão      | `production`       | `production`                                     | merge commit |

Para trazer mudanças recentes para uma branch de trabalho: `git rebase origin/production`. Nunca `staging`, nunca `main`.

Branches de bots (ex.: `dependabot/*`) são aceitas como exceção, desde que os commits sigam Conventional Commits.

## Regras de nomenclatura

Formato: `<tipo>/<descrição>`

- Apenas **minúsculas**, números e **hífens** na descrição.
- Sem hífens consecutivos, no início ou no fim.
- **Pontos** só são permitidos em `release/` (para a versão).
- Número de ticket é bem-vindo: `feature/proj-123-login-sso`.
- `release/` usa sempre a versão completa com `v`: `release/v1.4.0`.

Expressões regulares usadas na validação automática:

```text
feature|bugfix|hotfix|chore:  ^(feature|bugfix|hotfix|chore)/[a-z0-9]+(-[a-z0-9]+)*$
release:                      ^release/v[0-9]+\.[0-9]+\.[0-9]+$
```

| Válido                         | Inválido                    | Motivo                      |
|--------------------------------|-----------------------------|-----------------------------|
| `feature/proj-42-export-csv`   | `feature/Export_CSV`        | maiúscula e underscore      |
| `bugfix/null-pointer-on-save`  | `bugfix/--fix`              | hífens consecutivos/início  |
| `hotfix/cve-2026-1234`         | `hotfix/v1.2.3`             | ponto fora de `release/`    |
| `release/v2.0.0`               | `release/2.0`               | sem `v` e sem patch         |
| `chore/bump-node-22`           | `misc/cleanup`              | tipo inexistente            |

> A especificação Conventional Branch também aceita os apelidos `feat/` e `fix/`. Esta convenção padroniza **apenas** os nomes completos (`feature/`, `bugfix/`) para manter uma única forma.

## Matriz de PR permitido

| Destino            | Origens aceitas                                         |
|--------------------|---------------------------------------------------------|
| `production`       | `release/vX.Y.Z`, `hotfix/*`, `dependabot/*`            |
| `release/vX.Y.Z`   | `feature/*`, `bugfix/*`, `chore/*`                      |
| `staging`          | `feature/*`, `bugfix/*`, `chore/*` (PR opcional; merge direto também vale) |
| `main`             | **somente** `production`, com HEAD tagueado `vX.Y.Z`     |

Validado pelo workflow [`pr-checks.yml`](https://github.com/uesleinasch/ConventionsCode/blob/main/GitFlow/templates/.github/workflows/pr-checks.yml).

## Por que squash na release e merge commit em production

- **Squash** de cada feature na release: a feature vira **um** commit com o título do PR. Dá para tirar uma feature da release com um único `git revert` e o changelog sai limpo. Use o squash simples, sem `--ff-only`: a release já recebeu outras features e sempre diverge da sua branch.
- **Merge commit** de `release/vX.Y.Z` em `production`: preserva os commits das features no histórico de produção, o que permite reverter uma feature isolada também depois de publicada.
- **Squash** de `hotfix/*` em `production`: correção urgente vira um commit, fácil de levar para `staging` por cherry-pick.

## Ciclo de vida

- `feature/*`, `bugfix/*`, `chore/*`: removidas depois que entram na release publicada (ou quando reprovadas e abandonadas).
- `hotfix/*`: removida automaticamente após o merge (*Automatically delete head branches*).
- `release/vX.Y.Z`: removida após o merge em `production`. A tag `vX.Y.Z` preserva o histórico.
