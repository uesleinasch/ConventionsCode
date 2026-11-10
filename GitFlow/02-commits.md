# 02 — Commits

Mensagens seguem [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/#specification).

## Estrutura

```text
<tipo>[(escopo)][!]: <descrição>

[corpo opcional]

[rodapé(s) opcional(is)]
```

- **tipo**: obrigatório, minúsculo, da lista abaixo.
- **escopo**: opcional, substantivo que identifica a área (`auth`, `api`, `deps`).
- **`!`**: marca breaking change.
- **descrição**: imperativo, minúscula, sem ponto final. Cabeçalho com no máximo 100 caracteres (ideal ≤ 72).
- **corpo**: separado por linha em branco; explica *o quê* e *por quê*.
- **rodapé**: formato `Token: valor` ou `Token #valor` (ex.: `Refs: #123`, `Reviewed-by: ...`). `BREAKING CHANGE: <descrição>` é o rodapé especial de quebra de compatibilidade.

## Tipos permitidos

| Tipo       | Quando usar                                             | Bump SemVer |
|------------|---------------------------------------------------------|-------------|
| `feat`     | Nova funcionalidade para o usuário                      | **minor**   |
| `fix`      | Correção de bug                                         | **patch**   |
| `perf`     | Melhoria de desempenho                                  | patch       |
| `refactor` | Mudança de código sem alterar comportamento             | —           |
| `docs`     | Somente documentação                                    | —           |
| `test`     | Adição/ajuste de testes                                 | —           |
| `build`    | Sistema de build, empacotamento, dependências           | —           |
| `ci`       | Configuração de CI/CD                                   | —           |
| `style`    | Formatação, sem mudança de lógica                       | —           |
| `chore`    | Manutenção que não se encaixa nos anteriores            | —           |
| `revert`   | Reverte um commit anterior                              | depende     |

Qualquer tipo com `!` ou rodapé `BREAKING CHANGE:` → **major** (em `0.x`, o major é tratado como minor).

> `feat` e `fix` são os únicos tipos definidos pela especificação; os demais vêm da convenção `@commitlint/config-conventional` e são adotados aqui como lista fechada.

## Exemplos

```text
feat(auth): adiciona login com SSO corporativo

fix(api): corrige timeout na listagem de pedidos

Refs: #482

feat(api)!: remove endpoint v1 de clientes

BREAKING CHANGE: /v1/customers foi removido; use /v2/customers.

chore(deps): atualiza axios para 1.8.2

revert: feat(auth): adiciona login com SSO corporativo

Refs: 3f2a9c1
```

## Onde a convenção é aplicada

Como os PRs de trabalho são mergeados com **squash**, o commit que fica em `main` é o **título do PR**. Por isso:

1. **Título do PR** — validado no CI (`pr-checks.yml`) e é a fonte da verdade para versão e changelog.
2. **Commits locais** — recomendado seguir a convenção também (hook `commit-msg` com commitlint ou validação pelo Claude Code), mas não bloqueia o merge.
3. **Commits gerados por bots** — Dependabot configurado com prefixo `chore(deps)` / `ci(deps)`.

Configuração do repositório: *Settings → General → Pull Requests → Allow squash merging → Default to pull request title*.

## Commits que não entram no changelog

- Merge commits de back-merge (`Merge pull request #N ...`) — não convencionais, filtrados.
- `chore(release): ...` — gerados pelo processo de release.
