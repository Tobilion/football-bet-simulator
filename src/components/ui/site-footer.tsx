"use client"

// site-footer.tsx — "Built by Tobiloba Jagun" footer with hover-reveal links.
// Deps: lucide-react + Tailwind only (no clsx/tailwind-merge needed).

import { useState } from "react"
import { Github, Globe, Linkedin, LucideIcon } from "lucide-react"

const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ")

interface FooterLink {
  icon: LucideIcon
  href: string
  label: string
}

export const LINKS: FooterLink[] = [
  { icon: Github, href: "https://github.com/Tobilion", label: "GitHub" },
  { icon: Globe, href: "https://tobiloba-jagun-portfolio.vercel.app/", label: "Portfolio" },
  { icon: Linkedin, href: "https://www.linkedin.com/in/tobiloba-jagun/", label: "LinkedIn" },
]

export const NameReveal = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <span
      className="relative inline-flex h-8 w-44 justify-center align-middle"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-label="Tobiloba Jagun — show links"
        className={cn(
          "relative h-8 w-44 rounded-3xl px-3 flex items-center justify-center",
          "bg-white dark:bg-black text-black dark:text-white",
          "border border-black/10 dark:border-white/10",
          "text-sm font-semibold underline underline-offset-4 decoration-dotted",
          "transition-all duration-300",
          isOpen ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        Tobiloba Jagun
      </button>

      <span className="absolute inset-0 flex h-8 w-44 justify-center overflow-hidden rounded-3xl">
        {LINKS.map((link, index) => {
          const Icon = link.icon
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
              tabIndex={isOpen ? 0 : -1}
              className={cn(
                "flex h-8 flex-1 items-center justify-center",
                "bg-black dark:bg-white text-white dark:text-black",
                "border-r border-white/10 last:border-r-0 dark:border-black/10",
                "hover:bg-gray-900 dark:hover:bg-gray-100",
                index === 0 && "rounded-l-3xl",
                index === LINKS.length - 1 && "rounded-r-3xl",
                "transition-all duration-200",
                index === 1 && "delay-[50ms]",
                index === 2 && "delay-100",
                isOpen
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none -translate-x-full opacity-0"
              )}
            >
              <Icon className="size-4" />
            </a>
          )
        })}
      </span>
    </span>
  )
}

/** Compact credit for app headers: small text, hover/click opens icon dropdown. */
export const HeaderCredit = ({ className }: { className?: string }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={cn("relative hidden lg:flex items-center", className)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="text-[10px] font-mono text-slate-500 hover:text-slate-300 whitespace-nowrap px-2 py-1.5 transition-colors cursor-pointer"
      >
        Built by <span className="underline underline-offset-2 decoration-dotted font-semibold">Tobiloba Jagun</span>
      </button>
      <div
        className={cn(
          "absolute right-0 top-full mt-1 z-50 flex overflow-hidden rounded-xl",
          "border border-white/10 shadow-lg transition-all duration-200 origin-top-right",
          isOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        )}
      >
        {LINKS.map((link) => {
          const Icon = link.icon
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
              tabIndex={isOpen ? 0 : -1}
              className="flex h-9 w-10 items-center justify-center bg-black text-white border-r border-white/10 last:border-r-0 hover:bg-gray-800 transition-colors"
            >
              <Icon className="size-4" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

/** Avatar-triggered credit: hover/click the user's initials badge to reveal "Built by" + links. */
export const AvatarCredit = ({ username, className }: { username: string; className?: string }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={cn("relative flex items-center", className)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Backdrop: lets a tap outside close the popup on touch devices (no hover to rely on) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-label="Tobiloba Jagun — show credit"
        className="h-8 w-8 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center font-black text-slate-900 border border-emerald-400 shadow-lg shadow-emerald-500/20 cursor-pointer touch-manipulation"
      >
        {username.slice(0, 2).toUpperCase()}
      </button>
      <div
        className={cn(
          "absolute right-0 top-full mt-1 z-50 flex flex-col items-end gap-1.5 max-w-[calc(100vw-2rem)]",
          "transition-all duration-200 origin-top-right",
          isOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        )}
      >
        <span className="text-[10px] font-mono text-slate-400 bg-slate-950/95 border border-white/10 rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
          Built by <span className="font-semibold text-slate-200">Tobiloba Jagun</span>
        </span>
        <div className="flex overflow-hidden rounded-xl border border-white/10 shadow-lg">
          {LINKS.map((link) => {
            const Icon = link.icon
            return (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                title={link.label}
                tabIndex={isOpen ? 0 : -1}
                className="flex h-10 w-11 sm:h-9 sm:w-10 items-center justify-center bg-black text-white border-r border-white/10 last:border-r-0 hover:bg-gray-800 transition-colors touch-manipulation"
              >
                <Icon className="size-4" />
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "w-full border-t border-black/10 dark:border-white/10",
        "flex items-center justify-center gap-2 py-4 px-4",
        "text-sm text-gray-600 dark:text-gray-400",
        className
      )}
    >
      <span>Built by</span>
      <NameReveal />
    </footer>
  )
}
