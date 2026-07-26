import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '../components/branding/LogoMark'
import {
  AI_PROVIDER_NAME,
  AI_PROVIDER_PRIVACY_URL,
  LEGAL_DISCLOSURE_READY,
  OPERATOR_NAME,
  SUPPORT_EMAIL,
} from '../config/legalDisclosure'
import { GITHUB_REPOSITORY_URL } from '../config/site'

const LAST_UPDATED = '2026年7月24日'

interface PolicySectionProps {
  title: string
  children: ReactNode
}

function PolicySection({ title, children }: PolicySectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  )
}

interface PolicyPageProps {
  eyebrow: string
  title: string
  summary: string
  children: ReactNode
}

function PolicyPage({ eyebrow, title, summary, children }: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="返回派简历首页">
            <LogoMark className="h-9 w-9" />
            <span className="font-semibold tracking-tight">派简历</span>
          </Link>
          <Link to="/register" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            返回注册
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <article className="border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="border-b border-slate-200 pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{summary}</p>
            <p className="mt-3 text-xs text-slate-400">更新日期：{LAST_UPDATED}</p>
          </div>
          {!LEGAL_DISCLOSURE_READY ? (
            <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
              运营主体、私密客服或第三方 AI 服务商披露尚未配置完整。此构建仅可用于本地开发，不能部署到生产环境。
            </div>
          ) : null}
          <div className="mt-8 space-y-9">{children}</div>
        </article>
      </main>

    </div>
  )
}

