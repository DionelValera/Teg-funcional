// src/pages/api/reports/download-csv.js
// This endpoint generates a CSV financial report.

import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken'; // Import jsonwebtoken for auth check
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; // IMPORTANT: Use a secure environment variable!

export async function GET({ url, cookies }) {
    try {
        const db = await initializeDatabase();

        // 1. Authenticate user using JWT from cookie (similar to summary.js)
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
            console.error('Error al verificar token en download-csv.js:', error);
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

        // 2. Get companyId from the cookie (¡CRUCIAL: Ahora se obtiene de la cookie!)
        const companyId = cookies.get('active_company_id')?.value;

        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        if (!startDate || !endDate || !companyId) { // companyId es ahora de la cookie
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

        // 3. Verify user has access to this company (similar to summary.js)
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

        // Fetch transactions for the given company and date range
        const transactions = await db.all(
            `SELECT transaction_date, type, amount, description, category FROM transactions
            WHERE company_id = ? AND transaction_date BETWEEN ? AND ?
            ORDER BY transaction_date ASC`,
            companyIdNum,
            startDate,
            endDate
        );

        // CSV Headers
        const headers = ['Fecha', 'Tipo', 'Monto', 'Descripción', 'Categoría'];

        // CSV Rows
        const csvRows = [
            headers.join(','), // Add headers
            ...transactions.map(t =>
            [
                `"${t.transaction_date}"`,
                `"${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}"`,
                t.amount.toFixed(2), // Format amount
                                `"${(t.description || '').replace(/"/g, '""')}"`, // Escape double quotes
                                `"${(t.category || 'Sin Categoría').replace(/"/g, '""')}"`
            ].join(',')
            )
        ];

        const csvContent = csvRows.join('\n');

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="reporte-transacciones-${startDate}-a-${endDate}.csv"`,
            },
        });

    } catch (error) {
        console.error('Error in /api/reports/download-csv:', error);
        return new Response(JSON.stringify({ message: 'Internal server error generating CSV report.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
