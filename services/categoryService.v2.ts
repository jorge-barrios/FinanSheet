/**
 * Category Service v2
 * 
 * Handles loading and combining categories from multiple sources:
 * 1. Base categories (from code, translated via i18n)
 * 2. Custom user categories (from categories_v2 table)
 * 3. User preferences (hidden categories from user_category_preferences table)
 */

import { supabase } from './supabaseClient';
import type { BaseCategoryKey } from '../utils/baseCategories';

export interface Category {
    id: string;
    name: string;
    isBase: boolean;
    base_category_key?: BaseCategoryKey | null;
    user_id?: string;
}

export interface CategoryPreference {
    base_category_key: BaseCategoryKey;
    is_hidden: boolean;
}

/**
 * Get all categories for a user, combining global + custom - hidden
 * @param userId User UUID
 * @param t Translation function from useLocalization
 * @param locale Current locale ('en' | 'es')
 */
export async function getUserCategories(
    userId: string,
    t: (key: string) => string,
    locale: 'en' | 'es'
): Promise<Category[]> {
    if (!supabase) {
        console.warn('Supabase not configured, returning empty array');
        return [];
    }

    try {
        // 1. Load global base categories from DB
        const { data: globalCats, error: globalError } = await supabase
            .from('categories_v2')
            .select('*')
            .eq('is_global', true);

        if (globalError) {
            console.error('Error loading global categories:', globalError);
            return [];
        }

        // 2. Load custom categories from DB
        const { data: customCats, error: customError } = await supabase
            .from('categories_v2')
            .select('*')
            .eq('user_id', userId)
            .eq('is_global', false);

        if (customError) {
            console.error('Error loading custom categories:', customError);
            // Continue with global categories only
        }

        // 3. Load user preferences (hidden categories)
        const { data: prefs, error: prefsError } = await supabase
            .from('user_category_preferences')
            .select('*')
            .eq('user_id', userId)
            .eq('is_hidden', true);

        if (prefsError) {
            console.error('Error loading category preferences:', prefsError);
            // Continue without filtering
        }

        const hiddenKeys = new Set(prefs?.map(p => p.base_category_key) || []);

        // 4. Map global categories (translate names)
        const globalCategories: Category[] = (globalCats || [])
            .filter(cat => !hiddenKeys.has(cat.base_category_key as BaseCategoryKey))
            .map(cat => ({
                id: cat.id,
                name: t(`category.${cat.base_category_key}`), // Translate here!
                isBase: true,
                base_category_key: cat.base_category_key as BaseCategoryKey
            }));

        // 5. Map custom categories (use actual names)
        const customCategories: Category[] = (customCats || []).map(cat => ({
            id: cat.id,
            name: cat.name,
            isBase: false,
            base_category_key: null,
            user_id: cat.user_id
        }));

        // 6. Combine and sort
        const allCategories = [...globalCategories, ...customCategories].sort((a, b) =>
            a.name.localeCompare(b.name, locale)
        );

        console.log('📁 Categories loaded:', {
            global: globalCategories.length,
            custom: customCategories.length,
            hidden: hiddenKeys.size,
            total: allCategories.length
        });

        return allCategories;
    } catch (error) {
        console.error('Error in getUserCategories:', error);
        return [];
    }
}

/**
 * Add a custom category for a user
 */
export async function addCustomCategory(
    userId: string,
    categoryName: string
): Promise<Category | null> {
    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('categories_v2')
        .insert({
            user_id: userId,
            name: categoryName,
            base_category_key: null,
            is_global: false
        })
        .select()
        .single();

    if (error) {
        console.error('Error adding custom category:', error);
        throw error;
    }

    return {
        id: data.id,
        name: data.name,
        isBase: false,
        base_category_key: null,
        user_id: data.user_id
    };
}

/**
 * Delete a custom category (only non-base categories can be deleted)
 */
export async function deleteCustomCategory(categoryId: string): Promise<void> {
    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('categories_v2')
        .delete()
        .eq('id', categoryId)
        .is('base_category_key', null); // Safety: only delete custom categories

    if (error) {
        console.error('Error deleting custom category:', error);
        throw error;
    }
}

/**
 * Hide a base category (user preference)
 */
export async function hideBaseCategory(
    userId: string,
    baseCategoryKey: BaseCategoryKey
): Promise<void> {
    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('user_category_preferences')
        .upsert({
            user_id: userId,
            base_category_key: baseCategoryKey,
            is_hidden: true
        });

    if (error) {
        console.error('Error hiding category:', error);
        throw error;
    }
}

/**
 * Show a previously hidden base category
 */
export async function showBaseCategory(
    userId: string,
    baseCategoryKey: BaseCategoryKey
): Promise<void> {
    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('user_category_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('base_category_key', baseCategoryKey);

    if (error) {
        console.error('Error showing category:', error);
        throw error;
    }
}

/**
 * Get user's hidden categories
 */
export async function getHiddenCategories(userId: string): Promise<BaseCategoryKey[]> {
    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from('user_category_preferences')
        .select('base_category_key')
        .eq('user_id', userId)
        .eq('is_hidden', true);

    if (error) {
        console.error('Error loading hidden categories:', error);
        return [];
    }

    return data?.map(p => p.base_category_key) || [];
}
