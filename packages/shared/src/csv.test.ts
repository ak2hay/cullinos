import { describe, expect, it } from 'vitest';
import { csvCell, csvRow } from './csv';

describe('csvCell', () => {
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-2+3')).toBe("'-2+3");
  });

  it('keeps plain numbers and text unchanged', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell('-12.50')).toBe('-12.50');
    expect(csvCell('Paneer Tikka')).toBe('Paneer Tikka');
    expect(csvCell(null)).toBe('');
  });

  it('quotes commas, quotes and newlines', () => {
    expect(csvRow(['a,b', 'say "hi"', 'x\ny'])).toBe('"a,b","say ""hi""","x\ny"');
  });
});
