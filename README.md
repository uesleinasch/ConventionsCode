# ConventionsCode

Projeto de referência com regras e convenções de desenvolvimento para adotar em projetos **sob demanda**. Ele é ao mesmo tempo:

- **documentação** de cada convenção;
- **plugin do Claude Code** (`conventions-code`), que aplica as convenções no projeto em que você ativar;
- **marketplace** de onde o plugin é instalado.

Documentação publicada: <https://uesleinasch.github.io/ConventionsCode/>

## Convenções disponíveis

| Convenção | ID | Conteúdo |
|-----------|----|----------|
| [GitFlow](GitFlow/README.md) | `gitflow` | Branches (`production` / `staging` / `main`), Conventional Branch, Conventional Commits, release seletiva por squash, tags `vX.Y.Z` e segurança no GitHub |
| [Código limpo](CleanCode/README.md) | `clean-code` | Nomenclatura, funções e estrutura, comentários só quando inevitáveis, linters (ESLint, Ruff, .editorconfig) e checklist de revisão |

## Ativação por projeto (opt-in)

Instalar o plugin **não ativa nada**. Em projetos sem opt-in ele não injeta instruções, não valida comandos e não altera arquivos.

| Camada | Como funciona |
|--------|---------------|
| Marcador do projeto | Uma convenção só vale onde `.claude/conventions.json` a lista. O arquivo só é criado por `/conventions enable <id>`. |
| Instruções | As regras entram no prompt do Claude **apenas** em projetos com o marcador. Não há skill global. |
| Guarda de comandos | A validação de `git` / `gh` no Bash só roda em projetos com o marcador. |
| Bloqueio por remote | A opção `blockedRemotes` (ex.: a organização da empresa) recusa a ativação e ignora um marcador existente em qualquer repositório cujo remote ou caminho contenha o trecho. |
| Indicador | Projeto com convenção ativa mostra `conventions: <id>` na linha de status. |

## Instalação

A partir do GitHub:

```bash
claude plugin marketplace add uesleinasch/ConventionsCode
claude plugin install conventions-code@conventions-code --config blockedRemotes=<org-da-empresa>
```

Para desenvolver, use o clone local como marketplace; edições valem após `/reload-plugins`, sem reinstalar:

```bash
claude plugin marketplace add ~/Code/pessoal/ConventionsCode
claude plugin install conventions-code@conventions-code --config blockedRemotes=<org-da-empresa>
```

O bloqueio pode ser ajustado depois em `/config` → `conventions-code.blockedRemotes`, ou em `~/.claude/settings.json`:

```json
{
  "pluginConfigs": {
    "conventions-code": { "options": { "blockedRemotes": "org-da-empresa,outra-org" } }
  }
}
```

## Uso

```text
/conventions status             # o que está ativo neste projeto
/conventions enable gitflow     # ativa só neste projeto (cria .claude/conventions.json)
/conventions setup gitflow [ref]  # copia workflows e templates (não sobrescreve) e cria as branches permanentes que faltam
/conventions disable gitflow    # desativa neste projeto
/conventions release off        # o agente só mostra os passos de release (padrão: autorizado)
/conventions release on         # volta a autorizar
/conventions auto on            # autonomia: release + merge de PRs, fluxo de ponta a ponta (padrão: off)
/conventions auto off           # merges de PR voltam a ser do usuário
/conventions main-sync 3        # PR production → main a cada 3 releases (padrão 2)

/conventions enable clean-code
/conventions setup clean-code <javascript|python|dotnet>   # config de lint da stack
```

Convenções podem ser combinadas no mesmo projeto; cada uma adiciona sua própria seção de regras.

Commite `.claude/conventions.json` para que o opt-in fique registrado no próprio repositório.

### GitFlow: o que é bloqueado quando ativo

- Branch fora de `feature|bugfix|hotfix|chore/<descricao-em-kebab>` ou `release/vX.Y.Z`; branch nascendo de `staging` ou `main`; criar `production`, `main` ou `staging` sem ser cópia da remota.
- Commit fora de Conventional Commits; commit, merge ou rebase local em `production`, `main` e `release/*`; commit direto em `staging`.
- Puxar `staging` ou `main` para outra branch (`merge`, `rebase`, `pull`).
- Push direto em `production` e `main`; force push sem lease; `--all`, `--mirror`, `--tags`; remoção de branches permanentes.
- Tags `v*` leves, fora de `vX.Y.Z`, movidas ou apagadas.
- `gh pr create` com título fora do padrão ou rota de branches não permitida.
- `gh pr create` para `main` vindo de qualquer branch que não seja `production`.
- `gh pr merge --admin`, sempre; `gh pr merge` sem `/conventions auto on`.
- Com `/conventions release off`: criar ou enviar `release/*`, criar ou enviar tags `v*`, resetar `staging` e abrir PR de release para `production` ou de backup para `main`.

A guarda local orienta o agente. A proteção definitiva fica nos rulesets e workflows do GitHub — veja [GitFlow/04-seguranca.md](GitFlow/04-seguranca.md).

## Estrutura

```text
.claude-plugin/          plugin.json e marketplace.json
hooks/register.ts        comando /conventions, injeção de regras e guarda de Bash
hooks/gitflow/           regras e validação do GitFlow
hooks/shared/            parser de shell, opt-in do projeto e cópia de templates
GitFlow/                 documentação, regras do agente (regras-agente.md) e templates
CleanCode/               documentação, regras do agente e templates de lint por stack
tests/                   testes do plugin
```

## Adicionando uma convenção

1. Crie a pasta da convenção com a documentação (ex.: `CodeReview/`), um `regras-agente.md` com as regras que o Claude deve seguir e, se houver, `templates/`.
2. Registre a convenção em `CONVENTIONS` em `hooks/register.ts` (`id`, `title`, `rulesPath`, `docsPath`, `templatesPath`, `templateVariants` quando os templates são por stack, `setupGuide` e `guardsBash`).
3. Se ela valida comandos, implemente o guard em `hooks/<id>/` e adicione o caso em `guardBash`.
4. Escreva os testes em `tests/` e adicione a convenção na tabela acima.

## Desenvolvimento

```bash
claude plugin validate .
claude plugin test .
uvx --with mkdocs-material --with mkdocs-same-dir --from mkdocs mkdocs serve   # site local
```

O site é publicado no GitHub Pages pelo workflow `.github/workflows/docs.yml` a cada push em `main`.
