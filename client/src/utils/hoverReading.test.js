// Tests — lecture au survol : QUOI lire (S5R2-07, recette du 08/10)
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readableTarget, isPrivatePath, cleanTextForSpeech, fitForSpeech, frenchBrowserVoices, speakableText,
} from './hoverReading.js';

/** Construit un morceau de page et renvoie l'élément désigné par data-t */
function page(html) {
  document.body.innerHTML = html;
  return (name) => document.querySelector(`[data-t="${name}"]`);
}

describe('readableTarget', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('un paragraphe : son texte', () => {
    const $ = page('<p data-t="p">Bienvenue à Senlis</p>');
    expect(readableTarget($('p'))).toEqual({ element: $('p'), text: 'Bienvenue à Senlis' });
  });

  it('un morceau de phrase (<strong>) : toute la phrase', () => {
    const $ = page('<p data-t="p">Vote <strong data-t="s">ouvert</strong> jusqu’au 30</p>');
    expect(readableTarget($('s')).text).toBe('Vote ouvert jusqu’au 30');
  });

  it('un lien ou un bouton se lit en entier, même survolé sur son icône', () => {
    const $ = page('<a href="/carte" data-t="a"><span data-t="icone">🗺️</span> Voir la carte</a>');
    expect(readableTarget($('icone')).text).toBe('Voir la carte');
  });

  it('un conteneur sans texte à lui (marge, grille, décor) : rien', () => {
    const $ = page('<div data-t="grille"><article><h2>Titre</h2><p>Texte</p></article></div>');
    expect(readableTarget($('grille'))).toBeNull();
  });

  it('jamais un champ de saisie, ni ce qui est marqué data-no-read ou aria-hidden', () => {
    const $ = page(`
      <input data-t="champ" value="nath@exemple.fr" />
      <span data-no-read data-t="pseudo">Nath</span>
      <span aria-hidden="true" data-t="deco">✨ décor</span>`);
    expect(readableTarget($('champ'))).toBeNull();
    expect(readableTarget($('pseudo'))).toBeNull();
    expect(readableTarget($('deco'))).toBeNull();
  });

  it('une image : son texte alternatif ; une image décorative (alt vide) : rien', () => {
    const $ = page('<img data-t="i" alt="Cathédrale de Senlis" /><img data-t="d" alt="" />');
    expect(readableTarget($('i')).text).toBe('Cathédrale de Senlis');
    expect(readableTarget($('d'))).toBeNull();
  });

  it('le texte d\'un bloc : des espaces entre les blocs, le contenu exclu ignoré', () => {
    const $ = page('<li data-t="li"><h3>Parking</h3><p>120 places</p><span data-no-read>secret</span></li>');
    expect(speakableText($('li'))).toBe('Parking 120 places');
  });
});

describe('isPrivatePath', () => {
  it('pages de compte et d\'administration : jamais de lecture', () => {
    expect(isPrivatePath('/mon-compte')).toBe(true);
    expect(isPrivatePath('/admin/enquetes/12')).toBe(true);
    expect(isPrivatePath('/reset-password')).toBe(true);
  });
  it('pages publiques : lecture permise (et « /administration » n\'est pas « /admin »)', () => {
    expect(isPrivatePath('/')).toBe(false);
    expect(isPrivatePath('/propositions/3')).toBe(false);
    expect(isPrivatePath('/administration')).toBe(false);
  });
});

describe('préparation du texte', () => {
  it('retire émojis et flèches, réduit les espaces', () => {
    expect(cleanTextForSpeech('🦌  Senlis ♿ Participatif → ')).toBe('Senlis Participatif');
    expect(cleanTextForSpeech('👩‍👩‍👧 Famille 🇫🇷')).toBe('Famille');
  });

  it('coupe un texte trop long à la fin d\'une phrase, sinon d\'un mot', () => {
    const phrases = `${'Une phrase assez longue pour remplir. '.repeat(20)}`;
    const cut = fitForSpeech(phrases, 100);
    expect(cut.length).toBeLessThanOrEqual(100);
    expect(cut.endsWith('.')).toBe(true);
    expect(fitForSpeech('mot '.repeat(50), 40)).toMatch(/mot…$/);
    expect(fitForSpeech('court', 40)).toBe('court');
  });
});

describe('frenchBrowserVoices', () => {
  it('seulement le français, les voix naturelles en premier', () => {
    const voices = [
      { name: 'Microsoft Hortense', lang: 'fr-FR' },
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Microsoft Denise Online (Natural)', lang: 'fr-FR' },
      { name: 'Google français', lang: 'fr-FR' },
    ];
    expect(frenchBrowserVoices(voices).map((v) => v.name)).toEqual([
      'Microsoft Denise Online (Natural)', 'Google français', 'Microsoft Hortense',
    ]);
  });
});
