import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { sendMailMock } from './setup.js';
import { buildUser, extractTokenFromEmail } from './helpers.js';

const API = '/api/v1/auth';

describe('Auth — parcours complet', () => {
  it('inscription → email de vérification "envoyé" (mocké)', async () => {
    const user = buildUser();
    const res = await request(app).post(`${API}/register`).send(user);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(user.email);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe(user.email);
  });

  it('refuse une inscription avec un email déjà utilisé', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);

    const res = await request(app)
      .post(`${API}/register`)
      .send({ ...user, pseudo: 'autrepseudo' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it("refuse la connexion avant vérification de l'email", async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);

    const res = await request(app).post(`${API}/login`).send({ email: user.email, password: user.password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('parcours complet : inscription → vérification → connexion → /me', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);

    const token = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);
    await request(app).post(`${API}/verify-email`).send({ token });

    const loginRes = await request(app).post(`${API}/login`).send({ email: user.email, password: user.password });
    expect(loginRes.body.token).toBeDefined();

    const meRes = await request(app).get(`${API}/me`).set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.emailVerified).toBe(true);
  });

  it('refuse /me sans jeton', async () => {
    const res = await request(app).get(`${API}/me`);
    expect(res.status).toBe(401);
  });

  it('refuse un jeton de vérification déjà utilisé (usage unique)', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);
    const token = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);

    await request(app).post(`${API}/verify-email`).send({ token });
    const res = await request(app).post(`${API}/verify-email`).send({ token }); // 2e usage
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('mot de passe oublié → réinitialisation → connexion avec le nouveau mot de passe', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);
    const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);
    await request(app).post(`${API}/verify-email`).send({ token: verifyToken });

    sendMailMock.mockClear();
    await request(app).post(`${API}/forgot-password`).send({ email: user.email });
    const resetToken = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);
    const newPassword = 'NouveauMotDePasse456!';

    await request(app).post(`${API}/reset-password`).send({ token: resetToken, password: newPassword });

    const oldLogin = await request(app).post(`${API}/login`).send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post(`${API}/login`).send({ email: user.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it("forgot-password répond pareil, que l'email existe ou non (anti-énumération)", async () => {
    const res = await request(app).post(`${API}/forgot-password`).send({ email: 'inconnu@senlis-test.fr' });
    expect(res.status).toBe(200);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});