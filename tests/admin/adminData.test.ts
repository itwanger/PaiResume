import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  ResumeReviewAdminRequest,
  UserAdmin,
} from '../../src/api/admin'
import {
  filterAdminUsers,
  getUserAdminLabel,
  resumeReviewNeedsAdminAction,
} from '../../src/components/admin/adminData'

function buildUser(overrides: Partial<UserAdmin> = {}): UserAdmin {
  return {
    id: 42,
    email: 'admin@example.com',
    nickname: '管理员',
    role: 'USER',
    membershipStatus: 'FREE',
    membershipGrantedAt: null,
    membershipExpiresAt: null,
    membershipSource: null,
    createdAt: '2026-07-24T00:00:00Z',
    ...overrides,
  }
}

function buildResumeReview(
  overrides: Partial<ResumeReviewAdminRequest> = {},
): ResumeReviewAdminRequest {
  return {
    requestNo: 'RR202607240001',
    orderNo: null,
    resumeId: 1,
    entitlementType: 'WELCOME_FREE',
    requestStatus: 'COMPLETED',
    priceCents: 0,
    currency: 'CNY',
    paidAt: null,
    contactEmail: 'test@example.com',
    createdAt: '2026-07-24T00:00:00Z',
    updatedAt: '2026-07-24T00:00:00Z',
    userId: 42,
    provider: null,
    payChannel: null,
    providerTransactionId: null,
    refundReference: null,
    handledBy: null,
    acceptedAt: null,
    completedAt: null,
    returnedAt: null,
    mailStatus: null,
    mailAttemptCount: null,
    mailLastErrorType: null,
    mailNextAttemptAt: null,
    mailSentAt: null,
    ...overrides,
  }
}

test('纯扫码账号没有邮箱时仍可搜索且不会崩溃', () => {
  const wechatUser = buildUser({
    id: 88,
    email: null,
    nickname: '微信用户',
    membershipStatus: 'ACTIVE',
  })
  const users = [buildUser(), wechatUser]

  assert.equal(getUserAdminLabel(wechatUser), '微信用户')
  assert.deepEqual(filterAdminUsers(users, '微信', ''), [wechatUser])
  assert.deepEqual(filterAdminUsers(users, '88', 'ACTIVE'), [wechatUser])
  assert.deepEqual(filterAdminUsers(users, 'admin@example.com', ''), [users[0]])
})

test('没有邮箱和昵称的账号回退到稳定用户编号', () => {
  assert.equal(getUserAdminLabel(buildUser({ email: null, nickname: null })), '用户 #42')
})

test('人工精修待办只统计真正需要管理员介入的状态', () => {
  assert.equal(resumeReviewNeedsAdminAction(buildResumeReview({ requestStatus: 'EMAILED' })), true)
  assert.equal(resumeReviewNeedsAdminAction(buildResumeReview({ requestStatus: 'ACCEPTED' })), true)
  assert.equal(resumeReviewNeedsAdminAction(buildResumeReview({ requestStatus: 'REFUND_REQUIRED' })), true)
  assert.equal(resumeReviewNeedsAdminAction(buildResumeReview({
    requestStatus: 'EMAIL_PENDING',
    mailStatus: 'FAILED',
  })), true)
  assert.equal(resumeReviewNeedsAdminAction(buildResumeReview({
    requestStatus: 'EMAIL_PENDING',
    mailStatus: 'SENDING',
  })), false)
  assert.equal(resumeReviewNeedsAdminAction(buildResumeReview({ requestStatus: 'COMPLETED' })), false)
})
