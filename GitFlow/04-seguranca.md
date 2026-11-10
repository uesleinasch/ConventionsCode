# 04 — Segurança

Controles para garantir que **só código revisado, testado e aprovado** chegue em produção, e que seja possível provar isso.

## Identidade do bot de release

Use um **GitHub App** dedicado (ex.: `release-bot`), não um PAT pessoal.

- Permissões mínimas: `contents: write`, `pull_requests: write`.
- É o **único** ator na lista de bypass de `production`, `release/v*` (criação) e tags `v*`.
- Credenciais: `vars.RELEASE_APP_ID` e `secrets.RELEASE_APP_PRIVATE_KEY`, com acesso restrito aos workflows de release.
- Motivo técnico: refs criadas com `GITHUB_TOKEN` **não disparam** outros workflows; o token do App dispara (necessário para o encadeamento por tags).

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

### `production`

| Regra               | Valor                                    |
|---------------------|------------------------------------------|
| Restrict updates    | ✅ — bypass: **somente** o App de release |
| Restrict deletions  | ✅                                       |
| Block force pushes  | ✅ (sem bypass)                          |

### `release/v*`

| Regra                       | Valor                                          |
|-----------------------------|------------------------------------------------|
| Restrict creations          | ✅ — bypass: App de release                     |
| Require a pull request      | ✅ — 1 aprovação, Code Owners                   |
| Required status checks      | `pr-checks`, `ci`, `security`                  |
| Require signed commits      | ✅                                             |
| Block force pushes          | ✅                                             |
| Restrict deletions          | ✅ — bypass: App de release e admins (limpeza)  |
| Allowed merge methods       | Squash (PRs) — back-merge é na `main`          |

### Tags `refs/tags/v*`

| Regra               | Valor                         |
|---------------------|-------------------------------|
| Restrict creations  | ✅ — bypass: App de release    |
| Restrict updates    | ✅ — sem bypass                |
| Restrict deletions  | ✅ — sem bypass                |

Resultado: ninguém (nem admin) move uma tag publicada, reescreve `production` ou cria uma versão fora do pipeline.

## Environments (Settings → Environments)

| Environment        | Proteção                                                    | Uso                       |
|--------------------|-------------------------------------------------------------|---------------------------|
| `staging`          | Deployment refs: tags `v*-rc.*`                             | Deploy dos RCs            |
| `release-approval` | **Required reviewers** (time de release), *prevent self-review*, refs: `main` | Gate do `promote` |
| `production`       | Deployment refs: tags `v*.*.*`; secrets de produção só aqui | Deploy das versões finais |

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
