import { describe, expect, it } from 'vitest'
import { toCsv } from '../csv'

describe('toCsv', () => {
  it('joins rows with CRLF and leaves plain cells alone', () => {
    expect(toCsv(['a', 'b'], [[1, 'x'], [null, undefined]])).toBe('a,b\r\n1,x\r\n,')
  })

  it('quotes commas, quotes and newlines', () => {
    expect(toCsv(['n'], [['Smith, Jo'], ['say "hi"'], ['two\nlines']])).toBe('n\r\n"Smith, Jo"\r\n"say ""hi"""\r\n"two\nlines"')
  })

  it('defuses spreadsheet formulas in text cells but not numbers', () => {
    expect(toCsv(['n'], [['=SUM(A1)'], ['+1'], ['@cmd'], [-5]])).toBe("n\r\n'=SUM(A1)\r\n'+1\r\n'@cmd\r\n-5")
  })
})
