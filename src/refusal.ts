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
