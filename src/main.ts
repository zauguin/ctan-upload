import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Blob } from 'node:buffer'
import { License, LICENSES } from './licenses'

type Github = ReturnType<typeof github.getOctokit>

function getMandatoryInput(name: string): string {
  return core.getInput(name, { required: true })
}

function getOptionalInput(name: string): string | undefined {
  return core.getInput(name) || undefined
}

function getInputs(name: string): string[] {
  const value = core.getInput(name)
  return value
    .split(',')
    .map(v => v.trim())
    .filter(v => v !== '')
}

type UploadData = {
  pkg: string
  version: string
  author: string
  email: string
  uploader: string
  ctanPath: string
  license: License[]
  home: string[]
  bugtracker: string[]
  support: string[]
  repository: string[]
  development: string[]
  update: boolean
  topic: string[]
  announcement?: string
  summary: string
  description?: string
  note?: string
  filename: string
}

async function buildFormData(uploadData: UploadData): Promise<FormData> {
  const formData = new FormData()
  formData.append('pkg', uploadData.pkg)
  formData.append('version', uploadData.version)
  formData.append('author', uploadData.author)

  formData.append('email', uploadData.email)
  formData.append('uploader', uploadData.uploader)

  formData.append('ctanPath', uploadData.ctanPath)
  for (const license of uploadData.license) {
    formData.append('license', license)
  }
  for (const url of uploadData.home) {
    formData.append('home', url)
  }
  for (const url of uploadData.bugtracker) {
    formData.append('bugtracker', url)
  }
  for (const url of uploadData.support) {
    formData.append('support', url)
  }
  for (const url of uploadData.repository) {
    formData.append('repository', url)
  }
  for (const url of uploadData.development) {
    formData.append('development', url)
  }
  if (uploadData.update !== undefined) {
    formData.append('update', uploadData.update ? 'true' : 'false')
  }
  for (const url of uploadData.topic) {
    formData.append('topic', url)
  }
  if (uploadData.announcement !== undefined) {
    formData.append('announcement', uploadData.announcement)
  }
  formData.append('summary', uploadData.summary)
  if (uploadData.description !== undefined) {
    formData.append('description', uploadData.description)
  }
  if (uploadData.note !== undefined) {
    formData.append('note', uploadData.note)
  }

  const file = await fs.open(uploadData.filename, 'r')
  formData.append(
    'file',
    new Blob([await file.readFile()]),
    path.basename(uploadData.filename)
  )
  await file.close()
  return formData
}

async function validateUpload(formData: FormData): Promise<Response> {
  core.info('Validating data')
  for (const [key, value] of formData) {
    core.info(`  ${key} => ${'string' == typeof value ? value : value.size}`)
  }
  return await fetch('https://www.ctan.org/submit/validate', {
    method: 'POST',
    body: formData
  })
}

async function executeUpload(formData: FormData): Promise<Response> {
  return await fetch('https://www.ctan.org/submit', {
    method: 'POST',
    body: formData
  })
}

async function addRepoData(
  uploadData: UploadData,
  octokit: Github
): Promise<UploadData> {
  const context = github.context
  const { data: repoData } = await octokit.rest.repos.get({
    ...context.repo
  })
  const repoUrl = repoData.html_url
  const repository =
    uploadData.repository.length === 0 ? [`${repoUrl}`] : uploadData.repository
  const bugtracker =
    uploadData.bugtracker.length === 0 && repoData.has_issues
      ? [`${repoUrl}/issues`]
      : uploadData.bugtracker
  return {
    ...uploadData,
    bugtracker,
    repository
  }
}

export async function run(): Promise<void> {
  try {
    const token = getMandatoryInput('repo-token')
    const octokit = github.getOctokit(token)

    const packageName = getMandatoryInput('package-name')
    const archiveFilename = getMandatoryInput('filename')
    const packageVersion = getMandatoryInput('version')
    const packageAuthor = getMandatoryInput('author')
    const uploaderEmail = getMandatoryInput('email')
    const uploaderName = getMandatoryInput('uploader')
    const ctanPath = getMandatoryInput('ctan-path')
    const licenses = getInputs('license')
    const home = getInputs('home')
    const bugtracker = getInputs('bugtracker')
    const support = getInputs('support')
    const repository = getInputs('repository')
    const development = getInputs('development')
    const update = core.getBooleanInput('update')
    const topic = getInputs('topic')
    const announcement = getOptionalInput('announcement')
    const summary = getMandatoryInput('summary')
    const description = getOptionalInput('description')
    const note = getOptionalInput('note')

    const dryRun = core.getBooleanInput('dry-run')

    const uploadData = {
      pkg: packageName,
      version: packageVersion,
      author: packageAuthor,
      email: uploaderEmail,
      uploader: uploaderName,
      ctanPath,
      license: licenses.map(license => {
        if (LICENSES.has(license)) {
          return license as License
        } else {
          throw new Error('Unknown license')
        }
      }),
      home,
      bugtracker,
      support,
      repository,
      development,
      update,
      topic,
      announcement,
      summary,
      description,
      note,
      filename: archiveFilename
    }

    core.debug(`Running action`)

    const formData = await buildFormData(await addRepoData(uploadData, octokit))
    const validationResponse = await validateUpload(formData)
    if (!validationResponse.ok) {
      core.error(
        `Error response (code ${validationResponse.status}): ${await validationResponse.text()}`
      )
      core.setFailed('Validation failed')
      return
    }
    core.info(`Validation result: ${validationResponse.text()}`)

    if (!dryRun) {
      const uploadResponse = await executeUpload(formData)
      if (!uploadResponse.ok) {
        core.error(
          `Error response (code ${uploadResponse.status}): ${await uploadResponse.text()}`
        )
        core.setFailed('Upload failed')
        return
      }
      core.info(`Upload result: ${uploadResponse.text()}`)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.toString())
  }
}
