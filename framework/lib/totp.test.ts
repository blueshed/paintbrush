import { describe, test, expect } from "bun:test";
import { generateSecret, verifyCode } from "./totp";
import { TOTP } from "otpauth";

describe("generateSecret", () => {
  test("returns secret, uri, and qrDataUrl", async () => {
    const result = await generateSecret("Wedding", "admin@test.com");
    expect(result.secret).toBeTruthy();
    expect(result.secret.length).toBeGreaterThanOrEqual(16);
    expect(result.uri).toContain("otpauth://totp/");
    expect(result.uri).toContain("Wedding");
    expect(decodeURIComponent(result.uri)).toContain("admin@test.com");
    expect(result.qrDataUrl).toStartWith("data:image/png;base64,");
  });
});

describe("verifyCode", () => {
  test("accepts a valid current code", async () => {
    const { secret } = await generateSecret("Test", "user@test.com");
    // Generate the current valid code
    const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
    const code = totp.generate();

    expect(verifyCode(secret, code)).toBe(true);
  });

  test("rejects an invalid code", async () => {
    const { secret } = await generateSecret("Test", "user@test.com");
    expect(verifyCode(secret, "000000")).toBe(false);
  });

  test("rejects empty code", async () => {
    const { secret } = await generateSecret("Test", "user@test.com");
    expect(verifyCode(secret, "")).toBe(false);
  });
});
