# 02 — Funções e estrutura

## Funções

- **Fazem uma coisa.** Se a descrição precisa de "e", são duas funções.
- **Um nível de abstração por função.** Orquestração (`processOrder`) não mistura com detalhe (montar SQL, formatar string).
- **Até 3 parâmetros.** Mais que isso: objeto de parâmetros nomeado.
- **Sem parâmetro-flag.** `render(true)` vira `renderPreview()` / `renderFinal()`.
- **Efeitos colaterais explícitos no nome.** `getUser` não grava; `getOrCreateUser` deixa claro que pode gravar.
- **Comando ou consulta.** Uma função altera estado *ou* retorna informação — evite as duas coisas.

## Fluxo raso: guard clauses

```ts
function ship(order: Order) {
  if (order) {
    if (order.isPaid) {
      if (!order.isShipped) {
        dispatch(order)
      }
    }
  }
}
```

```ts
function ship(order: Order) {
  if (!order || !order.isPaid || order.isShipped) return
  dispatch(order)
}
```

- Profundidade máxima: 3 níveis.
- Sem `else` após `return`/`throw`.
- Sem ternário aninhado.

## Erros

- **Nunca engolir exceção.** `catch {}` vazio ou que só loga e segue é proibido, salvo quando ignorar é a regra de negócio — e então o nome da função deixa isso claro (`tryParse`, `deleteIfExists`).
- **Erros específicos.** Lance/capture o tipo mais específico possível.
- **Falhe cedo.** Valide entradas na fronteira (API, CLI, fila) e confie nelas no núcleo.
- **Mensagem de erro útil**: o que falhou e com qual valor relevante, sem dados sensíveis.

## Dados

- Prefira imutabilidade (`const`, `readonly`, records/dataclasses congeladas).
- Não reutilize variável para significados diferentes.
- Declare a variável perto de onde é usada.

## Código morto e duplicação

- **Código comentado é proibido.** O histórico está no Git.
- Remova imports, variáveis, parâmetros e branches não usados.
- Duplicação: tolere na segunda ocorrência, extraia na terceira (regra de três) — e só se for o mesmo conceito, não coincidência de forma.

## Módulos

- Um motivo para mudar por módulo/classe.
- Dependências apontam para dentro (domínio não importa infraestrutura).
- Exporte o mínimo; o que não é usado fora fica privado.
