export function hasPermission(permissions: string[], required: string | null) {
  if (!required) return true;
  const [module] = required.split(".");
  return permissions.some((permission) => permission === "*" || permission === required || permission === `${module}.*`);
}
