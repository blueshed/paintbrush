/**
 * TOTP support — passwordless admin authentication via authenticator apps.
 *
 * Usage:
 *   import { generateSecret, verifyCode } from "./totp";
 *
 *   // Admin enrollment:
 *   const { secret, uri, qrDataUrl } = await generateSecret("Wedding", "admin@example.com");
 *   // Store secret in user record, show QR code to admin
 *
 *   // Admin login:
 *   const valid = verifyCode(secret, "123456");
 */

import { TOTP } from "otpauth";
import QRCode from "qrcode";

interface SecretResult {
  /** Base32-encoded secret — store this in the user record */
  secret: string;
  /** otpauth:// URI for manual entry in authenticator apps */
  uri: string;
  /** QR code as data:image/png;base64,... for <img src> */
  qrDataUrl: string;
}

/**
 * Generate a new TOTP secret with QR code.
 * @param issuer — display name in authenticator app (e.g. "Wedding")
 * @param account — user identifier (e.g. email)
 */
export async function generateSecret(issuer: string, account: string): Promise<SecretResult> {
  const totp = new TOTP({
    issuer,
    label: account,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri);

  return { secret, uri, qrDataUrl };
}

/**
 * Verify a 6-digit TOTP code against a stored secret.
 * Allows ±1 time step (30s window each side) for clock drift.
 */
export function verifyCode(secret: string, code: string): boolean {
  const totp = new TOTP({
    secret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  // validate() returns the time step delta (0 = exact, ±1 = adjacent window)
  // or null if invalid
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
