import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge taught about the Charter tokens in app/globals.css, so e.g. `text-caption`
 * (a font size) isn't mistaken for a text colour and dropped next to `text-foreground`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'label', 'body-sm', 'body', 'body-lg', 'section', 'title', 'title-lg', 'figure-sm', 'figure', 'figure-lg'] }],
      shadow: [{ shadow: ['panel', 'raised', 'popover', 'dialog', 'button'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
