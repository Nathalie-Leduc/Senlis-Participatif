let counter = 0;

// email et pseudo sont @unique dans schema.prisma → un compteur
// garantit des valeurs différentes à chaque appel, même dans un
// même test (ex. "refuse un email déjà pris").
export function buildUser(overrides = {}) {
  counter += 1;
  return {
    email: `test${counter}@senlis-test.fr`,
    password: 'MotDePasse123!',
    pseudo: `testeur${counter}`,
    ...overrides,
  };
}

// Le HTML de l'email contient un lien du type
// http://localhost:5173/verification-email?token=abcdef123...
// — on récupère juste ce qui suit "token=".
export function extractTokenFromEmail(sendMailCallArgs) {
  const match = sendMailCallArgs.html.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error("Aucun jeton trouvé — sendMailMock a-t-il été appelé ?");
  return match[1];
}