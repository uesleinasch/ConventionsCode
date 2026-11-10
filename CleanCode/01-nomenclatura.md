# 01 — Nomenclatura

O nome é a primeira (e geralmente a única) documentação que alguém lê.

## Regras gerais

- **Revele a intenção**: o nome diz *para que* serve, não *como* foi feito.
- **Sem abreviações** fora das universais do domínio (`id`, `url`, `http`, `dto`). `qtd`, `usr`, `tmp`, `aux`, `data2` são proibidos.
- **Sem ruído**: `Manager`, `Helper`, `Util`, `Info`, `Data`, `Object` só quando realmente acrescentam significado.
- **Unidade no nome** quando o tipo não a carrega: `timeoutMs`, `pesoKg`, `precoEmCentavos`.
- **Consistência**: um conceito, uma palavra. Não misture `fetch`, `get`, `retrieve` e `load` para a mesma ação.
- **Escopo × comprimento**: variável de laço de 3 linhas pode ser `i`; algo usado em vários arquivos precisa de nome completo.
- **Idioma**: siga o idioma do código existente no projeto; não misture idiomas no mesmo identificador.

## Por tipo de identificador

| Tipo | Forma | Exemplos |
|------|-------|----------|
| Função / método | verbo + objeto | `calculateTotal`, `sendInvoice`, `parseHeader` |
| Booleano | `is`, `has`, `can`, `should` + adjetivo/particípio | `isActive`, `hasPermission`, `canRetry` |
| Coleção | plural | `orders`, `pendingInvoices` |
| Mapa / dicionário | `<valor>By<chave>` | `userById`, `pricesBySku` |
| Classe / tipo | substantivo | `Invoice`, `PaymentGateway` |
| Interface (C#) | prefixo `I` | `IPaymentGateway` |
| Constante | nome do significado, não do valor | `MAX_RETRIES`, não `THREE` |
| Evento / handler | passado / `on` + evento | `OrderPaid`, `onOrderPaid` |

## Booleanos

- Sempre afirmativos: `isEnabled`, não `isNotDisabled`.
- Parâmetro booleano em chamada é ilegível (`send(order, true)`). Prefira duas funções ou um objeto de opções: `send(order, { isUrgent: true })`.

## Números e strings mágicas

Substitua literais com significado por constantes nomeadas:

```ts
if (attempts > 3) retry()             // ruim
if (attempts > MAX_RETRIES) retry()   // bom
```

Exceções: `0`, `1`, `-1`, `2` em operações óbvias (índice, incremento, metade).

## Variável explicativa no lugar de comentário

```ts
// verifica se o pedido pode ser cancelado
if (order.status === 'PAID' && !order.shippedAt && daysSince(order.paidAt) <= 7) { ... }
```

```ts
const isWithinCancellationWindow = daysSince(order.paidAt) <= CANCELLATION_DAYS
const canCancel = order.status === 'PAID' && !order.shippedAt && isWithinCancellationWindow
if (canCancel) { ... }
```
