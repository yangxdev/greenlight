import { describe, expect, it } from 'vitest'
import { isoWeek, reportWindow, ymd } from '../src/week.ts'

describe('isoWeek', () => {
  it.each([
    ['2026-01-01', '2026-W01'], // Thursday: week 1 of 2026
    ['2025-12-29', '2026-W01'], // Monday of 2026-W01
    ['2027-01-01', '2026-W53'], // 2026 has 53 ISO weeks
    ['2026-09-28', '2026-W40'],
    ['2026-10-04', '2026-W40'], // Sunday stays in the same week
  ])('%s is %s', (date, week) => {
    expect(isoWeek(new Date(`${date}T12:00:00Z`))).toBe(week)
  })
})

describe('reportWindow', () => {
  it('reports on the last complete week, whatever day it runs', () => {
    for (const now of ['2026-10-05T04:47:00Z', '2026-10-07T18:00:00Z', '2026-10-11T23:59:00Z']) {
      const w = reportWindow(new Date(now))
      expect({ start: ymd(w.start), end: ymd(w.end), prevStart: ymd(w.prevStart), label: w.label }).toEqual({
        start: '2026-09-28',
        end: '2026-10-05',
        prevStart: '2026-09-21',
        label: '2026-W40',
      })
    }
  })
})
