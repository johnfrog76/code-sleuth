import { cleanRemote } from "../case/repoInfo.js";

/** Where a ToolKit Space points: a GitHub repository's URL, or an Azure DevOps organisation and its repositories. */
export interface SpaceAddress {
  slug: string;
  /** `https://github.com/<owner>/<repo>`, or `https://dev.azure.com/<org>`; null when the Space names none. */
  org: string | null;
  /** The repository names of the Space's projects (Azure DevOps). */
  repos: string[];
}

/** How the Space a run files in was chosen. */
export type SpaceSource = "flag" | "origin" | "active";

/**
 * The Space whose address is this repository's origin, or undefined when none is, or more than one is.
 *
 * - GitHub: the Space's org is the repository's own URL, `github.com/<owner>/<repo>`.
 * - Azure DevOps: the origin is `dev.azure.com/<org>/<project>/_git/<repo>` (or its `ssh.dev.azure.com:v3/`
 *   form), the Space's org is `dev.azure.com/<org>`, and one of its projects' repositories is `<repo>`.
 *
 * Names compare without regard to case, as both hosts do.
 */
export function spaceForOrigin(
  remote: string | null,
  addresses: readonly SpaceAddress[],
): string | undefined {
  if (remote === null) return undefined;
  const origin = remote.toLowerCase();
  const ado = adoParts(origin);
  const matches = addresses.filter((address) => {
    if (address.org === null) return false;
    const org = cleanRemote(address.org).toLowerCase();
    if (ado === undefined) return org === origin;
    return org === `dev.azure.com/${ado.org}` && address.repos.some((r) => r.toLowerCase() === ado.repo);
  });
  return matches.length === 1 ? matches[0]!.slug : undefined;
}

/** `dev.azure.com/o/p/_git/r` and `ssh.dev.azure.com/v3/o/p/r` (a cleaned remote) as an org and a repository. */
function adoParts(origin: string): { org: string; repo: string } | undefined {
  const https = /^dev\.azure\.com\/([^/]+)\/[^/]+\/_git\/([^/]+)$/.exec(origin);
  if (https) return { org: https[1]!, repo: https[2]! };
  const ssh = /^ssh\.dev\.azure\.com\/v3\/([^/]+)\/[^/]+\/([^/]+)$/.exec(origin);
  if (ssh) return { org: ssh[1]!, repo: ssh[2]! };
  return undefined;
}
