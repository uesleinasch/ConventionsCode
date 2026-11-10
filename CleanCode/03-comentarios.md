# 03 — Comentários

**Regra:** comentário em código só quando for **extremamente necessário** — quando o código, por mais bem nomeado que esteja, não consegue mostrar a informação.

Antes de escrever um comentário, tente nesta ordem:

1. Renomear a variável/função.
2. Extrair uma função com nome que explique o trecho.
3. Introduzir uma variável explicativa.
4. Expressar a regra com tipos (enum, tipo literal, value object).

Se nada disso resolve, o comentário é permitido.

## Permitido

| Caso | Exemplo |
|------|---------|
| **Restrição ou invariante invisível no código**, como acoplamento com outro arquivo, SQL ou sistema | `// Ordem dos campos deve bater com a procedure sp_export_orders.` |
| **Comportamento não óbvio de biblioteca externa** | `// O SDK reenvia automaticamente em 429; não envolver em retry próprio.` |
| **Decisão de segurança** que alguém "consertaria" sem o aviso | `// Comparação em tempo constante para evitar timing attack.` |
| **Cabeçalho de licença** exigido legalmente | `// SPDX-License-Identifier: MIT` |
| **Diretivas de ferramenta** (`eslint-disable-next-line`, `# noqa`, `@ts-expect-error`, `#pragma warning disable`) | Sempre com o motivo curto na mesma linha quando a ferramenta permitir. |

## Proibido

| Tipo | Exemplo ruim |
|------|--------------|
| Comentário que **parafraseia** a linha seguinte | `// incrementa o contador` acima de `count++` |
| Comentário **narrativo** ou de passo a passo | `// Primeiro buscamos o usuário, depois validamos...` |
| **Rationale de PR** ou histórico de mudança | `// Alterado para corrigir o bug do relatório` |
| Referência a **HU, task, ticket ou ADR** | `// Ver JIRA-123`, `// conforme ADR-007` |
| **Doc comment decorativo** (`<summary>`, JSDoc, docstring) que repete o nome | `/// <summary>Obtém o usuário.</summary>` em `GetUser()` |
| **Código comentado** | `// oldCalculate(order)` |
| **TODO / FIXME / HACK** | `// TODO: melhorar depois` → abra uma issue |
| **Separadores e banners** | `// ======== HELPERS ========` → extraia um módulo |
| Comentário de **fechamento de bloco** | `} // end if` |

## Documentação de API

Doc comments (`///`, JSDoc, docstrings) só quando a ferramenta os consome **e** acrescentam informação que a assinatura não mostra: contrato de erro, unidade, efeito colateral, pré-condição. Se o doc comment apenas repete o nome do método, remova.

Em C#, não habilite `GenerateDocumentationFile` só para silenciar `CS1591`; o template desta convenção desliga esse aviso.

## Onde fica o "porquê"

| Informação | Lugar |
|------------|-------|
| Decisão de arquitetura e alternativas descartadas | ADR / docs do projeto |
| Motivo de uma mudança | Mensagem de commit e descrição do PR |
| Trabalho pendente | Issue no tracker |
| Como usar um módulo | README do módulo ou testes como exemplos |
