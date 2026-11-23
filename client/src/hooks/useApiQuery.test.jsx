// Tests — useApiQuery, le chargement commun des pages (S5R2-08, BACKLOG-03)
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/api.js', () => ({ api: apiMock }));
const { useApiQuery } = await import('./useApiQuery.js');

/** Une réponse qu'on décide de livrer quand on veut */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Une fausse fonction neuve à chaque test (et non mockReset() : avec
// Vitest 4, mockReset() suivi d'une promesse rejetée est signalé à tort
// comme une erreur non gérée)
beforeEach(() => { apiMock.get = vi.fn(); });

describe('useApiQuery', () => {
  it('part en « chargement », puis donne la réponse', async () => {
    apiMock.get.mockResolvedValue({ items: [1, 2] });
    const { result } = renderHook(() => useApiQuery('/surveys'));
    expect(result.current).toMatchObject({ loading: true, data: null, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: [1, 2] });
    expect(apiMock.get).toHaveBeenCalledWith('/surveys');
  });

  it('null : ne charge rien (ex. visiteur non connecté)', () => {
    const { result } = renderHook(() => useApiQuery(null));
    expect(result.current).toMatchObject({ loading: false, data: null, error: null });
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('une erreur de l\'API est rendue telle quelle (status, code, message)', async () => {
    apiMock.get.mockImplementation(() => Promise.reject({ status: 404, code: 'NOT_FOUND', message: 'Introuvable' }));
    const { result } = renderHook(() => useApiQuery('/surveys/nope'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('changement d\'adresse : l\'ancienne donnée reste affichée pendant le chargement, sans erreur périmée', async () => {
    apiMock.get.mockResolvedValueOnce({ page: 'ouvertes' });
    const { result, rerender } = renderHook(({ path }) => useApiQuery(path), { initialProps: { path: '/surveys?status=OPEN' } });
    await waitFor(() => expect(result.current.data).toEqual({ page: 'ouvertes' }));

    const next = deferred();
    apiMock.get.mockReturnValueOnce(next.promise);
    rerender({ path: '/surveys?status=CLOSED' });
    expect(result.current).toMatchObject({ loading: true, data: { page: 'ouvertes' } });

    await act(async () => next.resolve({ page: 'closes' }));
    expect(result.current).toMatchObject({ loading: false, data: { page: 'closes' } });
  });

  it('une réponse arrivée trop tard (l\'adresse a changé entre-temps) est ignorée', async () => {
    const slow = deferred();
    apiMock.get.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ id: 'B' });
    const { result, rerender } = renderHook(({ path }) => useApiQuery(path), { initialProps: { path: '/a' } });
    rerender({ path: '/b' });
    await waitFor(() => expect(result.current.data).toEqual({ id: 'B' }));

    await act(async () => slow.resolve({ id: 'A' })); // la réponse de /a arrive après
    expect(result.current.data).toEqual({ id: 'B' });
  });

  it('reload : redemande la même adresse ; setData : corrige la donnée sans recharger', async () => {
    apiMock.get.mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });
    const { result } = renderHook(() => useApiQuery('/stats'));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    expect(apiMock.get).toHaveBeenCalledTimes(2);

    act(() => result.current.setData((d) => ({ n: d.n + 10 })));
    expect(result.current.data).toEqual({ n: 12 });
    expect(apiMock.get).toHaveBeenCalledTimes(2);
  });
});
