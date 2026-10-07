// Contours des quartiers IRIS (fichier statique de public/), chargés UNE
// fois par visite : plusieurs composants peuvent les demander, une seule
// requête part (même principe que verifyEmailOnce).
let promise = null;

export function loadIris() {
  promise ??= fetch('/data/iris-senlis.geojson')
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null); // pas de contours ? la page fonctionne sans
  return promise;
}

/** Pour les tests uniquement */
export function resetIrisCache() {
  promise = null;
}
