/** Joins truthy class names; keeps primitives free of a classnames dependency. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
