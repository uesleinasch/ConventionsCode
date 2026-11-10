# 04 — Segurança

Controles para garantir que **só código revisado, testado e aprovado** chegue em produção, e que seja possível provar isso.

## Quem move as refs de release

O **mantenedor** (papel *Admin* ou *Maintain* no repositório) cria `release/v*`, as tags `v*` e atualiza `production` com `git` e `gh`, usando a própria autenticação. Os workflows **não** criam refs: só reagem ao push de tags.

- Não há bot, GitHub App, PAT nem secret de release para configurar.
- Push feito pelo mantenedor dispara os workflows normalmente; refs criadas por workflows com `GITHUB_TOKEN` não disparariam, por isso a convenção não depende delas.
- O papel do mantenedor é o **único** na lista de bypass de `production`, `release/v*` (criação) e tags `v*`. Os demais colaboradores só abrem PRs.
- As validações que impedem uma promoção errada ficam no `release.yml` e nos rulesets, não na disciplina de quem executa.

## Rulesets (Settings → Rules → Rulesets)

### `main`

| Regra                                   | Valor                                  |
|-----------------------------------------|----------------------------------------|
| Restrict deletions                      | ✅                                     |
| Block force pushes                      | ✅                                     |
| Require a pull request                  | ✅ — 1 aprovação (2 para repos críticos) |
| Dismiss stale approvals on new commits  | ✅                                     |
| Require review from Code Owners         | ✅                                     |
| Require approval of the most recent push | ✅                                    |
| Require conversation resolution         | ✅                                     |
| Required status checks                  | `pr-checks`, `ci`, `security`          |
| Require signed commits                  | ✅                                     |
| Allowed merge methods                   | Squash, Merge                          |
| Bypass                                  | **ninguém**                            |

> **Projeto com um único mantenedor:** o GitHub não deixa o autor aprovar o próprio PR. Use **0 aprovações** e desligue *Require review from Code Owners* e *Require approval of the most recent push*; mantenha PR obrigatório, status checks, conversation resolution e commits assinados. Volte para 1 aprovação quando houver um segundo revisor.

### `production`

| Regra               | Valor                                    |
|---------------------|------------------------------------------|
| Restrict updates    | ✅ — bypass: **somente** o papel do mantenedor (Admin/Maintain) |
| Restrict deletions  | ✅                                       |
| Block force pushes  | ✅ (sem bypass)                          |

### `release/v*`

| Regra                       | Valor                                          |
|-----------------------------|------------------------------------------------|
| Restrict creations          | ✅ — bypass: mantenedor                         |
| Require a pull request      | ✅ — 1 aprovação, Code Owners (0 em projeto solo) |
| Required status checks      | `pr-checks`, `ci`, `security`                  |
| Require signed commits      | ✅                                             |
| Block force pushes          | ✅                                             |
| Restrict deletions          | ✅ — bypass: mantenedor (limpeza após back-merge) |
| Allowed merge methods       | Squash (PRs) — back-merge é na `main`          |

### Tags `refs/tags/v*`

| Regra               | Valor                         |
|---------------------|-------------------------------|
| Restrict creations  | ✅ — bypass: mantenedor        |
| Restrict updates    | ✅ — sem bypass                |
| Restrict deletions  | ✅ — sem bypass                |

Resultado: ninguém (nem admin) move uma tag publicada ou reescreve `production`; só o mantenedor cria versões, e o `release.yml` recusa tags que não passam nas validações.

No bypass de cada ruleset: *Bypass list → Add bypass → Repository admin* (ou *Maintain*), modo **Always**.

## Environments (Settings → Environments)

| Environment        | Proteção                                                    | Uso                       |
|--------------------|-------------------------------------------------------------|---------------------------|
| `staging`          | Deployment refs: tags `v*-rc.*`                             | Deploy dos RCs            |
| `production`       | Deployment refs: tags `v*.*.*`; secrets de produção só aqui; *required reviewers* opcional (time de release, *prevent self-review*) | Deploy das versões finais |

Em projeto solo, deixe `production` sem *required reviewers* (ou com você mesmo, sem *prevent self-review*): a aprovação já acontece quando você cria a tag final.

Secrets de produção ficam **apenas** no Environment `production` — nunca em secrets do repositório.

## Assinatura

- **Commits**: obrigatórios assinados em `main` e `release/*` (SSH ou GPG). Squash/merge feitos pela UI do GitHub já saem assinados.
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
| CodeQL (SAST)                         | `security.yml` em PRs, `main` e semanal       |
| Dependabot alerts + updates           | `dependabot.yml`                              |

## Conta e organização

- 2FA obrigatório na organização.
- Acesso por times, com menor privilégio; administradores mínimos.
- Audit log revisado periodicamente (bypass de ruleset, mudanças em environments).
