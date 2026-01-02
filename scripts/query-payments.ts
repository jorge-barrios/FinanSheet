/**
 * Temporary script to query payments for a specific commitment
 * Run with: npx tsx scripts/query-payments.ts
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

async function queryPayments() {
    const commitmentId = 'a7a9d679-959d-4152-911b-6c0d0c2ae769';

    console.log(`\n📋 Buscando pagos para commitment ID: ${commitmentId}\n`);

    // First list all commitments to debug RLS
    console.log('🔍 Listando todos los commitments visibles...');
    const { data: allCommitments, error: listError } = await supabase
        .from('commitments')
        .select('id, name, flow_type')
        .limit(20);

    if (listError) {
        console.error('Error listing commitments:', listError);
    } else {
        console.log(`   Total visible: ${allCommitments?.length || 0}`);
        if (allCommitments && allCommitments.length > 0) {
            console.log('   Primeros commitments:');
            for (const c of allCommitments.slice(0, 5)) {
                console.log(`     - ${c.name} (${c.id.slice(0, 8)}...)`);
            }
        }
    }

    // Get commitment info
    const { data: commitment, error: commitmentError } = await supabase
        .from('commitments')
        .select('id, name, flow_type')
        .eq('id', commitmentId)
        .maybeSingle();

    if (commitmentError) {
        console.error('Error finding commitment:', commitmentError);
        return;
    }

    if (!commitment) {
        console.log('❌ Commitment no encontrado (puede estar protegido por RLS)');
        console.log('   Intentando búsqueda por nombre...');

        const { data: byName } = await supabase
            .from('commitments')
            .select('id, name, flow_type')
            .ilike('name', '%dividendo%');

        if (byName && byName.length > 0) {
            console.log(`   ✅ Encontrado por nombre: ${byName[0].name}`);
        } else {
            console.log('   ❌ No encontrado por nombre tampoco');
        }
        return;
    }

    console.log(`✅ Compromiso: ${commitment.name} (${commitment.flow_type})`);
    console.log(`   ID: ${commitment.id}\n`);

    // Get payments with term info
    const { data: payments, error: paymentError } = await supabase
        .from('payments')
        .select(`
            id,
            period_date,
            payment_date,
            amount_original,
            currency,
            amount_in_base,
            notes,
            term:terms(
                id,
                version,
                effective_from,
                effective_until,
                amount,
                currency
            )
        `)
        .eq('commitment_id', commitmentId)
        .order('period_date', { ascending: true });

    if (paymentError) {
        console.error('Error fetching payments:', paymentError);
        return;
    }

    if (!payments || payments.length === 0) {
        console.log('📭 No hay pagos registrados para este compromiso');
        return;
    }

    console.log(`💰 ${payments.length} pagos encontrados:\n`);
    console.log('─'.repeat(100));
    console.log(
        'Período'.padEnd(12) +
        'Fecha Pago'.padEnd(14) +
        'Monto Original'.padEnd(20) +
        'Monto Base (CLP)'.padEnd(18) +
        'Term Ver.'.padEnd(12) +
        'Notas'
    );
    console.log('─'.repeat(100));

    for (const payment of payments) {
        const term = payment.term as any;
        console.log(
            payment.period_date.padEnd(12) +
            (payment.payment_date || 'N/A').padEnd(14) +
            `${payment.amount_original} ${payment.currency}`.padEnd(20) +
            `$${payment.amount_in_base.toLocaleString('es-CL')}`.padEnd(18) +
            `v${term?.version || '?'}`.padEnd(12) +
            (payment.notes || '')
        );
    }

    console.log('─'.repeat(100));

    // Summary
    const totalBase = payments.reduce((sum, p) => sum + (p.amount_in_base || 0), 0);
    console.log(`\n📊 Total pagado: $${totalBase.toLocaleString('es-CL')} CLP`);

    // Get payment adjustments if any
    const paymentIds = payments.map(p => p.id);
    const { data: adjustments, error: adjError } = await supabase
        .from('payment_adjustments')
        .select('*')
        .in('payment_id', paymentIds)
        .order('adjusted_at', { ascending: false });

    if (!adjError && adjustments && adjustments.length > 0) {
        console.log(`\n🔄 ${adjustments.length} ajustes de período encontrados:`);
        for (const adj of adjustments) {
            console.log(`   - Pago movido de ${adj.original_period_date} → ${adj.new_period_date} (${adj.reason})`);
        }
    }
}

queryPayments().catch(console.error);
