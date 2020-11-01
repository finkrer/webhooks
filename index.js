import { Webhooks } from '@octokit/webhooks'
import { Octokit } from '@octokit/rest'
import http from 'http'
import { spawn } from 'child_process'
import dotenv from 'dotenv'

dotenv.config()

console.log('[*] Listening on port 8888...')

const webhooks = new Webhooks({ secret: process.env.GITHUB_WEBHOOK_SECRET })
const octokit = new Octokit({ auth: process.env.GITHUB_API_TOKEN })

const repo = {
  owner: 'finkrer',
  repo: 'finkrer.wtf',
}

webhooks.on('push', async ({ payload }) => {
  if (payload.repository.name !== 'finkrer.wtf') return

  const deployment = await octokit.repos.createDeployment({
    ...repo,
    ref: payload.ref,
  })

  const id = deployment.data.id
  const pull = spawn('/usr/bin/git', ['pull'], {
    cwd: '/finkrer.wtf',
    shell: true,
  })

  const success = true

  pull.stderr.on('data', () => (success = false))

  pull.stdout.on('close', () => {
    const build = spawn('/usr/bin/docker-compose', ['up', '-d', '--build'], {
      cwd: '/finkrer.wtf',
      shell: true,
    })

    build.stderr.on('data', () => (success = false))
    build.stdout.on('close', () => {
      octokit.repos.createDeploymentStatus({
        ...repo,
        deployment_id: id,
        state: success ? 'success' : 'failure',
      })
    })
  })
})

http.createServer(webhooks.middleware).listen(8888)
