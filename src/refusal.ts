/** A stated refusal: one `Error:` line, one `Hint:` line, exit 2. Thrown anywhere; printed by the CLI. */
export class Refusal extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
    this.name = "Refusal";
  }
}

/** Ctrl-C at a prompt: the run stops, says nothing more, and exits as a shell reports an interrupt. */
export class Interrupted extends Error {
  constructor() {
    super("interrupted");
    this.name = "Interrupted";
  }
}
