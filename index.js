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

  console.log(
    `[*] Got a push notification, commit ${payload.head_commit.message}, pulling...`
  )

  const deployment = await octokit.repos.createDeployment({
    ...repo,
    ref: payload.ref,
  })

  const id = deployment.data.id
  const pull = spawn('git', ['pull'], {
    cwd: '/finkrer.wtf',
  })

  let success = true

  pull.on('error', (error) => {
    console.log(`[!] Error when pulling: ${error.message}`)
    success = false
  })

  pull.on('exit', () => {
    if (success) console.log('[*] Pull successful, now buildng...')
    const build = spawn('docker-compose', ['up', '-d', '--build'], {
      cwd: '/finkrer.wtf',
    })

    build.on('error', (error) => {
      console.log(`[!] Error when building: ${error.message}`)
      success = false
    })
    build.on('exit', () => {
      console.log(
        `[*] Finished, the build ${success ? 'was successful' : 'failed'}`
      )
      octokit.repos.createDeploymentStatus({
        ...repo,
        deployment_id: id,
        state: success ? 'success' : 'failure',
      })
    })
  })
})

http.createServer(webhooks.middleware).listen(8888)
