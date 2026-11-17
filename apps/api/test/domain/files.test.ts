import { describe, expect, it } from 'vitest';
import {
  MAX_ATTACHMENT_BYTES,
  sanitizeFilename,
  sniffMimeType,
  validateAttachment,
} from '../../src/domain/files.js';

import { PNG_1PX } from '../fixtures.js';

describe('Validación de adjuntos', () => {
  it('detecta el tipo por la firma del contenido', () => {
    expect(sniffMimeType(PNG_1PX)).toBe('image/png');
    expect(sniffMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMimeType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffMimeType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });

  it('rechaza ejecutables o HTML aunque se llamen .png', () => {
    expect(() => validateAttachment(Buffer.from('MZ\x90\x00'))).toThrow(/no permitido/);
    expect(() => validateAttachment(Buffer.from('<script>alert(1)</script>'))).toThrow(
      /no permitido/,
    );
  });

  it('rechaza archivos vacíos o mayores de 5 MB', () => {
    expect(() => validateAttachment(Buffer.alloc(0))).toThrow(/vacío/);
    const big = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1);
    PNG_1PX.copy(big);
    expect(() => validateAttachment(big)).toThrow(/5 MB/);
  });

  it('limpia nombres de archivo peligrosos', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\temp\\foto "1".jpg')).toBe('foto 1.jpg');
    expect(sanitizeFilename('')).toBe('archivo');
  });
});
