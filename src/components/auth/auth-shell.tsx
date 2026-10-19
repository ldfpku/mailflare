"use client";

import { BrandIcon } from "@/components/brand-icon";
import { useBranding } from "@/components/branding-provider";
import { LanguageSelector } from "@/components/language-selector";
import type { AuthShellProps } from "./types";

// BIS v1.7 C5 first screen: an SMJ Blue panel carrying the reverse wordmark (B8) and the offset
// split device (B18: cut vertically, the right part drops 6.5% of the block height), the form on white.
// The panel uses a literal #fff because the dark theme remaps white to navy.
export function AuthShell({
  title,
  description,
  children,
  footer,
  steps,
}: AuthShellProps) {
  const branding = useBranding();
  return (
    <div className="min-h-dvh bg-[var(--background)] text-neutral-900 sm:px-6 sm:py-6 lg:flex lg:items-center lg:px-10 lg:py-10">
      <main className="mx-auto grid min-h-dvh w-full max-w-4xl grid-rows-[auto_1fr] overflow-hidden bg-white sm:min-h-0 sm:grid-rows-none sm:rounded-lg lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="relative flex flex-col overflow-hidden bg-blue-600 p-7 pb-16 text-[#fff] sm:p-10 sm:pb-24 lg:min-h-[30rem] lg:p-14">
          <div className="flex items-center gap-3">
            {branding.hasCustomIcon ? (
              <BrandIcon className="h-8 w-8" />
            ) : (
              <img src="/brand/smj-wordmark-reverse.svg" alt="SMJ" className="h-7 w-auto" />
            )}
            <span className="h-6 w-px bg-[#fff]/60" aria-hidden="true" />
            <span className="truncate text-base font-semibold text-[#fff]">
              {branding.appName}
            </span>
          </div>

          <div className="mt-8 sm:mt-6 lg:mt-12">
            <h1 className="max-w-md text-3xl font-bold leading-tight text-[#fff] sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-4 max-w-md text-base leading-7 text-[#fff]/85">
                {description}
              </p>
            )}
          </div>

          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 sm:h-16">
            <span className="absolute bottom-0 left-0 top-0 w-[62%] bg-[#0a1f54] dark:bg-[#071539]" />
            <span className="absolute -bottom-[6.5%] right-0 top-[6.5%] w-[calc(38%-6px)] bg-[#0a1f54] dark:bg-[#071539]" />
          </div>
        </section>

        <section className="flex min-w-0 flex-col justify-start px-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-8 sm:justify-center sm:p-10 lg:p-14">
          {steps && (
            <div className="mb-7 flex flex-wrap gap-2 text-xs font-semibold">
              {steps.map((step, index) => (
                <span key={step.label} className="flex items-center gap-2">
                  <span
                    className={
                      step.active ? "text-blue-700" : "text-neutral-500"
                    }
                  >
                    {index + 1} {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <span className="text-neutral-300">/</span>
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="w-full">{children}</div>
          {footer && (
            <div className="mt-8 text-sm font-medium text-blue-700">
              {footer}
            </div>
          )}
          <div className="mt-auto pt-8">
            <LanguageSelector variant="text" />
          </div>
        </section>
      </main>
    </div>
  );
}
