import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { Goal } from '../types.v2';
import { useAuth } from '../context/AuthContext';

export const useGoals = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Fetch Goals
    const { data: goals = [], isLoading, error } = useQuery({
        queryKey: ['goals', user?.id],
        queryFn: async () => {
            if (!user) return [];
            if (!supabase) throw new Error("Supabase client not initialized");

            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Goal[];
        },
        enabled: !!user, // Only fetch if user is logged in
    });

    // Create Goal
    const createGoal = useMutation({
        mutationFn: async (newGoal: Partial<Goal>) => {
            if (!user) throw new Error('User not authenticated');
            if (!supabase) throw new Error("Supabase client not initialized");

            const { data, error } = await supabase
                .from('goals')
                .insert([{ ...newGoal, user_id: user.id }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
        },
    });

    // Update Goal (e.g. adding money to it)
    const updateGoal = useMutation({
        mutationFn: async (updatedGoal: Partial<Goal> & { id: string }) => {
            if (!supabase) throw new Error("Supabase client not initialized");
            const { id, ...updates } = updatedGoal;
            const { data, error } = await supabase
                .from('goals')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
        },
    });

    // Delete Goal
    const deleteGoal = useMutation({
        mutationFn: async (id: string) => {
            if (!supabase) throw new Error("Supabase client not initialized");
            const { error } = await supabase
                .from('goals')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
        },
    });

    return {
        goals,
        isLoading,
        error,
        createGoal,
        updateGoal,
        deleteGoal
    };
};
