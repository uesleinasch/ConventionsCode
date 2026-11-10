import type { EngineInterface } from 'claude-code'

export type CopyReport = { created: string[]; skipped: string[] }

export async function copyTemplates(
  $: EngineInterface,
  sourceDir: string,
  targetDir: string,
  prefix = '',
  report: CopyReport = { created: [], skipped: [] },
): Promise<CopyReport> {
  for (const entry of await $.fs.list(`${sourceDir}/${prefix}`)) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.kind === 'dir') {
      await copyTemplates($, sourceDir, targetDir, relative, report)
      continue
    }
    if (entry.kind !== 'file') continue
    const target = `${targetDir}/${relative}`
    if (await $.fs.exists(target)) {
      report.skipped.push(relative)
      continue
    }
    await $.fs.write(target, String(await $.fs.read(`${sourceDir}/${relative}`)))
    report.created.push(relative)
  }
  return report
}
