import assert from 'node:assert/strict'
import test from 'node:test'
import { getAccountDisplayName } from '../../src/utils/accountIdentity'

test('账号菜单优先显示真实昵称', () => {
  assert.equal(getAccountDisplayName({
    id: 7,
    nickname: '沉默王二',
    email: 'itwanger@example.com',
  }), '沉默王二')
})

test('昵称为空时显示邮箱用户名', () => {
  assert.equal(getAccountDisplayName({
    id: 7,
    nickname: ' ',
    email: 'itwanger@example.com',
  }), 'itwanger')
})

test('通用微信昵称会优先回退到邮箱用户名', () => {
  assert.equal(getAccountDisplayName({
    id: 7,
    nickname: '微信用户',
    email: 'itwanger@example.com',
  }), 'itwanger')
})

test('没有昵称和邮箱时显示稳定的用户编号', () => {
  assert.equal(getAccountDisplayName({
    id: 7,
    nickname: '',
    email: null,
  }), '用户 #7')

  assert.equal(getAccountDisplayName({
    id: 8,
    nickname: '微信用户',
    email: null,
  }), '微信用户 #8')
})
