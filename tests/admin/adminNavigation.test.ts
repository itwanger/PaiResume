import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_NAVIGATION,
  ADMIN_VIEW_META,
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

test('15 个后台视图都有唯一且完整的导航元数据', () => {
  const items = ADMIN_NAVIGATION.flatMap((group) => group.items)
  assert.equal(items.length, 15)
  assert.deepEqual(items.map((item) => item.id), [...ADMIN_VIEWS])
  assert.equal(new Set(items.map((item) => item.id)).size, ADMIN_VIEWS.length)
  assert.equal(new Set(items.map((item) => item.label)).size, ADMIN_VIEWS.length)

  for (const view of ADMIN_VIEWS) {
    const meta = ADMIN_VIEW_META[view]
    assert.equal(meta.id, view)
    assert.equal(meta.label.trim().length > 0, true)
    assert.equal(meta.shortLabel.trim().length > 0, true)
  }
})
