"use client"

import * as React from "react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** "2026-11-14" → giorno nel fuso del dispositivo (come un <input type="date">). */
function parseDay(value: string | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "")
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

const fieldClasses =
  "rounded-lg border border-input bg-transparent text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"

type DateFieldProps = {
  /** "yyyy-MM-dd", vuoto = nessun giorno scelto. */
  value: string
  onChange: (value: string) => void
  /** Primo e ultimo giorno che si possono scegliere ("yyyy-MM-dd"). */
  min?: string
  max?: string
  /** Data lontana (es. di nascita): mese e anno si scelgono da menu, senza giorno della settimana. */
  birthday?: boolean
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean | "true" | "false"
}

/**
 * Scelta del giorno sempre in italiano ("sab 14 novembre 2026", calendario da lunedì):
 * il campo data del browser segue la lingua del dispositivo, questo no.
 */
function DateField({ value, onChange, min, max, birthday, placeholder = "Scegli il giorno", disabled, id, className, ...aria }: DateFieldProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDay(value)
  const from = parseDay(min)
  const to = parseDay(max)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        data-slot="date-field"
        className={cn(fieldClasses, "flex h-8 w-full min-w-0 items-center gap-2 px-2.5 text-left", className)}
        {...aria}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", selected ? "first-letter:uppercase" : "text-muted-foreground")}>
          {selected ? format(selected, birthday ? "d MMMM yyyy" : "EEE d MMMM yyyy", { locale: it }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? to ?? from}
          captionLayout={birthday ? "dropdown" : "label"}
          startMonth={from}
          endMonth={to}
          disabled={[...(from ? [{ before: from }] : []), ...(to ? [{ after: to }] : [])]}
          onSelect={(date) => {
            if (!date) return
            onChange(format(date, "yyyy-MM-dd"))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"))
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"))

type TimeFieldProps = {
  /** "HH:mm", vuoto = nessun orario scelto. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/** Ora e minuti da menu, sempre su 24 ore (niente AM/PM), a passi di 5 minuti. */
function TimeField({ value, onChange, disabled, className, "aria-label": label = "Orario" }: TimeFieldProps) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  const hour = match?.[1] ?? ""
  const minute = match?.[2] ?? ""
  // Un orario salvato fuori dai 5 minuti (es. 10:07) resta selezionabile.
  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES
  const selectClasses = cn(fieldClasses, "h-full min-w-0 flex-1 px-1.5 text-center font-medium tabular-nums")

  return (
    <div data-slot="time-field" className={cn("flex h-8 items-center gap-1", className)}>
      <select
        aria-label={`${label}: ora`}
        disabled={disabled}
        value={hour}
        onChange={(event) => onChange(`${event.target.value}:${minute || "00"}`)}
        className={selectClasses}
      >
        {hour ? null : <option value="">--</option>}
        {HOURS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="font-semibold text-muted-foreground">:</span>
      <select
        aria-label={`${label}: minuti`}
        disabled={disabled || !hour}
        value={minute}
        onChange={(event) => onChange(`${hour}:${event.target.value}`)}
        className={selectClasses}
      >
        {minute ? null : <option value="">--</option>}
        {minutes.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

export { DateField, TimeField }
