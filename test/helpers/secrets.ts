/**
 * Fake secrets, assembled from fragments at test time. Nothing committed in this repository matches a
 * secret rule: each prefix is split, and the body is filler from a fixed seed, so the same test gives the
 * same values every run. None of these was ever issued by anyone.
 */

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Deterministic filler: the same seed always gives the same characters. */
export function filler(seed: number, length: number, alphabet = ALNUM): string {
  let state = seed >>> 0 || 1;
  let out = "";
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    out += alphabet[(state >>> 16) % alphabet.length];
  }
  return out;
}

const join = (...parts: string[]) => parts.join("");

/** One value per rule that the rule must match, and one near miss it must not. */
export const SECRETS: Record<string, { value: string; line: (v: string) => string; miss: string }> = {
  "aws-access-key-id": {
    value: join("AK", "IA", filler(1, 16, UPPER)),
    line: (v) => `aws_access_key_id = ${v}`,
    miss: `id = ${join("AK", "IA", filler(1, 15, UPPER))}`,
  },
  "github-token": {
    value: join("gh", "p_", filler(2, 36)),
    line: (v) => `const token = "${v}";`,
    miss: `const value = "${join("gh", "p_", filler(2, 20))}";`,
  },
  "github-pat": {
    value: join("github", "_pat_", filler(3, 22), "_", filler(4, 59)),
    line: (v) => `GH_TOKEN=${v}`,
    miss: `GH=${join("github", "_pat_", filler(3, 20))}`,
  },
  "npm-token": {
    value: join("np", "m_", filler(5, 36)),
    line: (v) => `NPM=${v}`,
    miss: `NPM=${join("np", "m_", filler(5, 10))}`,
  },
  "slack-token": {
    value: join("xo", "xb-", filler(6, 12, "0123456789"), "-", filler(7, 24)),
    line: (v) => `slack: ${v}`,
    miss: `slack: ${join("xo", "xz-", filler(6, 12))}`,
  },
  "slack-webhook": {
    value: join(
      "https://hooks.",
      "slack.com/services/T",
      filler(8, 8, UPPER),
      "/B",
      filler(9, 8, UPPER),
      "/",
      filler(10, 24),
    ),
    line: (v) => `webhook = "${v}"`,
    miss: `webhook = "${join("https://hooks.", "slack.com/services/")}"`,
  },
  "teams-webhook": {
    value: join("https://contoso.", "webhook.office.com/webhookb2/", filler(11, 36), "@", filler(12, 36)),
    line: (v) => `TEAMS=${v}`,
    miss: `TEAMS=${join("https://contoso.", "webhook.office.com/webhookb2/", "short")}`,
  },
  "anthropic-key": {
    value: join("sk", "-ant-", "api03-", filler(13, 40)),
    line: (v) => `ANTHROPIC_API_KEY=${v}`,
    miss: `ANTHROPIC_API_KEY=${join("sk", "-ant-", "abc")}`,
  },
  "openai-key": {
    value: join("sk", "-proj-", filler(14, 48)),
    line: (v) => `OPENAI=${v}`,
    // A bare sk- prefix matches base64 blobs and hashes, so there is no rule for it.
    miss: `OPENAI=${join("sk", "-", filler(14, 48))}`,
  },
  "stripe-key": {
    value: join("sk", "_live_", filler(15, 24)),
    line: (v) => `stripe = '${v}'`,
    miss: `stripe = '${join("sk", "_test_", filler(15, 24))}'`,
  },
  "google-api-key": {
    value: join("AI", "za", filler(16, 35)),
    line: (v) => `key=${v}`,
    miss: `key=${join("AI", "za", filler(16, 20))}`,
  },
  "assigned-secret": {
    value: filler(17, 32),
    line: (v) => `client_secret: "${v}"`,
    // Long, but not random: a guess from a name needs letters, digits and entropy.
    miss: `client_secret: "${"hunter2".repeat(4)}"`,
  },
};

/** A fake private key, its header split so no committed file opens a key block. */
export function privateKey(seed: number): { header: string; body: string; text: string } {
  const header = join("-----BEGIN ", "RSA PRIVATE", " KEY-----");
  const body = filler(seed, 64);
  return { header, body, text: `${header}\n${body}\n${join("-----END ", "RSA PRIVATE", " KEY-----")}\n` };
}
