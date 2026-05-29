"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Switch } from "@/components/ui/switch"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // 初期状態をHTMLのclassから取得
    const root = document.documentElement
    setIsDark(root.classList.contains("dark"))
  }, [])

  const toggleTheme = (checked: boolean) => {
    const root = document.documentElement
    if (checked) {
      root.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
    setIsDark(checked)
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch
        id="theme-toggle"
        checked={isDark}
        onCheckedChange={toggleTheme}
        size="sm"
        aria-label="ダークモード切り替え"
      />
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}
