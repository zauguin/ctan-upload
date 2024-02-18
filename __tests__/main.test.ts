/**
 * Unit tests for the action's main functionality, src/main.ts
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as main from '../src/main'

jest.mock('@actions/github', () => ({
  context: {
    repo: {
      user: 'foo',
      repo: 'bar'
    }
  },
  getOctokit: jest.fn()
}))
const githubMock = jest.mocked(github)
const runMock = jest.spyOn(main, 'run')

// let debugMock: jest.SpyInstance
let errorMock: jest.SpyInstance
let getInputMock: jest.SpyInstance
let getBooleanInputMock: jest.SpyInstance
let setFailedMock: jest.SpyInstance
let fetchMock: jest.SpyInstance

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    getBooleanInputMock = jest
      .spyOn(core, 'getBooleanInput')
      .mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation()
  })

  it('validates the upload', async () => {
    // Set the action's inputs as return values from core.getInput()
    mockInput()
    githubMock.getOctokit.mockReturnValue({
      rest: {
        repos: {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore:
          get: jest.fn(async _args => {
            return {
              data: {
                html_url: 'main-url',
                has_issues: false
              }
            }
          })
        }
      }
    })
    fetchMock.mockImplementation(async (_url: URL) => ({
      ok: true,
      async text() {
        'foobar'
      }
    }))

    await main.run()
    expect(runMock).toHaveReturned()

    // expect(debugMock).toHaveBeenNthCalledWith(1, 'Waiting 500 milliseconds ...')
    // expect(debugMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
  })
})

function mockInput(): void {
  getInputMock.mockImplementation(
    (name: string, options?: { required: boolean }): string => {
      switch (name) {
        case 'package-name':
          return 'package'
        case 'filename':
          return 'file.zip'
        case 'version':
          return '0.0.0'
        case 'author':
          return 'The Author'
        case 'email':
          return 'foobar@example.com'
        case 'uploader':
          return 'The Uploader'
        case 'ctan-path':
          return '/some/path'
        case 'license':
          return 'lppl1.3'
        case 'summary':
          return 'Some useful package'
        case 'repo-token':
          return 'SOME-SECRET-TOKEN'
        default:
          if (options?.required) {
            throw new Error(`Input required and not supplied: ${name}`)
          } else {
            return ''
          }
      }
    }
  )
  getBooleanInputMock.mockImplementation((name: string): boolean => {
    switch (name) {
      case 'dry-run':
        return false
      case 'update':
        return true
      default:
        throw new Error(`Input required and not supplied: ${name}`)
    }
  })
}