export function PrivacyPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy Policy"
      title="隐私政策"
      summary="本政策说明派简历在提供账号、简历编辑、人工智能辅助和支付服务时，如何收集、使用、保存和保护你的信息。"
    >
      <PolicySection title="一、个人信息处理者与联系方式">
        {OPERATOR_NAME ? (
          <p>本产品“派简历”由<strong className="font-semibold text-slate-800">{OPERATOR_NAME}</strong>运营并负责本政策所述的个人信息处理。</p>
        ) : (
          <p>运营主体尚未配置，因此此构建不能部署到生产环境。</p>
        )}
        {SUPPORT_EMAIL ? (
          <p>个人信息权利请求、安全问题和投诉可发送至<a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary-600 hover:text-primary-700">{SUPPORT_EMAIL}</a>。请勿发送密码、验证码或支付密码。</p>
        ) : (
          <p>私密联系邮箱尚未配置，因此此构建不能部署到生产环境。</p>
        )}
      </PolicySection>

      <PolicySection title="二、我们处理的信息">
        <p>账号信息包括注册邮箱、验证码校验结果、登录状态及必要的账号安全记录。使用“派聪明”服务号扫码登录时，我们还会处理服务号返回的稳定账号标识和关注状态，用于创建或识别你的派简历账号；密码只以不可逆摘要形式保存。</p>
        <p>简历信息由你主动填写或导入，可能包含姓名、联系方式、照片、教育和工作经历。请不要上传与求职无关的身份证件、银行卡、健康状况等敏感信息。</p>
        <p>服务运行时会产生设备、浏览器、访问时间、请求状态和故障信息；发生付费行为时，还会处理订单号、商品、金额及支付状态，但不会保存你的支付密码。</p>
        <p>申请人工精修时，我们会处理你主动选择的 PDF、文件名、文件大小与校验摘要、联系邮箱、授权记录、申请与处理状态。</p>
      </PolicySection>

      <PolicySection title="三、使用目的与人工智能处理">
        <p>我们仅为创建和管理账号、保存和导出简历、保障服务安全、处理订单与售后，以及改进产品而使用上述信息。</p>
        {AI_PROVIDER_NAME && AI_PROVIDER_PRIVACY_URL ? (
          <p>
            只有当你主动使用 AI 优化或分析功能时，相关简历片段才会发送给第三方人工智能服务商
            <strong className="font-semibold text-slate-800">{AI_PROVIDER_NAME}</strong>处理。其个人信息处理规则请查看
            <a href={AI_PROVIDER_PRIVACY_URL} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">服务商隐私政策</a>。
            请先删除不希望由第三方处理的联系方式、证件信息或其他敏感内容。
          </p>
        ) : (
          <p>第三方 AI 服务商名称或隐私政策链接尚未配置，因此此构建不能部署到生产环境，也不得向用户提供 AI 功能。</p>
        )}
        <p>AI 返回内容仅供参考，可能存在遗漏或错误；用于投递前请自行核对事实、措辞和个人信息。</p>
      </PolicySection>

      <PolicySection title="四、共享、公开与支付">
        <p>除完成你主动选择的 AI、邮件或支付服务所必需，或法律法规另有要求外，我们不会出售你的个人信息。</p>
        <p>普通简历默认不公开。若未来开放简历市场，你需要另行确认公开范围；在你明确发布前，平台不会把编辑中的简历作为公开内容展示。</p>
        <p>只有在你单独确认申请人工精修后，浏览器才会使用短期、单对象 POST 上传策略，把你选择的 PDF 直接上传到平台配置的私有阿里云对象存储 OSS。平台不会下发 AccessKey Secret 或其他可复用的长期凭据；浏览器只会收到精确绑定单个随机对象、大小、类型、摘要、私有 ACL、加密和单次写入的短时 POST 表单字段，其中 AccessKey ID 仅作为非秘密的签名身份标识。平台不接受自定义对象地址、外部链接或收件人。服务端核验并固化该文件后，会从私有 OSS 临时读取并发送到固定人工审阅邮箱，不写入服务器本地磁盘。邮件收件人会据此提供人工服务；已经由邮件系统接受的邮件无法由平台远程召回，请在提交前再次检查文件内容和其他敏感信息。</p>
        <p>支付由支付服务商处理。平台会接收完成对账和售后所需的交易结果，并按照退款规则处理异常订单。</p>
      </PolicySection>

      <PolicySection title="五、保存、安全与个人权利">
        <p>信息会在提供服务及履行法定义务所需期限内保存。账号注销后，我们会删除普通简历正文、未售公开快照，并匿名化问卷联系邮箱等不再需要的信息；依法必须保留的交易与安全记录将在法定期限届满后处理。</p>
        <p>若公开简历版本已经售出，为履行对买家的数字内容交付与售后义务，该成交版本会和订单、查看权益一并保留，但停止新销售；存在未完成订单、待退款或作者收益未结清时，需先处理完毕才能注销。</p>
        <p>人工精修 PDF 仅保存在私有 OSS，并按专用对象前缀配置自动过期清理；申请、计费和审计记录会在完成服务、处理售后及履行法定义务所需期限内保留，之后删除文件引用或作匿名化处理。存在待支付、待发送、处理中或待退款的人工精修申请时，需要先处理完毕才能注销账号；已发送至人工审阅邮箱的副本不具备远程召回能力。</p>
        <p>为避免页面关闭或网络中断造成编辑内容丢失，尚未完成服务端保存的变更可能短暂保存在当前浏览器；保存成功或退出并清理账号数据后会移除对应草稿。</p>
        <p>我们采取访问控制、传输加密、日志脱敏和备份等措施降低风险，但互联网服务无法承诺绝对安全。发现异常时，请及时修改密码并通过客服说明页联系我们。</p>
        <p>你可以查看、更正或删除自己的简历，也可以申请注销账号、撤回非必要授权或咨询个人信息处理情况。</p>
      </PolicySection>

      <PolicySection title="六、政策更新与联系我们">
        <p>发生处理目的、信息类型或第三方服务的重大变化时，我们会更新本政策并以页面提示等合理方式告知。重大变化不会在未经适当告知的情况下追溯适用于此前处理。</p>
        <p>隐私相关问题请通过<Link to="/customer-service" className="font-medium text-primary-600 hover:text-primary-700">客服说明页</Link>提供的私密渠道联系，不要在公开 Issue 中提交简历、邮箱、订单号或其他个人信息。</p>
      </PolicySection>
    </PolicyPage>
  )
}

