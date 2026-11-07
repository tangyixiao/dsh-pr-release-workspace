/**
 * The CI rollup summariser.
 *
 * The one rule this file exists to protect: an empty rollup is *not* a green
 * build. "No CI configured" and "CI passed" look identical to `every(passed)` and
 * mean opposite things to a person deciding whether to merge, so the distinction
 * is asserted from several directions — absent, null, empty array, and an array
 * of items that all fail to normalise.
 *
 * @module dsh-pr-release-workspace/test/host-checks
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CI_VERDICT, summariseChecks } from '../lib/host/pull.js'

/** A check run as `gh pr view --json statusCheckRollup` reports it. */
const run = (name, conclusion, extra = {}) => ({ name, conclusion, ...extra })
/** A legacy commit status. */
const status = (context, state, extra = {}) => ({ context, state, ...extra })

test('an absent rollup is not_configured, never success', () => {
  const result = summariseChecks(undefined, 'abc123')

  assert.equal(result.verdict, CI_VERDICT.NOT_CONFIGURED)
  assert.notEqual(result.verdict, CI_VERDICT.SUCCESS)
  assert.equal(result.total, 0)
  assert.deepEqual(result.checks, [])
})

test('a null rollup is not_configured, never success', () => {
  const result = summariseChecks(null, 'abc123')

  assert.equal(result.verdict, CI_VERDICT.NOT_CONFIGURED)
  assert.notEqual(result.verdict, CI_VERDICT.SUCCESS)
})

test('an empty rollup is not_configured, never success', () => {
  const result = summariseChecks([], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.NOT_CONFIGURED)
  assert.notEqual(result.verdict, CI_VERDICT.SUCCESS)
  assert.equal(result.total, 0)
  assert.deepEqual(result.checks, [])
})

test('a rollup whose items all lack a name is not_configured, never success', () => {
  const result = summariseChecks([{ conclusion: 'success' }, { conclusion: 'success' }, null, 'junk'], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.NOT_CONFIGURED)
  assert.notEqual(result.verdict, CI_VERDICT.SUCCESS)
  assert.equal(result.total, 0)
})

test('every check succeeding is success', () => {
  const result = summariseChecks([run('lint', 'success'), run('test', 'success')], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.SUCCESS)
  assert.equal(result.total, 2)
  assert.equal(result.counts.success, 2)
})

test('one failure among successes is failure', () => {
  const result = summariseChecks(
    [run('lint', 'success'), run('test', 'failure'), run('build', 'success')],
    'abc123',
  )

  assert.equal(result.verdict, CI_VERDICT.FAILURE)
  assert.equal(result.counts.failure, 1)
  assert.equal(result.counts.success, 2)
})

test('one pending check among successes is pending', () => {
  const result = summariseChecks([run('lint', 'success'), run('e2e', null, { status: 'IN_PROGRESS' })], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.PENDING)
  assert.equal(result.counts.pending, 1)
})

test('one cancelled check among successes is cancelled', () => {
  const result = summariseChecks([run('lint', 'success'), run('long', 'cancelled')], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.CANCELLED)
  assert.equal(result.counts.cancelled, 1)
  assert.equal(result.counts.success, 1)
})

test('a failure outranks a cancelled and a pending check', () => {
  const result = summariseChecks(
    [run('a', 'failure'), run('b', 'cancelled'), run('c', null, { status: 'QUEUED' })],
    'abc123',
  )

  assert.equal(result.verdict, CI_VERDICT.FAILURE)
})

test('a cancelled check outranks a pending one', () => {
  const result = summariseChecks([run('a', 'cancelled'), run('b', null, { status: 'QUEUED' })], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.CANCELLED)
})

test('only skipped checks is skipped, never success', () => {
  const result = summariseChecks([run('docs', 'skipped')], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.SKIPPED)
  assert.notEqual(result.verdict, CI_VERDICT.SUCCESS)
  assert.equal(result.counts.skipped, 1)
})

test('a skipped check alongside a real success is still success', () => {
  const result = summariseChecks([run('docs', 'skipped'), run('test', 'success')], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.SUCCESS)
  assert.equal(result.counts.skipped, 1)
  assert.equal(result.counts.success, 1)
})

