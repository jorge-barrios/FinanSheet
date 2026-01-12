import { useState, useEffect, useCallback, useRef } from 'react';
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
 * Now includes auto-refresh when context payments change (e.g., after recording a payment).
 * 
 * @param commitmentId The ID of the commitment to load history for
 * @param contextPayments Payments available from context (for change detection)
 */
export function useCommitmentHistory(
    commitmentId: string | undefined,
    contextPayments: Payment[] = []
): UseCommitmentHistoryResult {
    const [historyPayments, setHistoryPayments] = useState<Payment[]>(contextPayments);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    // Track context payment changes to auto-refresh
    // Use a fingerprint based on count + latest updated_at to detect edits too
    const getFingerprint = useCallback((payments: Payment[]) => {
        if (payments.length === 0) return '0-0';
        const latestUpdate = payments.reduce((max, p) => {
            const updated = p.updated_at || p.created_at || '';
            return updated > max ? updated : max;
        }, '');
        return `${payments.length}-${latestUpdate}`;
    }, []);

    const prevFingerprintRef = useRef<string>(getFingerprint(contextPayments));
    const hasLoadedFullHistoryRef = useRef<boolean>(false);

    const fetchHistory = useCallback(async () => {
        if (!commitmentId) return;

        setIsLoadingHistory(true);
        setHistoryError(null);

        try {
            console.log(`[useCommitmentHistory] Fetching full history for ${commitmentId}`);
            const fullPayments = await PaymentService.getPayments(commitmentId);

            setHistoryPayments(fullPayments);
            hasLoadedFullHistoryRef.current = true;
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
            // Reset state for new commitment
            hasLoadedFullHistoryRef.current = false;
            prevFingerprintRef.current = getFingerprint(contextPayments);
            setHistoryPayments(contextPayments);
            fetchHistory();
        } else {
            setHistoryPayments([]);
        }
    }, [commitmentId]); // Intentionally not including contextPayments to avoid refetch loops

    // Auto-refresh when context payments change (e.g., after recording/editing a payment)
    // Uses fingerprint to detect both new payments and edits to existing payments
    useEffect(() => {
        const currentFingerprint = getFingerprint(contextPayments);
        const prevFingerprint = prevFingerprintRef.current;

        // Only refresh if: 
        // 1. We have a commitmentId
        // 2. We've already loaded full history once
        // 3. Fingerprint changed (payment added/edited/removed)
        if (commitmentId && hasLoadedFullHistoryRef.current && currentFingerprint !== prevFingerprint) {
            console.log(`[useCommitmentHistory] Context payments changed (${prevFingerprint} -> ${currentFingerprint}), refreshing...`);
            prevFingerprintRef.current = currentFingerprint;
            fetchHistory();
        }
    }, [commitmentId, contextPayments, getFingerprint, fetchHistory]);

    return {
        historyPayments,
        isLoadingHistory,
        historyError,
        refreshHistory: fetchHistory
    };
}

