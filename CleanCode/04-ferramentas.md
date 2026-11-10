# 04 — Ferramentas e revisão

Os limites mensuráveis são aplicados por linter. Templates em [`CleanCode/templates/`](https://github.com/uesleinasch/ConventionsCode/tree/main/CleanCode/templates), copiados com:

```text
/conventions setup clean-code javascript
/conventions setup clean-code python
/conventions setup clean-code dotnet
```

O `setup` nunca sobrescreve arquivos existentes; se o projeto já tem configuração, mescle as regras manualmente.

## JavaScript / TypeScript — ESLint (flat config)

`eslint.config.mjs` com regras do núcleo do ESLint:

| Regra | Valor | Cobre |
|-------|-------|-------|
| `complexity` | 10 | Complexidade ciclomática |
| `max-depth` | 3 | Aninhamento |
| `max-params` | 3 | Parâmetros |
| `max-lines-per-function` | 40 (sem brancos/comentários) | Tamanho de função |
| `no-warning-comments` | `todo`, `fixme`, `hack`, `xxx` | TODO no código |
| `no-else-return`, `no-nested-ternary`, `no-lonely-if` | erro | Fluxo raso |
| `no-magic-numbers` | aviso, ignora `-1, 0, 1, 2` | Números mágicos |
| `no-unused-vars`, `prefer-const`, `eqeqeq` | erro | Higiene |

## Python — Ruff

`ruff.toml`:

| Seleção | Cobre |
|---------|-------|
| `ERA` (eradicate) | Código comentado |
| `FIX` (flake8-fixme) | TODO/FIXME/HACK/XXX |
| `C90` (mccabe, `max-complexity = 10`) | Complexidade |
| `PLR` (pylint refactor: `max-args = 3`, `max-branches = 10`, `max-returns = 4`) | Parâmetros e ramificações |
| `N` (pep8-naming) | Nomenclatura |
| `SIM`, `RET` | Simplificação e retornos |
| `F`, `E` | Higiene básica |

## .NET / C# — `.editorconfig`

| Configuração | Cobre |
|--------------|-------|
| `CS1591 = none` | Não exige `<summary>` decorativo |
| `IDE0005 = warning` | `using` não usado |
| `IDE0051`, `IDE0052`, `IDE0060 = warning` | Membros e parâmetros não usados |
| Regras de naming | Interfaces com `I`, campos privados `_camelCase`, tipos e membros públicos em PascalCase |
| `csharp_style_*` | Preferência por expressões simples e `var` quando o tipo é aparente |

Para bloquear no build, use `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` no `.csproj` (ou `Directory.Build.props`).

## CI

Rode o linter no workflow `ci.yml` do GitFlow (`make lint`). Se a convenção GitFlow também estiver ativa, o check `ci` já é obrigatório nos rulesets de `main` e `release/*`.

## Checklist de revisão

Para o que o linter não pega:

- [ ] Os nomes revelam intenção, sem abreviações nem ruído?
- [ ] Cada função faz uma coisa, em um nível de abstração?
- [ ] Há comentário que poderia virar nome, função ou tipo?
- [ ] Algum comentário narra, parafraseia, cita ticket/ADR ou é `<summary>` decorativo?
- [ ] Alguma exceção é engolida?
- [ ] Sobrou código morto, import ou parâmetro sem uso?
- [ ] A duplicação existente é do mesmo conceito (extrair) ou coincidência (manter)?