export function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms of Service"
      title="服务条款"
      summary="注册或使用派简历前，请阅读本条款。勾选同意并完成注册，表示你理解并接受与所使用功能相关的约定。"
    >
      <PolicySection title="一、服务范围">
        {OPERATOR_NAME ? (
          <p>本服务由<strong className="font-semibold text-slate-800">{OPERATOR_NAME}</strong>运营并向用户提供。</p>
        ) : (
          <p>运营主体尚未配置，因此此构建不能部署到生产环境。</p>
        )}
        <p>派简历提供在线简历编辑、预览、导入导出、AI 辅助优化、会员权益及经页面明确开放的其他功能。具体功能、价格和权益以使用当时的页面说明为准。</p>
        <p>产品会持续迭代。涉及已购权益或个人信息处理的重大调整，我们会通过站内提示等合理方式提前说明。</p>
      </PolicySection>

      <PolicySection title="二、账号与使用安全">
        <p>你可以通过“派聪明”服务号扫码注册或登录，也可以在兼容入口使用本人可正常接收邮件的邮箱和密码。请妥善保管邮箱、密码和验证码，不得出借、出售账号或绕过身份、权限、支付和安全限制。</p>
        <p>发现账号被冒用或异常支付时，请立即停止相关操作并通过客服渠道联系我们。因你主动泄露凭据造成的风险，需要结合实际情况依法处理。</p>
      </PolicySection>

      <PolicySection title="三、内容与人工智能功能">
        <p>你应确保上传、编辑、发布的内容来源合法，不侵犯他人的隐私、著作权、商业秘密或其他合法权益。你保留对自有内容的权利，并授权平台在提供所选功能所需范围内处理该内容。</p>
        {AI_PROVIDER_NAME && AI_PROVIDER_PRIVACY_URL ? (
          <p>你主动使用 AI 功能时，相关内容会发送给<strong className="font-semibold text-slate-800">{AI_PROVIDER_NAME}</strong>处理；请同时阅读其<a href={AI_PROVIDER_PRIVACY_URL} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">隐私政策</a>。</p>
        ) : (
          <p>第三方 AI 服务商披露尚未配置，因此此构建不能部署到生产环境，也不得向用户提供 AI 功能。</p>
        )}
        <p>AI 生成或优化结果不构成录用、法律、财务或其他专业意见。你应在投递、公开或商业使用前核对其真实性、准确性与合规性。</p>
      </PolicySection>

      <PolicySection title="四、付费、退款与服务变更">
        <p>付费功能仅在页面明确显示可购买时开放。下单前请核对账号、商品、金额、有效期和权益说明，不要重复扫码或向非官方渠道转账。</p>
        <p>人工精修按服务端记录的有效申请计次：首次可免费申请一次；第二次及以后每次申请均需单独支付。</p>
        <p>提交人工精修前，你需要自行选择最终确认的 PDF。文件会直传私有 OSS，并由平台核验后在 OSS 内固化为不可覆盖的本次申请文件；后续修改在线简历或本地文件，不会自动改变已经提交或发送的内容。</p>
        <p>退款条件、申请材料和处理方式以<Link to="/refund-policy" className="font-medium text-primary-600 hover:text-primary-700">退款规则</Link>为准。支付平台显示处理中不等同于退款已到账，最终结果以原支付渠道为准。</p>
      </PolicySection>

      <PolicySection title="五、禁止行为与责任边界">
        <p>不得利用本服务实施违法活动、传播恶意程序、批量攻击接口、抓取非公开数据、冒用他人身份，或上传明知无权处理的信息。平台可对明显危害服务安全或他人权益的行为采取限制、下架或终止服务等必要措施。</p>
        <p>我们会尽合理努力保障服务连续性，但维护、网络、第三方服务或不可抗力可能造成短暂中断。对于依法不能排除或限制的责任，本条款不作排除或限制。</p>
      </PolicySection>

      <PolicySection title="六、联系我们">
        {OPERATOR_NAME ? <p>服务运营主体：{OPERATOR_NAME}。</p> : null}
        <p>账号、功能、支付或条款问题，请根据<Link to="/customer-service" className="font-medium text-primary-600 hover:text-primary-700">客服说明</Link>选择公开或私密渠道，并保留必要的页面提示和订单凭证。</p>
      </PolicySection>
    </PolicyPage>
  )
}

