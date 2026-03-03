/**
 * Auth — re-exports the @Auth decorator from decorators.ts
 * and provides helper utilities for auth flows.
 *
 * The @Auth decorator itself lives in decorators.ts because
 * it shares the same metadata object as @Resource/@Controller.
 */

export { Auth } from "./decorators";
