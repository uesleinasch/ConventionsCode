# Código limpo e comentários

Convenção para código que **se explica pela estrutura e pelos nomes**. Comentário é exceção justificada, não ferramenta de explicação.

## Princípios

1. **Nome antes de comentário.** Se um trecho precisa de explicação, primeiro tente renomear, extrair função ou introduzir uma variável explicativa.
2. **Uma responsabilidade por unidade.** Função faz uma coisa; módulo tem um motivo para mudar.
3. **Fluxo raso.** Guard clauses e retorno antecipado em vez de aninhamento.
4. **Explícito vence esperto.** Código legível por quem chega amanhã, sem truques.
5. **Decisão vive em ADR/docs, não no fonte.** O código mostra *o quê* e *como*; o *porquê* de longo prazo fica na documentação de decisão.
6. **Ferramenta aplica, revisão confirma.** Linters barram o mensurável (complexidade, profundidade, código comentado); a revisão cuida do resto.

## Documentos

| Doc | Conteúdo |
|-----|----------|
| [01-nomenclatura.md](01-nomenclatura.md) | Como nomear variáveis, funções, tipos, booleanos e constantes |
| [02-funcoes-e-estrutura.md](02-funcoes-e-estrutura.md) | Tamanho, parâmetros, aninhamento, erros, código morto |
| [03-comentarios.md](03-comentarios.md) | Quando um comentário é permitido e o que é proibido |
| [04-ferramentas.md](04-ferramentas.md) | Linters por stack e checklist de revisão |

## Limites de referência

| Métrica | Limite |
|---------|--------|
| Complexidade ciclomática por função | ≤ 10 |
| Profundidade de aninhamento | ≤ 3 |
| Parâmetros por função | ≤ 3 (acima disso, objeto de parâmetros) |
| Linhas por função (sem brancos) | ≤ 40 |
| Código comentado | 0 |
| `TODO` / `FIXME` no código | 0 (vira issue) |

Limites são alarmes, não metas: uma função de 15 linhas pode estar errada, e uma de 45 pode estar certa — mas a de 45 precisa de justificativa na revisão.