export function RefundPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Refund Policy"
      title="退款规则"
      summary="本规则适用于派简历页面内直接购买的数字化会员或服务。用户付费简历市场正式开放前，不接受该类交易。"
    >
      <PolicySection title="一、可以申请或需要处理退款的情形">
        <ul className="list-disc space-y-2 pl-5">
          <li>同一商品发生可核实的重复扣款；</li>
          <li>支付成功但系统未交付对应权益，且经排查无法补发；</li>
          <li>订单超时、失效或被替代后仍被支付平台确认收款；</li>
          <li>服务存在无法合理修复的重大故障，或法律法规规定应当退款的其他情形。</li>
        </ul>
      </PolicySection>

      <PolicySection title="二、数字化权益的特别说明">
        <p>会员属于购买后可即时使用的数字化权益。尚未使用权益时，你可以提交退款申请，我们会结合开通时间、使用记录、问题原因和适用法律核验。</p>
        <p>已使用 AI、导出、查看等核心付费权益，或权益已接近到期的，除重复扣款、未交付、重大故障及法律另有规定外，通常无法按“未使用”处理。页面另有更有利承诺的，以页面承诺为准。</p>
        <p>付费人工精修按单次申请交付。尚未将简历发送至人工审阅邮箱、重复扣款或系统无法交付时，可以申请退款；简历已经发送且人工处理已经开始后，会结合实际完成的服务、问题原因和适用法律核验，不承诺按“未使用”退款。</p>
      </PolicySection>

      <PolicySection title="三、申请与核验">
        <p>请通过<Link to="/customer-service" className="font-medium text-primary-600 hover:text-primary-700">客服说明页</Link>的私密渠道提交注册邮箱、平台订单号、支付时间、实付金额和问题说明。不要在 GitHub Issue 等公开渠道粘贴完整订单或个人信息。</p>
        <p>为防止冒领，我们可能要求你补充与订单有关的必要凭证，但不会索要支付密码、短信验证码或完整银行卡信息。</p>
      </PolicySection>

      <PolicySection title="四、退款路径与到账">
        <p>核验通过后，退款原则上按原支付路径发起，不以私下转账替代。平台订单标记为“待退款”或支付渠道显示“退款处理中”，均不代表款项已经到账。</p>
        <p>具体到账时间由支付服务商和金融机构决定。请以原支付渠道的最终记录为准；长时间未到账时，可携订单号继续联系客服核查。</p>
      </PolicySection>

      <PolicySection title="五、异常支付提醒">
        <p>遇到二维码失效、订单状态不明、重复付款提示或“需要退款”状态时，请停止再次支付，保留订单号并联系客服。任何人员向你索要验证码、支付密码或要求转账到个人账户时，都应立即停止操作。</p>
      </PolicySection>
    </PolicyPage>
  )
}

export function CustomerServicePage() {
  const issueUrl = `${GITHUB_REPOSITORY_URL}/issues/new`

  return (
    <PolicyPage
      eyebrow="Customer Support"
      title="客服说明"
      summary="请根据问题是否包含账号、订单或简历信息选择渠道。公开反馈不得包含个人信息，支付问题必须使用私密渠道。"
    >
      <PolicySection title="一、公开产品问题">
        <p>功能建议、可复现的页面错误和不涉及个人数据的兼容性问题，可以通过 GitHub 提交。</p>
        <a
          href={issueUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center border border-primary-200 bg-primary-50 px-4 py-2 font-medium text-primary-700 hover:bg-primary-100"
        >
          前往 GitHub Issues
        </a>
        <p>请勿公开提交邮箱、手机号、微信号、简历正文、访问令牌、订单号、支付截图或身份证明。</p>
      </PolicySection>

      <PolicySection title="二、账号、订单与退款问题">
        {SUPPORT_EMAIL ? (
          <>
            <p>请通过下方客服邮箱提交账号、订单与退款问题，并提供注册邮箱、平台订单号、支付时间和问题描述。不要提供密码或验证码。</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('派简历账号或订单问题')}`}
              className="inline-flex items-center border border-primary-200 bg-primary-50 px-4 py-2 font-medium text-primary-700 hover:bg-primary-100"
            >
              联系私密客服：{SUPPORT_EMAIL}
            </a>
          </>
        ) : (
          <p>独立私密客服邮箱尚未配置，因此正式收款必须保持关闭。部署前需设置并验证 <code>VITE_SUPPORT_EMAIL</code>，不得要求用户在公开 Issue 提交账号或订单信息。</p>
        )}
        <p>已加入“二哥编程星球”的用户也可以私信管理员，并提供必要的脱敏信息协助定位。</p>
      </PolicySection>

      <PolicySection title="三、问题处理边界">
        <p>客服不会索要登录密码、邮箱验证码、支付密码或要求向个人账户转账。退款是否完成，以原支付渠道的最终到账记录为准。</p>
        <p>为便于排查，请保留错误时间、操作步骤、浏览器类型和脱敏后的页面截图。涉及安全漏洞时，请先通过私密渠道报告，避免公开可利用细节。</p>
      </PolicySection>
    </PolicyPage>
  )
}
