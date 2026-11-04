/**
 * The secret rules. Each pattern is a regex STRING, in the subset Node and other engines agree on: no
 * lookbehind, no inline flags, no named groups. The rules are not exhaustive: a clean secret check means
 * none of these matched, not that there is no secret.
 */
export interface SecretRule {
  id: string;
  name: string;
  pattern: string;
  /** Match ignoring case. */
  ignoreCase?: boolean;
  /** The capture group that holds the value; 0 is the whole match. */
  group?: number;
  /** A guess from a name rather than a known shape: weighed one step down, and held to an entropy floor. */
  nameGuess?: boolean;
  /**
   * The match marks a secret rather than being one: a private key's header. It is shown as it is, and the
   * value hashed is the block it opens, up to its END line.
   */
  marker?: boolean;
}

export const SECRET_RULES: readonly SecretRule[] = [
  {
    id: "private-key",
    name: "a private key",
    pattern: "-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----",
    marker: true,
  },
  { id: "aws-access-key-id", name: "an AWS access key id", pattern: "\\b(?:AKIA|ASIA)[0-9A-Z]{16}\\b" },
  { id: "github-token", name: "a GitHub token", pattern: "\\bgh[pousr]_[A-Za-z0-9]{36,}\\b" },
  { id: "github-pat", name: "a GitHub fine-grained token", pattern: "\\bgithub_pat_[A-Za-z0-9_]{50,}" },
  { id: "npm-token", name: "an npm token", pattern: "\\bnpm_[A-Za-z0-9]{36,}\\b" },
  { id: "slack-token", name: "a Slack token", pattern: "\\bxox[abprs]-[A-Za-z0-9-]{10,}" },
  {
    id: "slack-webhook",
    name: "a Slack incoming webhook",
    pattern: "https://hooks\\.slack\\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]{8,}",
  },
  {
    id: "teams-webhook",
    name: "a Teams incoming webhook",
    pattern: "https://[A-Za-z0-9.-]+\\.webhook\\.office\\.com/webhookb2/[A-Za-z0-9@/._-]{20,}",
  },
  { id: "anthropic-key", name: "an Anthropic API key", pattern: "\\bsk-ant-[A-Za-z0-9_-]{20,}" },
  { id: "openai-key", name: "an OpenAI project key", pattern: "\\bsk-proj-[A-Za-z0-9_-]{20,}" },
  { id: "stripe-key", name: "a Stripe live key", pattern: "\\b[rs]k_live_[A-Za-z0-9]{20,}" },
  { id: "google-api-key", name: "a Google API key", pattern: "\\bAIza[0-9A-Za-z_-]{35}\\b" },
  {
    id: "assigned-secret",
    name: "a long random value assigned to a secret-sounding name",
    pattern:
      // The name's two sides are bounded: unbounded, a long run of name characters holding many of the words
      // is retried from every place in it, which takes the cube of its length.
      "([A-Za-z0-9_.-]{0,64}(?:secret|token|password|passwd|api_?key|access_?key|private_?key|auth_?key)[A-Za-z0-9_.-]{0,64})[\"']?\\s*[:=]\\s*[\"']?([A-Za-z0-9+/=_.-]{16,})",
    ignoreCase: true,
    group: 2,
    nameGuess: true,
  },
];

/** A name guess must look random: at least this many bits per character, and letters and digits both. */
export const NAME_GUESS_MIN_ENTROPY = 3.5;
