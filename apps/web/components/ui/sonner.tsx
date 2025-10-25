"use client"

import { Toaster as Sonner } from "sonner"

interface ToasterProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center"
  expand?: boolean
  richColors?: boolean
  theme?: "light" | "dark" | "system"
  className?: string
}

export function Toaster({
  position = "top-right",
  expand = false,
  richColors = true,
  theme = "dark",
  className,
}: ToasterProps) {
  return (
    <Sonner
      position={position}
      expand={expand}
      richColors={richColors}
      theme={theme}
      className={className}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-slate-900 group-[.toaster]:text-white group-[.toaster]:border-slate-800 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-slate-400",
          actionButton:
            "group-[.toast]:bg-blue-600 group-[.toast]:text-white group-[.toast]:hover:bg-blue-700",
          cancelButton:
            "group-[.toast]:bg-slate-800 group-[.toast]:text-slate-400 group-[.toast]:hover:bg-slate-700",
          successIcon: "text-green-400",
          errorIcon: "text-red-400",
          warningIcon: "text-amber-400",
          infoIcon: "text-blue-400",
        },
      }}
    />
  )
}