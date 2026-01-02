/**
 * Base Category Keys
 * 
 * These are the canonical keys used for base categories.
 * Translations are managed via i18n (locales/en.ts and locales/es.ts).
 * 
 * Custom categories don't have a base_category_key (NULL in DB).
 */

export const BASE_CATEGORY_KEYS = [
    'housing',
    'transport',
    'food',
    'health',
    'entertainment',
    'subscriptions',
    'education',
    'personal',
    'savings',
    'debt',
    'insurance',
    'taxes',
    'business',
    'gifts',
    'travel',
    'home',
    'pets',
    'donations',
    'utilities',
    'other',
] as const;

export type BaseCategoryKey = typeof BASE_CATEGORY_KEYS[number];

/**
 * Check if a key is a valid base category
 */
export function isBaseCategoryKey(key: string): key is BaseCategoryKey {
    return BASE_CATEGORY_KEYS.includes(key as BaseCategoryKey);
}
