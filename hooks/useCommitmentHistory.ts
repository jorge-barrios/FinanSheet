import { useState, useEffect, useCallback } from 'react';
import { Payment } from '../types.v2';
import { PaymentService } from '../services/dataService.v2';

interface UseCommitmentHistoryResult {
    historyPayments: Payment[];
    isLoadingHistory: boolean;
    historyError: string | null;
    refreshHistory: () => Promise<void>;
}

/**
 * Hook to load the FULL payment history for a specific commitment.
 * This is needed because the global context only loads a 12-month window.
 * 
 * @param commitmentId The ID of the commitment to load history for
 * @param initialContextPayments Payments available from context (for immediate display)
 */
export function useCommitmentHistory(
    commitmentId: string | undefined,
    initialContextPayments: Payment[] = []
): UseCommitmentHistoryResult {
    const [historyPayments, setHistoryPayments] = useState<Payment[]>(initialContextPayments);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [hasLoadedFullHistory, setHasLoadedFullHistory] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!commitmentId) return;

        setIsLoadingHistory(true);
        setHistoryError(null);

        try {
            console.log(`[useCommitmentHistory] Fetching full history for ${commitmentId}`);
            const fullPayments = await PaymentService.getPayments(commitmentId);

            setHistoryPayments(fullPayments);
            setHasLoadedFullHistory(true);
        } catch (err) {
            console.error('[useCommitmentHistory] Error loading history:', err);
            setHistoryError('Error al cargar el historial completo');
        } finally {
            setIsLoadingHistory(false);
        }
    }, [commitmentId]);

    // Initial load when commitmentId changes
    useEffect(() => {
        if (commitmentId) {
            // If we haven't loaded full history yet, trigger fetch
            // We start with initialContextPayments to show something immediately
            setHistoryPayments(initialContextPayments);
            fetchHistory();
        } else {
            setHistoryPayments([]);
        }
    }, [commitmentId]); // Intentionally not including initialContextPayments to avoid refetch loops

    // Update local state if context provides *more* (or different) payments 
    // BUT only if we haven't loaded the full history yet. 
    // Once full history is loaded, it is authoritative (it contains everything).
    // However, if context updates (e.g. user edits a payment), we might want to reflect that.
    // Simplifying assumption: Detailed history is mostly read-only.
    // If we wanted reactive updates, we'd need to merge context updates into historyPayments.
    // For now, let's stick to the "fetch on open" strategy.

    return {
        historyPayments,
        isLoadingHistory,
        historyError,
        refreshHistory: fetchHistory
    };
}
