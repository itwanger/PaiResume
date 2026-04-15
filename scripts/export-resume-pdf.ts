import fs from 'node:fs/promises'
import { generateResumePdfBlob } from '../src/utils/resumePdf'

interface WorkerInput {
  modules: Array<{
    id: number
    resumeId: number
    moduleType: string
    content: Record<string, unknown>
    sortOrder: number
    createdAt?: string
    updatedAt?: string
  }>
  options?: {
    pageMode?: 'standard' | 'continuous'
    templateId?: string
    density?: string
    accentPreset?: string
    headingStyle?: string
  }
}

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) {
    return null
  }
  return process.argv[index + 1]
}

async function readStdin() {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const outputPath = getArgValue('--output')
  if (!outputPath) {
    throw new Error('Missing --output argument')
  }

  const rawInput = await readStdin()
  if (!rawInput.trim()) {
    throw new Error('Missing worker input')
  }

  const input = JSON.parse(rawInput) as WorkerInput
  const blob = await generateResumePdfBlob(input.modules, input.options)
  const buffer = Buffer.from(await blob.arrayBuffer())
  await fs.writeFile(outputPath, buffer)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
