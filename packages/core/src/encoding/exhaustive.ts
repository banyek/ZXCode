/** New semantic variants must get an explicit encoder before typechecking passes. */
export function unhandledEncodingNode(value: never): never {
  throw new TypeError(`Unrecognized validated encoding node: ${String(value)}`);
}
