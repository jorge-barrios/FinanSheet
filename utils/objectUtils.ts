export const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export const keysToSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => keysToSnakeCase(v));
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[toSnakeCase(key)] = keysToSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};
