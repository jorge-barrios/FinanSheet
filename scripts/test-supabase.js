import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQueries() {
    try {
        // 1. Insert common categories
        console.log('\n1. Inserting common categories...');
        const categories = [
            { name: 'Housing' },
            { name: 'Transport' },
            { name: 'Food' },
            { name: 'Utilities' },
            { name: 'Health' },
            { name: 'Education' },
            { name: 'Entertainment' },
            { name: 'Shopping' },
            { name: 'Savings' }
        ];

        const { data: insertedCategories, error: categoryError } = await supabase
            .from('categories')
            .insert(categories)
            .select();

        if (categoryError) throw categoryError;
        console.log('Inserted categories:', insertedCategories);

        // 2. Insert sample expenses
        console.log('\n2. Inserting sample expenses...');
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // Current date
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // Months are 0-11 in JS
        const currentYear = now.getFullYear();

        const expenses = [
            {
                id: generateUUID(),
                name: 'Rent',
                category: 'Housing',
                totalAmount: 1000,
                type: 'Fixed',
                startDate: { month: currentMonth, year: currentYear },
                installments: 1,
                paymentFrequency: 'MONTHLY',
                isImportant: true,
                dueDate: 5
            },
            {
                id: generateUUID(),
                name: 'Electricity Bill',
                category: 'Utilities',
                totalAmount: 150,
                type: 'Fixed',
                startDate: { month: currentMonth, year: currentYear },
                installments: 1,
                paymentFrequency: 'MONTHLY',
                isImportant: true,
                dueDate: 10
            },
            {
                id: generateUUID(),
                name: 'Groceries',
                category: 'Food',
                totalAmount: 300,
                type: 'Variable',
                startDate: { month: currentMonth, year: currentYear },
                installments: 1,
                paymentFrequency: 'MONTHLY',
                isImportant: false,
                dueDate: 15
            },
            {
                id: generateUUID(),
                name: 'Internet',
                category: 'Utilities',
                totalAmount: 70,
                type: 'Fixed',
                startDate: { month: currentMonth, year: currentYear },
                installments: 1,
                paymentFrequency: 'MONTHLY',
                isImportant: true,
                dueDate: 20
            },
            {
                id: generateUUID(),
                name: 'Mobile Phone',
                category: 'Utilities',
                totalAmount: 50,
                type: 'Fixed',
                startDate: { month: currentMonth, year: currentYear },
                installments: 1,
                paymentFrequency: 'MONTHLY',
                isImportant: true,
                dueDate: 25
            }
        ];

        const { data: insertedExpenses, error: expenseError } = await supabase
            .from('expenses')
            .insert(expenses)
            .select();

        if (expenseError) throw expenseError;
        console.log('Inserted expenses:', insertedExpenses);

        // 3. Get all expenses
        console.log('\n3. Getting all expenses...');
        const { data: allExpenses, error: getAllError } = await supabase
            .from('expenses')
            .select('*');

        if (getAllError) throw getAllError;
        console.log('All expenses:', allExpenses);

        // 4. Get all categories
        console.log('\n4. Getting all categories...');
        const { data: allCategories, error: getAllCategoriesError } = await supabase
            .from('categories')
            .select('*');

        if (getAllCategoriesError) throw getAllCategoriesError;
        console.log('All categories:', allCategories);

        console.log('\nSample data inserted successfully!');
    } catch (error) {
        console.error('Error in test queries:', error);
        process.exit(1);
    }
}

async function main() {
    try {
        console.log('Starting Supabase SQL test queries...');
        await testQueries();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
