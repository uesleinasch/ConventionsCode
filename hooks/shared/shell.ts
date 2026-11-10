export type Segment = readonly string[]

const OPERATORS = ['&&', '||', ';', '|', '&', '\n']

export function splitSegments(command: string): Segment[] {
  const segments: string[][] = []
  let tokens: string[] = []
  let token = ''
  let hasToken = false
  let quote: "'" | '"' | undefined
  let depth = 0

  const pushToken = () => {
    if (hasToken) tokens.push(token)
    token = ''
    hasToken = false
  }
  const pushSegment = () => {
    pushToken()
    if (tokens.length > 0) segments.push(tokens)
    tokens = []
  }

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!

    if (quote === "'") {
      if (ch === "'") quote = undefined
      else token += ch
      continue
    }

    if (ch === '\\' && i + 1 < command.length) {
      const nextCh = command[i + 1]!
      if (nextCh === '\n') {
        i++
        continue
      }
      token += quote === '"' && !'"\\$`'.includes(nextCh) ? ch + nextCh : nextCh
      hasToken = true
      i++
      continue
    }

    if (ch === '$' && command[i + 1] === '(') {
      depth++
      token += '$('
      hasToken = true
      i++
      continue
    }

    if (depth > 0) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      token += ch
      continue
    }

    if (quote === '"') {
      if (ch === '"') quote = undefined
      else token += ch
      continue
    }

    if (ch === "'" || ch === '"') {
      quote = ch
      hasToken = true
      continue
    }

    const operator = OPERATORS.find(op => command.startsWith(op, i))
    if (operator) {
      pushSegment()
      i += operator.length - 1
      continue
    }

    if (ch === ' ' || ch === '\t') {
      pushToken()
      continue
    }

    token += ch
    hasToken = true
  }

  pushSegment()
  return segments
}

const HEREDOC = /^\$\(\s*cat\s+<<-?\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1\s*\)$/

export function resolveMessage(value: string): string | undefined {
  const heredoc = HEREDOC.exec(value.trim())
  if (heredoc) return heredoc[2]
  if (value.includes('$(') || value.includes('`')) return undefined
  return value
}

const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])

export type Invocation = { program: 'git' | 'gh'; args: readonly string[] }

export function invocationOf(segment: Segment): Invocation | undefined {
  let i = 0
  while (i < segment.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(segment[i]!)) i++
  const program = segment[i]
  if (program !== 'git' && program !== 'gh') return undefined
  i++

  if (program === 'git') {
    while (i < segment.length && segment[i]!.startsWith('-')) {
      if (GIT_GLOBAL_WITH_VALUE.has(segment[i]!)) i++
      i++
    }
  }

  return { program, args: segment.slice(i) }
}
