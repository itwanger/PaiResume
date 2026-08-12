import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { contentLibraryApi, type ResumeHistoryMaterial } from '../api/contentLibrary'
import { Header } from '../components/layout/Header'
import { MODULE_LABELS, type ModuleType } from '../types'
import { getMaterialPreview, hasMeaningfulMaterialValue, omitUnusedBasicInfoFields } from '../utils/materialLibrary'

export default function MyMaterialsPage() {
  const [materials, setMaterials] = useState<ResumeHistoryMaterial[]>([])
  const [filter, setFilter] = useState<'' | ModuleType>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await contentLibraryApi.listHistoryMaterials()
        setMaterials(response.data.data)
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : '加载资料库失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const filteredMaterials = useMemo(
    () => materials.filter((item) => item.moduleType !== 'basic_info')
      .filter((item) => filter ? item.moduleType === filter : true),
    [filter, materials],
  )
  const latestBasicInfo = materials.find((item) => item.moduleType === 'basic_info')
  const profileEntries = Object.entries(omitUnusedBasicInfoFields(latestBasicInfo?.content ?? {}))
    .filter(([key]) => !['photoId', 'photoWidth', 'photoHeight', 'photoBorder'].includes(key))
    .filter(([, value]) => hasMeaningfulMaterialValue(value))

  const deleteMaterial = async (id: number) => {
    try {
      await contentLibraryApi.deleteMyMaterial(id)
      setMaterials((current) => current.filter((item) => item.legacyMaterialId !== id))
      setPendingDeleteId(null)
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '删除资料失败')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-950">我的资料库</h1>
          <Link to="/dashboard" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-200 hover:text-primary-700">返回我的简历</Link>
        </div>

        {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
        {loading ? <p className="mt-8 text-sm text-slate-500">正在加载资料库…</p> : null}

        {!loading ? (
          <div className="mt-8 space-y-8">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">基本信息资料</h2>
                {latestBasicInfo ? <span className="text-xs text-slate-500">{sourceLabel(latestBasicInfo)}</span> : null}
              </div>
              {profileEntries.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {profileEntries.map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">{PROFILE_LABELS[key] ?? key}</p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-800">{formatProfileValue(key, value)}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-5 text-sm text-slate-500">历史简历中暂无可复用的基本信息。</p>}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">模块资料</h2>
                <select value={filter} onChange={(event) => setFilter(event.target.value as '' | ModuleType)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">全部类型</option>
                  {Object.entries(MODULE_LABELS).filter(([type]) => type !== 'basic_info').map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                </select>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredMaterials.map((material) => (
                  <article key={material.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-primary-700">{MODULE_LABELS[material.moduleType]}</span>
                        <h3 className="mt-1 truncate font-semibold text-slate-900">{material.title}</h3>
                        <p className="mt-1 truncate text-xs text-slate-400">{sourceLabel(material)}</p>
                      </div>
                      {material.sourceType === 'LEGACY_LIBRARY' && material.legacyMaterialId && pendingDeleteId === material.legacyMaterialId ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setPendingDeleteId(null)} className="text-xs text-slate-500">取消</button>
                          <button type="button" onClick={() => void deleteMaterial(material.legacyMaterialId!)} className="text-xs font-medium text-red-600">确认删除</button>
                        </div>
                      ) : material.sourceType === 'LEGACY_LIBRARY' && material.legacyMaterialId ? (
                        <button type="button" onClick={() => setPendingDeleteId(material.legacyMaterialId!)} className="text-xs text-slate-400 hover:text-red-600">删除旧资料</button>
                      ) : null}
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{getMaterialPreview(material.content) || '结构化资料'}</p>
                  </article>
                ))}
              </div>
              {!filteredMaterials.length ? <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">历史简历中暂无该类型的可复用资料。</p> : null}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function sourceLabel(material: ResumeHistoryMaterial): string {
  if (material.sourceType === 'HISTORY_RESUME') {
    return material.sourceResumeTitle ? `来自简历：${material.sourceResumeTitle}` : '来自历史简历'
  }
  return '来自旧版个人资料库'
}

const PROFILE_LABELS: Record<string, string> = {
  name: '姓名', email: '邮箱', jobIntention: '求职意向', targetCity: '意向城市', phone: '手机号',
  wechat: '微信号', isPartyMember: '党员', hometown: '籍贯', blog: '博客', github: 'GitHub',
  leetcode: 'LeetCode', workYears: '工作年限', photo: '照片',
}

function formatProfileValue(key: string, value: unknown): string {
  if (key === 'photo') return '已保存'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'string') return value.startsWith('data:image/') ? '已保存' : value
  return String(value ?? '')
}
