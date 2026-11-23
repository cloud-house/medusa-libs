import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type EmailsOptions, resolveOptions } from './options'
import { renderEmail } from './render'

/** One e-mail to preview: the template name and the data the notification would carry. */
export interface EmailFixture {
  template: string
  data: Record<string, unknown>
}

/**
 * Renders every fixture and writes the HTML to `options.previewDir`; returns the file paths.
 * The shop supplies the fixtures (e.g. from a `medusa exec` script) – the plugin has no demo data.
 */
export async function previewEmails(
  options: EmailsOptions,
  fixtures: EmailFixture[],
): Promise<string[]> {
  const resolved = resolveOptions(options)
  if (!resolved.previewDir) throw new Error('@cloud-house/medusa-emails: previewDir is required.')
  await mkdir(resolved.previewDir, { recursive: true })
  const files: string[] = []
  for (const { template, data } of fixtures) {
    const email = await renderEmail(resolved, template, data)
    const file = join(resolved.previewDir, `${email.name}.html`)
    await writeFile(file, email.html)
    files.push(file)
  }
  return files
}
