// src/pages/api/companies/my-companies.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; // MISMA CLAVE SECRETA

export async function GET({ request, cookies }) {
    try {
        const db = await initializeDatabase();

        // 1. Verificar autenticación del usuario
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

        // 2. Obtener las empresas y roles del usuario
        const userCompanies = await db.all(
            `SELECT
                c.id AS company_id,
                c.company_name,
                ucr.role
             FROM
                companies c
             JOIN
                user_company_roles ucr ON c.id = ucr.company_id
             WHERE
                ucr.user_id = ?`,
            userId
        );

        return new Response(JSON.stringify({ companies: userCompanies }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error en el endpoint de listar empresas del usuario:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al obtener las empresas.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}