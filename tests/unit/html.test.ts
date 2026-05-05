import { describe, it, expect } from 'vitest';
import { stripHtml } from 'src/utils/html';

describe('stripHtml', () => {
  it('should remove HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('should decode HTML entities', () => {
    expect(stripHtml('Caf&eacute; &amp; Past&eacute;is')).toBe('Café & Pastéis');
  });

  it('should handle plain text without tags', () => {
    expect(stripHtml('Just plain text')).toBe('Just plain text');
  });

  it('should trim whitespace', () => {
    expect(stripHtml('  <div>  spaced  </div>  ')).toBe('spaced');
  });

  it('should handle nested tags', () => {
    expect(stripHtml('<div><p><span>nested</span></p></div>')).toBe('nested');
  });
});
