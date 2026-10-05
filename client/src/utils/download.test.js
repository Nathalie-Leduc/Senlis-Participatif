import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadJson, exportFilename } from './download.js';

describe('exportFilename', () => {
  it('produit un nom daté AAAA-MM-JJ', () => {
    expect(exportFilename(new Date('2026-09-26T10:00:00Z'))).toBe('senlis-participatif-mes-donnees-2026-09-26.json');
  });
});

describe('downloadJson', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crée un lien de téléchargement temporaire, le clique, puis libère la mémoire', async () => {
    // jsdom ne sait pas créer de vraies URL de fichier : on les simule
    URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadJson({ pseudo: 'nath' }, 'mes-donnees.json');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('application/json');
    // jsdom n'implémente pas blob.text() : on lit le fichier comme le
    // ferait un navigateur ancien, avec un FileReader
    const content = await new Promise((resolve) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    expect(JSON.parse(content)).toEqual({ pseudo: 'nath' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    // Le lien temporaire ne reste pas dans la page
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
