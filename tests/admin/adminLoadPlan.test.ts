import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_DATA_SECTIONS,
  ADMIN_VIEW_LOAD_SECTIONS,
  getAdminViewFailedSections,
  getAdminViewLoadState,
  type AdminDataSection,
} from '../../src/components/admin/adminLoadPlan'
import { ADMIN_VIEWS } from '../../src/components/admin/adminNavigation'

test('13 个后台视图都有明确且无重复的数据加载计划', () => {
  assert.deepEqual(Object.keys(ADMIN_VIEW_LOAD_SECTIONS), [...ADMIN_VIEWS])
  for (const view of ADMIN_VIEWS) {
    const sections = ADMIN_VIEW_LOAD_SECTIONS[view]
    assert.equal(new Set(sections).size, sections.length, `${view} 存在重复数据分块`)
    for (const section of sections) {
      assert.equal(ADMIN_DATA_SECTIONS.includes(section), true)
    }
  }
})

test('业务深链只声明自身必需的数据分块', () => {
  assert.equal(ADMIN_VIEW_LOAD_SECTIONS.overview.includes('creatorEarningCount'), true)
  assert.equal(ADMIN_VIEW_LOAD_SECTIONS.overview.includes('creatorEarnings'), false)
  assert.equal(ADMIN_VIEW_LOAD_SECTIONS.overview.includes('marketPaymentIssues'), true)
  assert.equal(ADMIN_VIEW_LOAD_SECTIONS.overview.includes('paymentReviews'), false)
  assert.equal(ADMIN_VIEW_LOAD_SECTIONS.overview.includes('resumeReviewActionCount'), true)
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS.members, ['users'])
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS['vip-invites'], ['vipInvites'])
  assert.deepEqual(
    ADMIN_VIEW_LOAD_SECTIONS['membership-payments'],
    ['membershipSummary', 'membershipOrders'],
  )
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS.showcases, ['showcases', 'resumes'])
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS['marketplace-listings'], ['marketListings'])
  assert.deepEqual(
    ADMIN_VIEW_LOAD_SECTIONS['creator-earnings'],
    ['creatorEarnings', 'creatorEarningCount'],
  )
  assert.deepEqual(
    ADMIN_VIEW_LOAD_SECTIONS['marketplace-payments'],
    ['paymentReviews', 'marketPaymentIssues', 'paymentCloseWork'],
  )
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS.surveys, ['feedbacks', 'coupons'])
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS['platform-config'], ['platformConfig'])
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS['audit-logs'], ['membershipAuditLogs'])
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS['marketplace-governance'], ['governance'])
  assert.deepEqual(ADMIN_VIEW_LOAD_SECTIONS['resume-reviews'], ['resumeReviewActionCount'])
})

test('当前视图在未完成、失败和成功时返回互斥加载状态', () => {
  const empty = new Set<AdminDataSection>()
  assert.equal(getAdminViewLoadState('members', empty, empty, empty), 'loading')

  const failed = new Set<AdminDataSection>(['users'])
  assert.equal(getAdminViewLoadState('members', empty, empty, failed), 'failed')
  assert.deepEqual(getAdminViewFailedSections('members', failed), ['users'])

  const loaded = new Set<AdminDataSection>(['users'])
  assert.equal(getAdminViewLoadState('members', loaded, empty, empty), 'ready')

  const loading = new Set<AdminDataSection>(['users'])
  assert.equal(getAdminViewLoadState('members', loaded, loading, empty), 'loading')
})
