import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_VIEWS,
  buildAdminViewPath,
  isAdminView,
} from '../../src/components/admin/adminNavigation'

test('所有后台视图都有稳定可分享的深链', () => {
  for (const view of ADMIN_VIEWS) {
    const path = buildAdminViewPath(view)
    assert.equal(path, view === 'overview' ? '/admin' : `/admin?view=${view}`)
    assert.equal(isAdminView(view), true)
  }
})

test('非法后台视图不会通过类型守卫', () => {
  assert.equal(isAdminView(null), false)
  assert.equal(isAdminView('unknown-view'), false)
})
