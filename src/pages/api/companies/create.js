// src/pages/api/companies/create.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; // Asegúrate de que esta clave sea la misma que usas en otros lugares

export async function POST({ request, cookies }) {
    console.log('API: /companies/create - Solicitud recibida.');
    try {
        const db = await initializeDatabase();
        console.log('API: DB inicializada.');

        // 1. Verificar autenticación del usuario
        const token = cookies.get('auth_token')?.value;
        if (!token) {
            console.log('API: No autenticado - Token no encontrado.');
            return new Response(JSON.stringify({ message: 'No autenticado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let decoded;
        try {
            decoded = verify(token, JWT_SECRET);
            console.log('API: Token verificado. Decoded userId:', decoded.userId);
        } catch (error) {
            console.error('API: Error al verificar token:', error);
            return new Response(JSON.stringify({ message: 'Token inválido o expirado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const userId = decoded.userId;
        if (!userId) {
            console.log('API: ID de usuario no encontrado en el token.');
            return new Response(JSON.stringify({ message: 'ID de usuario no encontrado en el token.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Obtener el nombre de la empresa del cuerpo de la solicitud
        const { companyName } = await request.json();

        if (!companyName || companyName.trim() === '') {
            console.log('API: Nombre de empresa no proporcionado.');
            return new Response(JSON.stringify({ message: 'El nombre de la empresa es requerido.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const trimmedCompanyName = companyName.trim();
        const createdAt = new Date().toISOString();

        try {
            // 3. Insertar la nueva empresa
            const companyResult = await db.run(
                `INSERT INTO companies (company_name, owner_user_id, created_at) VALUES (?, ?, ?)`,
                trimmedCompanyName,
                userId,
                createdAt
            );
            const newCompanyId = companyResult.lastID;
            console.log(`API: Empresa "${trimmedCompanyName}" creada con ID: ${newCompanyId}`);

            // 4. Asignar el rol de 'owner' al usuario creador en la tabla user_company_roles
            await db.run(
                `INSERT INTO user_company_roles (user_id, company_id, role, created_at) VALUES (?, ?, ?, ?)`,
                userId,
                newCompanyId,
                'owner', // El creador siempre es el 'owner'
                createdAt
            );
            console.log(`API: Rol 'owner' asignado al usuario ${userId} para la empresa ${newCompanyId}`);

            // Opcional: Establecer la nueva empresa como la activa inmediatamente
            cookies.set('active_company_id', newCompanyId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 30, // 30 días
                path: '/',
                sameSite: 'Lax',
            });
            console.log(`API: Empresa ${newCompanyId} establecida como activa.`);


            return new Response(JSON.stringify({ 
                message: `Empresa "${trimmedCompanyName}" creada y seleccionada exitosamente.`, 
                companyId: newCompanyId 
            }), {
                status: 201, // Created
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (dbError) {
            if (dbError.message.includes('SQLITE_CONSTRAINT: UNIQUE constraint failed: companies.company_name')) {
                console.warn(`API: Intento de crear empresa con nombre duplicado: "${trimmedCompanyName}"`);
                return new Response(JSON.stringify({ message: `Ya existe una empresa con el nombre "${trimmedCompanyName}".` }), {
                    status: 409, // Conflict
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            console.error('API: Error de base de datos al crear empresa o asignar rol:', dbError);
            return new Response(JSON.stringify({ message: 'Error al procesar la solicitud de creación de empresa.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

    } catch (error) {
        console.error('API: Error general en el endpoint /companies/create:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
