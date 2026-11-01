'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { ChevronDown, KeyRound, LogOut, Moon, Rows3, Rows4, Sun } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/components/providers/auth-provider'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import { useDensity, type Density } from '@/lib/preferences'
import { initials } from '@/components/charter/primitives'

export function UserMenu() {
  const { user, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [density, setDensity] = useDensity()
  const [passwordOpen, setPasswordOpen] = useState(false)
  if (!user) return null
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex items-center gap-2.5 rounded-md py-1 pr-1.5 pl-1 text-left hover:bg-hover focus-ring" aria-label={`Account menu for ${user.name}`}>
            <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-card text-caption font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]">
              {initials(user.name)}
            </span>
            <span className="hidden min-w-0 leading-tight md:block">
              <span className="block truncate text-body-sm font-medium text-foreground">{user.name}</span>
              <span className="block truncate text-caption text-muted-foreground">{user.role}</span>
            </span>
            <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-body-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-caption text-muted-foreground">{user.email}</span>
            <span className="block text-caption text-muted-foreground">{user.role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="label-caps">Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={resolvedTheme === 'dark' ? 'dark' : 'light'} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light"><Sun className="size-4" aria-hidden="true" /> Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark"><Moon className="size-4" aria-hidden="true" /> Dark</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel className="label-caps">Density</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={density} onValueChange={v => setDensity(v as Density)}>
            <DropdownMenuRadioItem value="comfortable"><Rows3 className="size-4" aria-hidden="true" /> Comfortable</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="compact"><Rows4 className="size-4" aria-hidden="true" /> Compact</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound className="size-4" aria-hidden="true" /> Change password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => logout()} className="text-status-danger-fg focus:text-status-danger-fg">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  )
}
