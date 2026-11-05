/**
 * The common licenses, identified by phrases from their text, in the order they must be tried: a lesser
 * or Affero GPL quotes the GPL's name, so it is tried before the GPL.
 */
const LICENSES: readonly { id: string; phrases: readonly string[]; shows: string }[] = [
  {
    id: "AGPL-3.0",
    phrases: ["gnu affero general public license"],
    shows: "GNU AFFERO GENERAL PUBLIC LICENSE",
  },
  {
    id: "LGPL-3.0",
    phrases: ["gnu lesser general public license", "version 3, 29 june 2007"],
    shows: "GNU LESSER GENERAL PUBLIC LICENSE, Version 3",
  },
  {
    id: "LGPL-2.1",
    phrases: ["gnu lesser general public license", "version 2.1"],
    shows: "GNU LESSER GENERAL PUBLIC LICENSE, Version 2.1",
  },
  {
    id: "GPL-3.0",
    phrases: ["gnu general public license", "version 3, 29 june 2007"],
    shows: "GNU GENERAL PUBLIC LICENSE, Version 3",
  },
  {
    id: "GPL-2.0",
    phrases: ["gnu general public license", "version 2, june 1991"],
    shows: "GNU GENERAL PUBLIC LICENSE, Version 2",
  },
  { id: "MPL-2.0", phrases: ["mozilla public license", "2.0"], shows: "Mozilla Public License 2.0" },
  { id: "Apache-2.0", phrases: ["apache license", "version 2.0"], shows: "Apache License, Version 2.0" },
  {
    id: "BSD-3-Clause",
    phrases: ["redistribution and use in source and binary forms", "neither the name of"],
    shows: "Redistribution and use in source and binary forms ... Neither the name of",
  },
  {
    id: "BSD-2-Clause",
    phrases: ["redistribution and use in source and binary forms"],
    shows: "Redistribution and use in source and binary forms",
  },
  {
    id: "ISC",
    phrases: ["permission to use, copy, modify, and/or distribute this software for any purpose"],
    shows: "Permission to use, copy, modify, and/or distribute this software",
  },
  {
    id: "MIT",
    phrases: ["permission is hereby granted, free of charge, to any person obtaining a copy"],
    shows: "Permission is hereby granted, free of charge",
  },
  {
    id: "Unlicense",
    phrases: ["this is free and unencumbered software released into the public domain"],
    shows: "This is free and unencumbered software released into the public domain",
  },
];

/** The license a file's text is, by its phrases, and the words that showed it. */
export function identifyLicense(text: string): { id: string; shows: string } | undefined {
  const flat = text.toLowerCase().replace(/\s+/g, " ");
  const match = LICENSES.find(({ phrases }) => phrases.every((phrase) => flat.includes(phrase)));
  return match === undefined ? undefined : { id: match.id, shows: match.shows };
}

/** `GPL-3.0-or-later`, `GPL-3.0-only` and `GPL-3.0+` are all `GPL-3.0` for comparing. */
export function baseLicense(id: string): string {
  return id
    .trim()
    .replace(/-(?:only|or-later)$/i, "")
    .replace(/\+$/, "")
    .toLowerCase();
}

/** The license ids an SPDX expression names, whatever joins them. */
export function licenseIds(expression: string): string[] {
  return expression
    .replace(/[()]/g, " ")
    .split(/\s+(?:OR|AND|WITH)\s+|\s+/i)
    .filter((part) => part !== "" && !/^(?:or|and|with)$/i.test(part));
}

/** GPL, AGPL and SSPL in any version; not the lesser GPL. */
function strongCopyleftId(id: string): boolean {
  return /^(?:a?gpl|sspl)(?:-|$)/.test(baseLicense(id));
}

/**
 * True when an SPDX expression binds its user to a strong copyleft license (GPL, AGPL, SSPL): it does
 * when every `OR` choice holds one, through any `AND`. A choice of any other license is a way out.
 */
export function isStrongCopyleft(expression: string): boolean {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;
  // SPDX: OR binds loosest, then AND, then WITH; parentheses group. A choice binds when every OR side does, a
  // combination when any AND side does.
  const either = (): boolean => {
    let bound = both();
    while (tokens[at]?.toUpperCase() === "OR") {
      at++;
      bound = both() && bound;
    }
    return bound;
  };
  const both = (): boolean => {
    let bound = one();
    while (tokens[at]?.toUpperCase() === "AND") {
      at++;
      bound = one() || bound;
    }
    return bound;
  };
  const one = (): boolean => {
    const token = tokens[at++];
    if (token === undefined) return false;
    let bound: boolean;
    if (token === "(") {
      bound = either();
      if (tokens[at] === ")") at++;
    } else bound = strongCopyleftId(token);
    if (tokens[at]?.toUpperCase() === "WITH") at += 2;
    return bound;
  };
  return either();
}
