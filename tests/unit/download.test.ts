// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { downloadText, fileSafe } from '../../src/ui/download.ts';

describe('downloads', () => {
  it('keeps only safe letters and digits in file names', () => {
    expect(fileSafe('Zoë & Co')).toBe('zo-co');
    expect(fileSafe('  Mo2  ')).toBe('mo2');
    expect(fileSafe('***')).toBe('student');
  });

  it('saves through a temporary link that is removed again', () => {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: string[] = [];
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicked.push(this.download);
    };
    vi.useFakeTimers();
    downloadText('comparia-mo.json', '{}');
    expect(clicked).toEqual(['comparia-mo.json']);
    expect(document.querySelector('a')).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
    vi.useRealTimers();
  });
});
