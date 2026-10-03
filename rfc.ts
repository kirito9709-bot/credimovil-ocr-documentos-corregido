/**
 * Utilidades para cálculo y validación de RFC de personas físicas en México.
 * El RFC se compone de 13 caracteres:
 * - 4 letras (apellidos y nombre)
 * - 6 dígitos (año, mes, día de nacimiento: YYMMDD)
 * - 3 caracteres alfanuméricos (homoclave asignada por SAT)
 * Los primeros 10 caracteres son idénticos a los primeros 10 caracteres del CURP.
 */

export function calcularRfcBase(
  curp?: string,
  nombre?: string,
  primerApellido?: string,
  segundoApellido?: string,
  fechaNacimiento?: string
): string {
  // 1. Si existe CURP con al menos 10 caracteres, los primeros 10 caracteres son el RFC base exacto
  if (curp && curp.trim().length >= 10) {
    const curpBase = curp.trim().toUpperCase().substring(0, 10);
    if (/^[A-Z&Ñ]{4}\d{6}/.test(curpBase)) {
      return curpBase;
    }
  }

  // 2. Si no hay CURP o aún no tiene 10 caracteres, calcular mediante reglas del SAT
  const limpiarTexto = (s: string) =>
    (s || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '');

  const p1 = limpiarTexto(primerApellido || '');
  const p2 = limpiarTexto(segundoApellido || '');
  let nom = limpiarTexto(nombre || '');

  // Omitir nombres comunes iniciales según regla SAT
  const partesNombre = (nombre || '').toUpperCase().trim().split(/\s+/);
  if (partesNombre.length > 1 && (partesNombre[0] === 'JOSE' || partesNombre[0] === 'MARIA')) {
    nom = limpiarTexto(partesNombre[1] || partesNombre[0]);
  }

  const letra1 = p1[0] || 'X';
  const vocalMatch = p1.substring(1).match(/[AEIOU]/);
  const vocal2 = vocalMatch ? vocalMatch[0] : 'X';
  const letra3 = p2[0] || (p1.length > 2 ? p1[2] : 'X');
  const letra4 = nom[0] || 'X';

  let fechaDigitos = '000101';
  if (fechaNacimiento) {
    const nums = fechaNacimiento.replace(/\D/g, '');
    if (nums.length === 8) {
      // YYYYMMDD -> YYMMDD
      fechaDigitos = nums.substring(2, 8);
    }
  }

  return `${letra1}${vocal2}${letra3}${letra4}${fechaDigitos}`.toUpperCase();
}

/**
 * Valida formato de RFC mexicano de persona física (10 a 13 caracteres)
 */
export function esRfcValido(rfc: string): boolean {
  if (!rfc) return false;
  const clean = rfc.trim().toUpperCase();
  // 10 caracteres (base) o 13 caracteres (completo con homoclave)
  const regex = /^[A-Z&Ñ]{4}\d{6}([A-Z0-9]{3})?$/;
  return regex.test(clean);
}
