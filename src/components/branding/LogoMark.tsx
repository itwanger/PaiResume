interface LogoMarkProps {
  className?: string
}

export function LogoMark({ className = 'h-10 w-10' }: LogoMarkProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-white shadow-[0_14px_28px_-18px_rgba(29,78,216,0.32)] ring-1 ring-primary-100/90 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_32%_24%,rgba(90,145,255,0.1),transparent_46%)]" />
      <div className="absolute left-[17%] right-[17%] top-[23%] h-[22%] rounded-full bg-[linear-gradient(180deg,#79b2ff_0%,#4b86f5_38%,#3369e8_72%,#2857ca_100%)] shadow-[0_8px_16px_-12px_rgba(29,78,216,0.9)]" />
      <div className="absolute bottom-[18%] left-[28%] h-[40%] w-[17%] rounded-b-[999px] rounded-t-[14px] bg-[linear-gradient(180deg,#b7d6ff_0%,#7caeff_26%,#4f87f2_62%,#3369e8_100%)]" />
      <div className="absolute bottom-[18%] right-[28%] h-[40%] w-[17%] rounded-b-[999px] rounded-t-[14px] bg-[linear-gradient(180deg,#b7d6ff_0%,#7caeff_26%,#4f87f2_62%,#3369e8_100%)]" />
    </div>
  )
}
