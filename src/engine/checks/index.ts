import type { Check } from "../check.js";
import { pathsMachine } from "./paths.machine.js";
import { namesDeny } from "./names.deny.js";
import { filesLarge } from "./files.large.js";
import { workflowsPermissions } from "./workflows.permissions.js";
import { workflowsPrtarget } from "./workflows.prtarget.js";
import { workflowsInjection } from "./workflows.injection.js";
import { depsLockfile } from "./deps.lockfile.js";
import { depsAdvisories } from "./deps.advisories.js";
import { depsOutdated } from "./deps.outdated.js";
import { depsUpdates } from "./deps.updates.js";
import { qualityMarkers } from "./quality.markers.js";
import { ciPresent } from "./ci.present.js";
import { ciTests } from "./ci.tests.js";
import { docsChangelog } from "./docs.changelog.js";
import { docsConduct } from "./docs.conduct.js";
import { docsContributing } from "./docs.contributing.js";
import { docsReadme } from "./docs.readme.js";
import { docsSecurity } from "./docs.security.js";
import { filesSensitive } from "./files.sensitive.js";
import { githubTemplates } from "./github.templates.js";
import { licenseDeps } from "./license.deps.js";
import { licenseFile } from "./license.file.js";
import { secretsHistory } from "./secrets.history.js";
import { secretsTree } from "./secrets.tree.js";

/** The check table: every check, once, in the order of the spec's table. A goal picks from it by id. */
export const CHECKS: readonly Check[] = [
  secretsTree,
  secretsHistory,
  filesSensitive,
  licenseFile,
  licenseDeps,
  pathsMachine,
  namesDeny,
  filesLarge,
  docsReadme,
  docsContributing,
  docsConduct,
  docsSecurity,
  docsChangelog,
  githubTemplates,
  ciPresent,
  ciTests,
  workflowsPermissions,
  workflowsPrtarget,
  workflowsInjection,
  depsLockfile,
  depsAdvisories,
  depsUpdates,
  depsOutdated,
  qualityMarkers,
];
