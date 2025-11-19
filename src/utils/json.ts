export interface StringifyOptions {
  replacer?: (
    this: unknown,
    key: string,
    value: unknown,
  ) => unknown | (number | string)[] | null;
  space?: string | number;
  escapeHtml?: boolean;
}

export function stringify(
  value: unknown,
  options: StringifyOptions = {},
): string {
  const { replacer, space, escapeHtml } = options;

  const json =
    replacer || space
      ? JSON.stringify(value, replacer, space)
      : JSON.stringify(value);

  if (escapeHtml && typeof json === 'string') {
    return json.replace(/[<>&]/g, (c) => {
      switch (c.charCodeAt(0)) {
        case 0x3c: // <
          return '\u003c';
        case 0x3e: // >
          return '\u003e';
        case 0x26: // &
          return '\u0026';
        default:
          return c;
      }
    });
  }

  return json;
}
