import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectGroup {
  groupLabel: string
  options: SelectOption[]
}

export type SelectItem = SelectOption | SelectGroup

function isGroup(item: SelectItem): item is SelectGroup {
  return 'groupLabel' in item
}

function findLabel(items: readonly SelectItem[], value: string): string {
  for (const item of items) {
    if (isGroup(item)) {
      const match = item.options.find((o) => o.value === value)
      if (match) return match.label
    } else if (item.value === value) {
      return item.label
    }
  }
  return value
}

interface DropdownStyle {
  top: number
  left: number
  width: number
}

interface AppSelectProps {
  value: string
  onChange: (value: string) => void
  items: readonly SelectItem[]
  disabled?: boolean
}

export function AppSelect({ value, onChange, items, disabled }: AppSelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<DropdownStyle>({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropdownStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onScroll = (event: Event): void => {
      if (dropdownRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const handleSelect = (newValue: string): void => {
    onChange(newValue)
    setOpen(false)
  }

  return (
    <div className="app-select">
      <button
        ref={triggerRef}
        type="button"
        className="app-select__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="app-select__value">{findLabel(items, value)}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`app-select__caret${open ? ' is-open' : ''}`}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="app-select__dropdown"
          role="listbox"
          style={{
            position: 'fixed',
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            width: dropdownStyle.width,
            zIndex: 9999,
          }}
        >
          {items.map((item) =>
            isGroup(item) ? (
              <div key={item.groupLabel} className="app-select__group">
                <div className="app-select__group-label" role="presentation">
                  {item.groupLabel}
                </div>
                {item.options.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    opt={opt}
                    selected={opt.value === value}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ) : (
              <OptionButton
                key={item.value}
                opt={item}
                selected={item.value === value}
                onSelect={handleSelect}
              />
            ),
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

interface OptionButtonProps {
  opt: SelectOption
  selected: boolean
  onSelect: (value: string) => void
}

function OptionButton({ opt, selected, onSelect }: OptionButtonProps): JSX.Element {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`app-select__option${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(opt.value)}
    >
      {opt.label}
    </button>
  )
}
