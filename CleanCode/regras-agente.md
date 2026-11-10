Regras obrigatórias de código neste projeto. Documentação completa no diretório CleanCode do plugin conventions-code.

## Comentários
- Escreva comentário **só quando for extremamente necessário**: restrição/invariante que o código não mostra (acoplamento com outro arquivo, SQL ou sistema), comportamento não óbvio de biblioteca externa, decisão de segurança que alguém "consertaria" sem o aviso, cabeçalho de licença obrigatório, ou diretiva de ferramenta (`eslint-disable`, `noqa`, `@ts-expect-error`) com motivo curto.
- **Nunca** escreva: comentário narrativo ou que parafraseia a linha; rationale de PR ou histórico; referência a HU/task/ticket/ADR; `<summary>`/JSDoc/docstring que só repete o nome; código comentado; TODO/FIXME/HACK (sugira abrir issue); banners e separadores; `// end if`.
- Antes de comentar, tente renomear, extrair função, criar variável explicativa ou usar tipos.
- Ao editar código existente, não adicione comentários novos fora dessas regras; não remova comentários alheios sem o usuário pedir, exceto os que você mesmo criou.

## Nomes
- Nomes revelam intenção; sem abreviações (exceto `id`, `url`, `http`, `dto`...) e sem ruído (`Helper`, `Util`, `Data`, `Info`).
- Funções: verbo + objeto. Booleanos: `is/has/can/should` + afirmativo. Coleções no plural. Mapas `valorByChave`.
- Unidade no nome quando o tipo não a carrega (`timeoutMs`). Literais com significado viram constantes nomeadas.
- Siga o idioma e o estilo de nomes já usados no projeto.

## Funções e estrutura
- Uma responsabilidade e um nível de abstração por função; até 3 parâmetros (senão, objeto de parâmetros); sem parâmetro booleano de flag.
- Guard clauses e retorno antecipado; aninhamento ≤ 3; sem `else` após `return`; sem ternário aninhado.
- Complexidade ciclomática ≤ 10 e ~40 linhas por função como alarme.
- Nunca engula exceção; erros específicos; valide na fronteira.
- Prefira imutabilidade; remova código morto, imports e parâmetros sem uso.
- Extraia duplicação na terceira ocorrência e só se for o mesmo conceito.
