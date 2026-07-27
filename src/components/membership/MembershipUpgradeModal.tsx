import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { membershipApi } from '../../api/membership'
import { useAuthStore } from '../../store/authStore'
import { buildMembershipPath } from '../../utils/navigation'

interface Props {
  open: boolean
  onClose: () => void
}

export function MembershipUpgradeModal({ open, onClose }: Props) {
  const location = useLocation()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const [inviteCode, setInviteCode] = useState('')
  const [redeemingInvite, setRedeemingInvite] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const returnTo = `${location.pathname}${location.search}${location.hash}`

  const redeemInvite = async () => {
    if (!inviteCode.trim()) {
      setInviteError('请输入 VIP 邀请码')
      return
    }
    setRedeemingInvite(true)
    setInviteError('')
    try {
      await membershipApi.redeemInvite(inviteCode.trim())
      await refreshUser()
      onClose()
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : '邀请码兑换失败')
    } finally {
      setRedeemingInvite(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">开通 VIP</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            关闭
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
            <label className="mb-2 block text-sm font-semibold text-emerald-950">知识星球 VIP 邀请码</label>
            <p className="mb-3 text-xs leading-5 text-emerald-800">每个账号限领一次，不能叠加。</p>
            <div className="flex gap-3">
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="输入知识星球 VIP 邀请码"
                className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={() => void redeemInvite()}
                disabled={redeemingInvite}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {redeemingInvite ? '兑换中...' : '兑换邀请码'}
              </button>
            </div>
            {inviteError ? <p className="mt-2 text-sm text-red-600" role="alert">{inviteError}</p> : null}
          </div>

          <Link
            to={buildMembershipPath(returnTo)}
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            前往开通
          </Link>
        </div>
      </div>
    </div>
  )
}
