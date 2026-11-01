import { describe, expect, it } from 'vitest'
import { FORM_DEFINITIONS, cleanOptions, resolveField, resolveOptions, withAnswered } from '../formFields'

const def = (formKey: 'volunteer_application' | 'student_registration', key: string) =>
  FORM_DEFINITIONS[formKey].fields.find(f => f.key === key)!

describe('answer choices', () => {
  it('uses the default list until one is saved', () => {
    expect(resolveField('student_registration', 'shirt_size', {}).options).toEqual(['XS', 'S', 'M', 'L', 'XL'])
    expect(resolveField('student_registration', 'shirt_size', { shirt_size: { options: ['YS', 'YM', 'AS'] } }).options)
      .toEqual(['YS', 'YM', 'AS'])
  })

  it('gives locked questions their saved list too', () => {
    expect(resolveField('volunteer_application', 'shirtSize', { shirtSize: { options: ['S', 'M'] } }).options).toEqual(['S', 'M'])
  })

  it('has no choices for a question that is not a choice question', () => {
    expect(resolveField('student_registration', 'allergies', {}).options).toEqual([])
  })

  it('drops blanks and repeats, ignoring case', () => {
    expect(cleanOptions([' Flyer ', '', 'flyer', 'Radio'])).toEqual(['Flyer', 'Radio'])
  })

  it('keeps "Other" last and puts it back if a saved list lost it', () => {
    const school = def('volunteer_application', 'school')
    expect(resolveOptions(school, ['Other', 'East High'])).toEqual(['East High', 'Other'])
    expect(resolveOptions(school, ['East High'])).toEqual(['East High', 'Other'])
  })

  it('falls back to the default when a saved list has nothing but "Other"', () => {
    const school = def('volunteer_application', 'school')
    expect(resolveOptions(school, ['Other'])).toEqual(school.options)
    expect(resolveOptions(def('student_registration', 'how_heard'), [])).toEqual(def('student_registration', 'how_heard').options)
  })

  it('keeps a removed choice on the list for someone who already gave it', () => {
    expect(withAnswered(['S', 'M'], 'XL')).toEqual(['S', 'M', 'XL'])
    expect(withAnswered(['S', 'M'], 'M')).toEqual(['S', 'M'])
    expect(withAnswered(['Asian', 'White'], ['White', 'Two or more races'])).toEqual(['Asian', 'White', 'Two or more races'])
    expect(withAnswered(['S'], '')).toEqual(['S'])
  })
})
