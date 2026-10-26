/** Deliberate, public validation feedback. Never wrap internal error messages. */
export class InputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "InputError";
  }
}
