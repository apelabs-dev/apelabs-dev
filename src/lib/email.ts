// The one email rule, shared by the browser script and the server (kept tiny for the client bundle).
// Deliberately plain: one @, no spaces or header-significant characters, a dotted domain.
export const MAX_EMAIL = 254;
const EMAIL = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]{2,}$/;
export const isEmail = (s: string) => s.length <= MAX_EMAIL && EMAIL.test(s);
