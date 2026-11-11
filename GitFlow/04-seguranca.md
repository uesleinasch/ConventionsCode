# 04 — Segurança

Controles para garantir que **só código revisado, testado e aprovado** chegue em produção, e que seja possível provar isso.

## Quem move as refs de release

O **mantenedor** (papel *Admin* ou *Maintain* no repositório) cria `release/v*`, abre e mergeia o PR da release para `production`, cria as tags `v*`, reseta `staging` e abre o PR `production → main`, com `git` e `gh` e a própria autenticação. Os workflows **não** criam refs: só reagem ao push.

- Não há bot, GitHub App, PAT nem secret de release para configurar.
- O papel do mantenedor é o **único** no bypass de criação de `release/v*`, de criação de tags `v*` e de force push em `staging`.
- `production` e `main` não têm bypass: mudam só por PR, inclusive para o mantenedor.
- O agente do Claude Code executa esses passos por padrão em projetos com a convenção ativa (autorização gravada em `.claude/conventions.json`); com `/conventions release off`, só mostra os comandos.

## Rulesets (Settings → Rules → Rulesets)

### `production`

| Regra                                   | Valor                                  |
|-----------------------------------------|----------------------------------------|
| Restrict deletions                      | ✅                                     |
| Block force pushes                      | ✅                                     |
| Require a pull request                  | ✅ — 2 aprovações (1 em times pequenos, 0 em projeto solo) |
| Dismiss stale approvals on new commits  | ✅                                     |
| Require review from Code Owners         | ✅                                     |
| Require approval of the most recent push | ✅                                    |
| Require conversation resolution         | ✅                                     |
| Required status checks                  | `pr-checks`, `ci`, `security`          |
| Require signed commits                  | ✅                                     |
| Allowed merge methods                   | Merge (release), Squash (hotfix, Dependabot) |
| Bypass                                  | **ninguém**                            |

### `release/v*`

| Regra                       | Valor                                          |
|-----------------------------|------------------------------------------------|
| Restrict creations          | ✅ — bypass: mantenedor                         |
| Require a pull request      | ✅ — 1 aprovação (0 em projeto solo)            |
| Required status checks      | `pr-checks`, `ci`                              |
| Require signed commits      | ✅                                             |
| Block force pushes          | ✅                                             |
| Restrict deletions          | ✅ — bypass: mantenedor (limpeza após a publicação) |
| Allowed merge methods       | **Squash**                                     |

O `git revert` de uma feature reprovada na release é feito pelo mantenedor com PR (ou push direto via bypass, se o time aceitar).

### `staging` (se houver homologação)

| Regra               | Valor                                              |
|---------------------|----------------------------------------------------|
| Restrict deletions  | ✅                                                 |
| Block force pushes  | ✅ — bypass: mantenedor (reset após cada publicação) |
| Require a pull request | ❌ — merges de features entram por push direto  |

### `main`

| Regra                   | Valor                                  |
|-------------------------|----------------------------------------|
| Restrict deletions      | ✅                                     |
| Block force pushes      | ✅                                     |
| Require a pull request  | ✅ — 1 aprovação (0 em projeto solo)   |
| Required status checks  | `pr-checks` (inclui `main-sync`: origem `production` com HEAD tagueado `vX.Y.Z`) |
| Allowed merge methods   | Merge                                  |
| Bypass                  | **ninguém**                            |

### Tags `refs/tags/v*`

| Regra               | Valor                         |
|---------------------|-------------------------------|
| Restrict creations  | ✅ — bypass: mantenedor        |
| Restrict updates    | ✅ — sem bypass                |
| Restrict deletions  | ✅ — sem bypass                |

Resultado: ninguém (nem admin) move uma tag publicada nem altera `production` sem PR revisado; só o mantenedor cria versões, e o `release.yml` recusa tags que não passam nas validações.

No bypass de cada ruleset: *Bypass list → Add bypass → Repository admin* (ou *Maintain*), modo **Always**.

> **Projeto com um único mantenedor:** o GitHub não deixa o autor aprovar o próprio PR. Use **0 aprovações** e desligue *Require review from Code Owners* e *Require approval of the most recent push*; mantenha PR obrigatório, status checks, conversation resolution e commits assinados.

## Environments (Settings → Environments)

| Environment   | Proteção                                                    | Uso                        |
|---------------|-------------------------------------------------------------|----------------------------|
| `staging`     | Deployment branches: `staging`                              | Deploy de homologação      |
| `production`  | Deployment refs: tags `v*.*.*`; secrets de produção só aqui; *required reviewers* opcional (time de release, *prevent self-review*) | Deploy das versões publicadas |

Em projeto solo, deixe `production` sem *required reviewers*: a aprovação já acontece no PR e na criação da tag.

Secrets de produção ficam **apenas** no Environment `production` — nunca em secrets do repositório.

## Assinatura

- **Commits**: obrigatórios assinados em `production`, `main` e `release/*` (SSH ou GPG). Squash/merge feitos pela UI do GitHub já saem assinados.
  ```bash
  git config --global gpg.format ssh
  git config --global user.signingkey ~/.ssh/id_ed25519.pub
  git config --global commit.gpgsign true
  git config --global tag.gpgsign true
  ```
- **Pacotes**: atestação de proveniência via Sigstore (`actions/attest-build-provenance`). Verificação:
  ```bash
  gh attestation verify ./pacote.tgz --repo <org>/<repo>
  ```

## Hardening do GitHub Actions

- `permissions: contents: read` no topo de **todo** workflow; permissões extras só no job que precisa.
- **Pin por SHA** de todas as actions de terceiros (`uses: org/action@<sha-40> # vX.Y.Z`). Os templates usam tags por legibilidade — troque por SHA ao adotar; Dependabot (`github-actions`) mantém os SHAs atualizados.
- `persist-credentials: false` no `actions/checkout` quando o job não faz push.
- **Nunca** interpolar `${{ github.* }}` / `${{ inputs.* }}` direto em `run:` — passe por `env:` (evita script injection).
- Não usar `pull_request_target` com checkout do código do PR.
- Preferir **OIDC** (`id-token: write`) para credenciais de nuvem em vez de chaves estáticas.
- *Settings → Actions → General*: permissões padrão do `GITHUB_TOKEN` como **read**; desabilitar "Allow GitHub Actions to create and approve pull requests".
- `CODEOWNERS` cobrindo `/.github/` exige revisão do time de plataforma para qualquer mudança em workflows.

## Varredura contínua

| Controle                              | Onde                                          |
|---------------------------------------|-----------------------------------------------|
| Secret scanning + **push protection** | Settings → Code security                      |
| Dependency review (bloqueia PR com CVE alta) | `security.yml` em PRs                  |
| CodeQL (SAST)                         | `security.yml` em PRs, `production` e semanal |
| Dependabot alerts + updates           | `dependabot.yml`                              |

## Conta e organização

- 2FA obrigatório na organização.
- Acesso por times, com menor privilégio; administradores mínimos.
- Audit log revisado periodicamente (bypass de ruleset, mudanças em environments).
