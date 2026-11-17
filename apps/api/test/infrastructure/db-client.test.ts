import { describe, expect, it } from 'vitest';
import { postgresConnection } from '../../src/infrastructure/db/client.js';

describe('postgresConnection', () => {
  it('con sslmode=require exige TLS verificando el certificado y quita el parámetro', () => {
    const cfg = postgresConnection(
      'postgresql://u:p%40ss@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    );
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
    expect(cfg.connectionString).not.toContain('sslmode');
    expect(cfg.connectionString).toContain('channel_binding=require');
    expect(cfg.connectionString).toContain('u:p%40ss@ep-x.eu-central-1.aws.neon.tech/neondb');
  });

  it('sin sslmode o con sslmode=disable no usa TLS', () => {
    expect(postgresConnection('postgres://u:p@localhost:5432/db').ssl).toBeUndefined();
    expect(postgresConnection('postgres://u:p@localhost/db?sslmode=disable').ssl).toBeUndefined();
  });
});
