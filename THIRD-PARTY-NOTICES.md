# Third-party notices

What ships with Code Sleuth, and under which license. Code Sleuth itself is MIT ([LICENSE](LICENSE)).

## Runtime dependencies

These are installed with the package and run when it runs.

<!-- The rows below are held to package.json by test/notices.test.ts: every runtime dependency, its version
and its license, and no row for one that is not there. -->

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `yaml` | 2.9.1 | ISC | <https://github.com/eemeli/yaml> |

## Development dependencies

None of them ship in the package. TypeScript, Vitest, ESLint, Prettier and their dependencies are used to build
and test Code Sleuth, and are not part of the installed package. Run from GitHub with npx, the first run fetches
them to build it.

## Repeating the scan

```sh
npm ls --omit=dev --all
npm query ':root > .prod' | node -e 'for (const p of JSON.parse(require("fs").readFileSync(0, "utf8"))) console.log(p.name, p.version, p.license)'
```

The first lists everything that ships; the second prints each runtime dependency's name, version and license.
