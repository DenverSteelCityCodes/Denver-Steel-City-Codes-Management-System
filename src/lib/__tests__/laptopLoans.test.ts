import { describe, expect, it } from 'vitest'
import { joinWeeks, laptopState, rosterLaptopLabel, wizardLaptopLines, type MyLaptop } from '../laptopLoans'

const row = (over: Partial<MyLaptop>): MyLaptop => ({ registration_id: 'r', status: null, queue_position: null, changes_open: true, ...over })

describe('laptopState', () => {
  it('offers a request when nothing was asked, before the week', () => {
    expect(laptopState(row({}))).toEqual({ word: 'Not needed', tone: 'plain', action: 'request' })
    expect(laptopState(undefined)).toEqual({ word: 'Not needed', tone: 'plain', action: null })
  })
  it('treats a released loan like one never asked for', () => {
    expect(laptopState(row({ status: 'released' })).action).toBe('request')
  })
  it('shows the place in the queue and lets the family leave it', () => {
    expect(laptopState(row({ status: 'queued', queue_position: 3 }))).toEqual({ word: 'In the queue (#3)', tone: 'wait', action: 'leave' })
    expect(laptopState(row({ status: 'queued' })).word).toBe('In the queue')
  })
  it('lets a reserved loan be released until the week starts, then only shows it', () => {
    expect(laptopState(row({ status: 'reserved' })).action).toBe('release')
    expect(laptopState(row({ status: 'reserved', changes_open: false }))).toEqual({ word: 'Reserved', tone: 'ok', action: null })
    expect(laptopState(row({ changes_open: false })).action).toBeNull()
  })
  it('never offers an action on a laptop at camp or back', () => {
    expect(laptopState(row({ status: 'handed_out' })).action).toBeNull()
    expect(laptopState(row({ status: 'returned' })).action).toBeNull()
  })
})

describe('rosterLaptopLabel', () => {
  it('names reserved and handed-out loaners only', () => {
    expect(rosterLaptopLabel('reserved')).toBe('Loaner laptop to hand out')
    expect(rosterLaptopLabel('handed_out')).toBe('Loaner laptop handed out')
    expect(rosterLaptopLabel(null)).toBeNull()
    expect(rosterLaptopLabel('queued')).toBeNull()
  })
})

describe('wizardLaptopLines', () => {
  it('joins weeks in plain English', () => {
    expect(joinWeeks(['Week 1'])).toBe('Week 1')
    expect(joinWeeks(['Week 1', 'Week 2'])).toBe('Week 1 and Week 2')
    expect(joinWeeks(['A', 'B', 'C'])).toBe('A, B and C')
  })
  it('says what happened in each week, in one line per outcome', () => {
    const lines = wizardLaptopLines('Ava', [
      { week: 'Week 1', outcome: 'reserved' }, { week: 'Week 2', outcome: 'queued' },
    ])
    expect(lines).toEqual([
      'A loaner laptop is reserved for Ava in Week 1. Loaners stay at camp.',
      "Every loaner for Week 2 is spoken for, so Ava is in the laptop queue. We'll email you if one frees up.",
    ])
  })
  it('points a waitlisted week to Home, and passes on the reason a request failed', () => {
    expect(wizardLaptopLines('Ava', [{ week: 'Week 2', outcome: 'waitlisted' }]))
      .toEqual(['If Ava gets a spot in Week 2, ask for a laptop on Home.'])
    expect(wizardLaptopLines('Ava', [{ week: 'Week 1', outcome: 'failed', message: 'Week 1 has started, so laptops can\'t be requested online. Ask at check-in.' }])[0])
      .toBe("We couldn't ask for a laptop for Week 1: Week 1 has started, so laptops can't be requested online. Ask at check-in.")
    expect(wizardLaptopLines('Ava', [{ week: 'Week 1', outcome: 'failed' }])[0]).toBe("We couldn't ask for a laptop for Week 1. You can ask on Home.")
  })
  it('says nothing when nothing was asked', () => {
    expect(wizardLaptopLines('Ava', [])).toEqual([])
  })
})
