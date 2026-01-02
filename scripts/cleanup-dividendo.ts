/**
 * Cleanup script to reset Dividendo GHM commitment to clean state
 * Run with: npx tsx scripts/cleanup-dividendo.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDividendo() {
    const commitmentId = 'a7a9d679-959d-4152-911b-6c0d0c2ae769';

    console.log('\n🧹 Cleaning up Dividendo GHM commitment...\n');

    // 1. Get all terms for this commitment
    const { data: terms, error: termsError } = await supabase
        .from('terms')
        .select('id, version, effective_from, effective_until')
        .eq('commitment_id', commitmentId)
        .order('version', { ascending: true });

    if (termsError) {
        console.error('Error fetching terms:', termsError);
        return;
    }

    console.log(`Found ${terms?.length || 0} terms:`);
    for (const t of terms || []) {
        console.log(`  v${t.version}: ${t.id.slice(0, 8)}... (${t.effective_from} to ${t.effective_until || 'null'})`);
    }

    // 2. Get all payments
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('id, period_date, term_id')
        .eq('commitment_id', commitmentId)
        .order('period_date', { ascending: true });

    if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
        return;
    }

    console.log(`\nFound ${payments?.length || 0} payments`);

    // 3. Keep only the first term (v1) and delete the rest
    const termV1 = terms?.find(t => t.version === 1);
    if (!termV1) {
        console.error('No v1 term found!');
        return;
    }

    const termsToDelete = terms?.filter(t => t.version > 1) || [];
    console.log(`\nWill keep term v1: ${termV1.id}`);
    console.log(`Will delete ${termsToDelete.length} newer terms`);

    // 4. Update all payments to point to v1 and restore original period_dates
    // Original payments were: Jul 2021, Aug 2021, Sep 2021, Oct 2021, Nov 2021
    const originalPeriodDates = [
        '2021-07-01',
        '2021-08-01',
        '2021-09-01',
        '2021-10-01',
        '2021-11-01'
    ];

    if (payments && payments.length > 0) {
        console.log('\n📝 Updating payments to v1 term with original dates...');

        // Sort payments by current period_date to match with original dates
        const sortedPayments = [...payments].sort((a, b) =>
            new Date(a.period_date).getTime() - new Date(b.period_date).getTime()
        );

        for (let i = 0; i < sortedPayments.length; i++) {
            const payment = sortedPayments[i];
            const newPeriodDate = originalPeriodDates[i] || payment.period_date;

            console.log(`  ${payment.period_date} -> ${newPeriodDate} (term ${termV1.id.slice(0, 8)}...)`);

            const { error } = await supabase
                .from('payments')
                .update({
                    term_id: termV1.id,
                    period_date: newPeriodDate
                })
                .eq('id', payment.id);

            if (error) {
                console.error(`Error updating payment ${payment.id}:`, error);
            }
        }
    }

    // 5. Delete payment_adjustments
    const { error: adjDeleteError } = await supabase
        .from('payment_adjustments')
        .delete()
        .in('payment_id', payments?.map(p => p.id) || []);

    if (adjDeleteError) {
        console.error('Error deleting payment adjustments:', adjDeleteError);
    } else {
        console.log('\n✅ Deleted payment adjustments');
    }

    // 6. Delete extra terms
    for (const term of termsToDelete) {
        const { error } = await supabase
            .from('terms')
            .delete()
            .eq('id', term.id);

        if (error) {
            console.error(`Error deleting term ${term.id}:`, error);
        } else {
            console.log(`✅ Deleted term v${term.version}: ${term.id.slice(0, 8)}...`);
        }
    }

    // 7. Reset v1 term to have no effective_until
    const { error: updateTermError } = await supabase
        .from('terms')
        .update({
            effective_until: null,
            effective_from: '2021-07-01'  // Original effective_from
        })
        .eq('id', termV1.id);

    if (updateTermError) {
        console.error('Error resetting v1 term:', updateTermError);
    } else {
        console.log('\n✅ Reset v1 term effective_from to 2021-07-01 and cleared effective_until');
    }

    console.log('\n✨ Cleanup complete!\n');

    // Verify final state
    const { data: finalPayments } = await supabase
        .from('payments')
        .select('id, period_date, term_id')
        .eq('commitment_id', commitmentId)
        .order('period_date', { ascending: true });

    console.log('Final payments state:');
    for (const p of finalPayments || []) {
        console.log(`  ${p.period_date} -> term ${p.term_id.slice(0, 8)}...`);
    }
}

cleanupDividendo().catch(console.error);
