// Tests — compteur animé de l'accueil (S5R2-08 : plus de setState au début de l'effet)
import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import { renderHook } from '@testing-library/react';
import useCountUp from './useCountUp.js';

const originalMatchMedia = window.matchMedia;
afterEach(() => { window.matchMedia = originalMatchMedia; });

describe('useCountUp', () => {
  it('reste à 0 tant que le compteur n\'est pas visible', () => {
    const { result } = renderHook(() => useCountUp(42, { start: false }));
    expect(result.current).toBe(0);
  });

  it('« réduire les animations » : le nombre final s\'affiche tout de suite, sans animation', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const { result } = renderHook(() => useCountUp(42, { start: true }));
    expect(result.current).toBe(42);
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });
});