test('a neutral conclusion is a skip, not a failure and not a pass', () => {
  // GitHub's NEUTRAL conclusion means "nothing to do", so it must neither fail
  // the rollup nor count as evidence that something passed. The repo's rule
  // (pull.js:45) maps it to `skipped`.
  const alone = summariseChecks([run('optional', 'neutral')], 'abc123')
  const withPass = summariseChecks([run('optional', 'neutral'), run('test', 'success')], 'abc123')

  assert.equal(alone.verdict, CI_VERDICT.SKIPPED)
  assert.equal(alone.counts.failure, 0)
  assert.equal(alone.counts.skipped, 1)
  assert.equal(alone.checks[0].verdict, CI_VERDICT.SKIPPED)
  assert.equal(alone.checks[0].raw, 'neutral')

  assert.equal(withPass.verdict, CI_VERDICT.SUCCESS)
  assert.equal(withPass.counts.failure, 0)
})

test('a SKIPPED conclusion is counted as skipped and never as a failure', () => {
  const result = summariseChecks([run('docs', 'SKIPPED'), run('test', 'success')], 'abc123')

  assert.equal(result.counts.failure, 0)
  assert.equal(result.counts.skipped, 1)
  assert.equal(result.checks.find((check) => check.name === 'docs').verdict, CI_VERDICT.SKIPPED)
})

test('the counts object always carries every bucket the client reads', () => {
  const result = summariseChecks([run('test', 'success')], 'abc123')

  for (const key of ['success', 'failure', 'pending', 'cancelled', 'skipped', 'unknown']) {
    assert.equal(typeof result.counts[key], 'number', `counts.${key} should be a number`)
  }
})

test('the empty rollup still carries every counter at zero', () => {
  const result = summariseChecks(null, 'abc123')

  assert.deepEqual(result.counts, {
    success: 0,
    failure: 0,
    pending: 0,
    cancelled: 0,
    skipped: 0,
    unknown: 0,
  })
})

test('each row carries its own verdict and total matches the row count', () => {
  const result = summariseChecks(
    [
      run('lint', 'success', { workflowName: 'CI', detailsUrl: 'https://example.test/lint' }),
      run('test', 'failure', { workflowName: 'CI' }),
      status('deploy', 'pending'),
    ],
    'abc123',
  )

  assert.equal(result.total, 3)
  assert.equal(result.checks.length, 3)
  assert.deepEqual(
    result.checks.map((check) => [check.name, check.verdict]),
    [
      ['lint', CI_VERDICT.SUCCESS],
      ['test', CI_VERDICT.FAILURE],
      ['deploy', CI_VERDICT.PENDING],
    ],
  )
  assert.equal(result.checks[0].workflow, 'CI')
  assert.equal(result.checks[0].url, 'https://example.test/lint')
})

test('a timed-out, action-required or startup-failure check is a failure', () => {
  for (const conclusion of ['timed_out', 'action_required', 'startup_failure']) {
    const result = summariseChecks([run('job', conclusion)], 'abc123')
    assert.equal(result.verdict, CI_VERDICT.FAILURE, `${conclusion} should fail the rollup`)
    assert.equal(result.counts.failure, 1)
  }
})

test('a conclusion the module does not know is unknown, not success', () => {
  const result = summariseChecks([run('mystery', 'brand_new_conclusion')], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.UNKNOWN)
  assert.notEqual(result.verdict, CI_VERDICT.SUCCESS)
  assert.equal(result.counts.unknown, 1)
})

test('a stale conclusion is unknown', () => {
  const result = summariseChecks([run('job', 'stale')], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.UNKNOWN)
  assert.equal(result.counts.unknown, 1)
})

test('a non-array rollup that is present but not a list is unknown', () => {
  const result = summariseChecks({ total: 0 }, 'abc123')

  assert.equal(result.verdict, CI_VERDICT.UNKNOWN)
  assert.notEqual(result.verdict, CI_VERDICT.SUCCESS)
})

test('a legacy commit status is normalised from context and state', () => {
  const result = summariseChecks([status('ci/test', 'failure')], 'abc123')

  assert.equal(result.checks[0].name, 'ci/test')
  assert.equal(result.checks[0].verdict, CI_VERDICT.FAILURE)
  assert.equal(result.verdict, CI_VERDICT.FAILURE)
})

test('an error state on a legacy status is a failure', () => {
  const result = summariseChecks([status('ci/test', 'error')], 'abc123')

  assert.equal(result.verdict, CI_VERDICT.FAILURE)
})

test('the head SHA is passed through so a caller can tell which commit was summarised', () => {
  assert.equal(summariseChecks([run('test', 'success')], 'deadbeef').headSha, 'deadbeef')
  assert.equal(summariseChecks([], null).headSha, null)
})
