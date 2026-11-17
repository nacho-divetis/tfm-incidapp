import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { PasswordHasher } from '../../application/ports.js';

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );

/**
 * Hash de contraseñas con scrypt (algoritmo recomendado por OWASP) usando solo
 * la librería estándar de Node. Formato: scrypt$N$r$p$sal$hash (base64).
 */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(
    private readonly params = { N: 16384, r: 8, p: 1 },
    private readonly keylen = 64,
  ) {}

  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const { N, r, p } = this.params;
    const key = await scrypt(plain, salt, this.keylen, { N, r, p, maxmem: 64 * 1024 * 1024 });
    return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
    if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, 'base64');
    const key = await scrypt(plain, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    // Comparación en tiempo constante (evita ataques de temporización).
    return key.length === expected.length && timingSafeEqual(key, expected);
  }
}
