// src/pages/api/reports/download-pdf.js
// This endpoint generates a PDF financial report with charts.

import { initializeDatabase } from '../../../db/db.js';
import PdfPrinter from 'pdfmake';
import fs from 'fs'; // Node.js file system module (for fonts)
import path from 'path'; // Node.js path module
import pkg from 'jsonwebtoken'; // Import jsonwebtoken for auth check
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; // IMPORTANT: Use a secure environment variable!

// Define fonts for pdfmake
const fonts = {
    Roboto: {
        normal: path.resolve('./public/fonts/Roboto-Regular.ttf'),
        bold: path.resolve('./public/fonts/Roboto-Medium.ttf'),
        italics: path.resolve('./public/fonts/Roboto-Italic.ttf'),
        bolditalics: path.resolve('./public/fonts/Roboto-MediumItalic.ttf')
    }
};

const printer = new PdfPrinter(fonts);

// Cambiamos el método de GET a POST para recibir el cuerpo de la solicitud
export async function POST({ request, cookies }) { // Cambiado de GET a POST
    try {
        const db = await initializeDatabase();

        // 1. Authenticate user using JWT from cookie
        const token = cookies.get('auth_token')?.value;
        if (!token) {
            return new Response(JSON.stringify({ message: 'No autenticado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let decoded;
        try {
            decoded = verify(token, JWT_SECRET);
        } catch (error) {
            console.error('Error al verificar token en download-pdf.js:', error);
            return new Response(JSON.stringify({ message: 'Token inválido o expirado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const userId = decoded.userId;
        if (!userId) {
            return new Response(JSON.stringify({ message: 'ID de usuario no encontrado en el token.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Get companyId from the cookie
        const companyId = cookies.get('active_company_id')?.value;

        // Obtener los datos del cuerpo de la solicitud POST
        const requestBody = await request.json(); // Parsear el cuerpo JSON
        const { startDate, endDate, incomeChartImage, expenseChartImage, netBalanceTrendImage } = requestBody;

        if (!startDate || !endDate || !companyId) {
            return new Response(JSON.stringify({ message: 'Missing startDate, endDate, or active company selection.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const companyIdNum = parseInt(companyId, 10);
        if (isNaN(companyIdNum)) {
            return new Response(JSON.stringify({ message: 'Invalid companyId from cookie.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Verify user has access to this company
        const userHasRoleInCompany = await db.get(
            `SELECT 1 FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId,
            companyIdNum
        );

        if (!userHasRoleInCompany) {
            return new Response(JSON.stringify({ message: 'No tienes permisos para acceder a los reportes de esta empresa.' }), {
                status: 403, // Forbidden
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Fetch company name
        const company = await db.get('SELECT company_name FROM companies WHERE id = ?', companyIdNum);
        const companyName = company ? company.company_name : 'Unknown Company';

        // Fetch all transactions for the given company and date range
        const transactions = await db.all(
            `SELECT type, amount, description, category, transaction_date FROM transactions
            WHERE company_id = ? AND transaction_date BETWEEN ? AND ?
            ORDER BY transaction_date ASC`,
            companyIdNum,
            startDate,
            endDate
        );

        // Calculate Summary (same logic as in summary endpoint)
        let totalIncome = 0;
        let totalExpense = 0;
        const incomeByCategory = {};
        const expenseByCategory = {};
        const balanceTrend = [];
        const dailyBalances = {};

        transactions.forEach(t => {
            const amount = t.amount;
            const category = t.category || 'Sin Categoría'; // Default category if null

            if (t.type === 'ingreso') {
                totalIncome += amount;
                incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
            } else if (t.type === 'gasto') {
                totalExpense += amount;
                expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
            }

            if (!dailyBalances[t.transaction_date]) {
                dailyBalances[t.transaction_date] = 0;
            }
            dailyBalances[t.transaction_date] += (t.type === 'ingreso' ? amount : -amount);
        });

        const netBalance = totalIncome - totalExpense;

        const sortedDates = Object.keys(dailyBalances).sort();
        let runningBalance = 0;
        sortedDates.forEach(date => {
            runningBalance += dailyBalances[date];
            balanceTrend.push({ date: date, balance: runningBalance });
        });

        const sortedExpenseCategories = Object.entries(expenseByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5) // Top 5
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});

        // --- PDF Document Definition ---
        const docDefinition = {
            content: [
                { text: `Reporte Financiero de ${companyName}`, style: 'header' },
                { text: `Periodo: ${startDate} al ${endDate}`, style: 'subheader' },
                { text: '\n' },
                {
                    columns: [
                        { text: `Saldo Neto: ${netBalance.toFixed(2)} VES`, style: 'summary' },
                        { text: `Total Ingresos: ${totalIncome.toFixed(2)} VES`, style: 'summary' },
                        { text: `Total Gastos: ${totalExpense.toFixed(2)} VES`, style: 'summary' }
                    ]
                },
                { text: '\n' },
                { text: 'Transacciones Detalladas', style: 'sectionHeader' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', 'auto', '*', 'auto', 'auto'],
                        body: [
                            ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto'],
                            ...transactions.map(t => [
                                t.transaction_date,
                                t.type === 'ingreso' ? 'Ingreso' : 'Gasto',
                                t.description || '',
                                t.category || 'Sin Categoría',
                                `${t.amount.toFixed(2)} VES`
                            ])
                        ]
                    },
                    layout: {
                        fillColor: function (i, node) {
                            return (i % 2 === 0) ? '#CCCCCC' : null;
                        }
                    }
                },
                { text: '\n' },
                // --- NUEVO: Gráficos ---
                // Solo insertamos la imagen si existe (no es null)
                incomeChartImage ? { text: 'Gráfico de Ingresos por Categoría', style: 'sectionHeader' } : {},
                incomeChartImage ? { image: incomeChartImage, width: 450, alignment: 'center', margin: [0, 10, 0, 10] } : {},

                expenseChartImage ? { text: '\n' } : {},
                expenseChartImage ? { text: 'Gráfico de Gastos por Categoría', style: 'sectionHeader' } : {},
                expenseChartImage ? { image: expenseChartImage, width: 450, alignment: 'center', margin: [0, 10, 0, 10] } : {},

                netBalanceTrendImage ? { text: '\n' } : {},
                netBalanceTrendImage ? { text: 'Gráfico de Evolución del Saldo Neto', style: 'sectionHeader' } : {},
                netBalanceTrendImage ? { image: netBalanceTrendImage, width: 500, alignment: 'center', margin: [0, 10, 0, 10] } : {},
                // --- FIN NUEVO: Gráficos ---

                { text: '\n' },
                { text: 'Ingresos por Categoría', style: 'sectionHeader' },
                {
                    ul: Object.entries(incomeByCategory).map(([cat, val]) => `${cat}: ${val.toFixed(2)} VES`)
                },
                { text: '\n' },
                { text: 'Gastos por Categoría', style: 'sectionHeader' },
                {
                    ul: Object.entries(expenseByCategory).map(([cat, val]) => `${cat}: ${val.toFixed(2)} VES`)
                },
                { text: '\n' },
                { text: 'Top 5 Categorías de Gastos', style: 'sectionHeader' },
                {
                    ul: Object.entries(sortedExpenseCategories).map(([cat, val]) => `${cat}: ${val.toFixed(2)} VES`)
                }
            ],
            styles: {
                header: {
                    fontSize: 22,
                    bold: true,
                    margin: [0, 0, 0, 10]
                },
                subheader: {
                    fontSize: 16,
                    bold: true,
                    margin: [0, 10, 0, 5]
                },
                summary: {
                    fontSize: 14,
                    margin: [0, 5, 0, 5]
                },
                sectionHeader: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 15, 0, 10],
                    decoration: 'underline'
                },
                tableHeader: {
                    bold: true,
                    fontSize: 13,
                    color: 'black'
                }
            },
            defaultStyle: {
                font: 'Roboto'
            }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        const chunks = [];
        pdfDoc.on('data', chunk => chunks.push(chunk));

        return new Promise(resolve => {
            pdfDoc.on('end', () => {
                const result = Buffer.concat(chunks);
                resolve(new Response(result, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="reporte-financiero-con-graficos-${startDate}-a-${endDate}.pdf"`,
                    },
                }));
            });
            pdfDoc.end();
        });

    } catch (error) {
        console.error('Error in /api/reports/download-pdf:', error);
        return new Response(JSON.stringify({ message: 'Internal server error generating PDF report.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
