const REDACTED = '<redacted>';

/** Remove credentials from backend output before it reaches disk or a bundle. */
export function redactSensitiveText(text: string): string {
  return text
    .replace(/("token"\s*:\s*")[^"]*(")/gi, `$1${REDACTED}$2`)
    .replace(/([?&]token=)[^&\s"'<>]+/gi, `$1${REDACTED}`)
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,"'}]+/gi, `$1${REDACTED}`);
}
