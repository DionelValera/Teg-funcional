// src/pages/api/register.js
import { initializeDatabase } from '../../db/db.js'; // Importa la función centralizada
import bcrypt from 'bcrypt';
import pkg from 'jsonwebtoken';
const { sign } = pkg;

// Configura una clave secreta para tu token.
const JWT_SECRET = '0402Dionel.*'; 

export async function POST({ request }) {
  try {
    const db = await initializeDatabase(); // Llama a la función de inicialización centralizada

    // Obtiene TODOS los datos del formulario, incluyendo los nuevos
    const {
      firstName,
      lastName,
      username,
      companyName, // Puede ser undefined o vacío si no se envía
      email,
      password,
      termsAccepted // Booleano del checkbox
    } = await request.json();

    // Validación básica en el servidor para los nuevos campos requeridos
    if (!firstName || !lastName || !username || !email || !password) {
      return new Response(JSON.stringify({ message: 'Todos los campos requeridos deben ser completados.' }), {
        status: 400, // Bad Request
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (password.length < 6) {
        return new Response(JSON.stringify({ message: 'La contraseña debe tener al menos 6 caracteres.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    if (!termsAccepted) {
        return new Response(JSON.stringify({ message: 'Debes aceptar los Términos de Uso y Política de Privacidad.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Hashear la contraseña de forma segura
    const hashedPassword = await bcrypt.hash(password, 10);
    // Obtener la fecha actual
    const createdAt = new Date().toISOString();
    // Convertir booleano a entero para la DB
    const termsAcceptedInt = termsAccepted ? 1 : 0;

    let userId;
    let responseMessage = 'Usuario registrado exitosamente.';

    try {
      // Insertar el nuevo usuario en la base de datos (sin company_name en la tabla users)
      const result = await db.run(
        `INSERT INTO users (
          email,
          password,
          first_name,
          last_name,
          username,
          terms_accepted,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        email,
        hashedPassword,
        firstName,
        lastName,
        username,
        termsAcceptedInt,
        createdAt
      );
      userId = result.lastID;

      // --- Lógica para manejar la empresa ---
      if (companyName && companyName.trim() !== '') {
        const existingCompany = await db.get('SELECT id FROM companies WHERE company_name = ?', companyName.trim());

        if (!existingCompany) {
          // Si la empresa NO existe, la creamos y asignamos al usuario como owner
          const companyResult = await db.run(
            `INSERT INTO companies (company_name, owner_user_id, created_at) VALUES (?, ?, ?)`,
            companyName.trim(),
            userId,
            createdAt
          );
          const companyId = companyResult.lastID;

          // Asignar el rol de 'owner' al usuario en esta nueva empresa
          await db.run(
            `INSERT INTO user_company_roles (user_id, company_id, role, created_at) VALUES (?, ?, ?, ?)`,
            userId,
            companyId,
            'owner',
            createdAt
          );
          responseMessage = `Usuario registrado y nueva empresa "${companyName.trim()}" creada exitosamente.`;
        } else {
          // Si la empresa YA existe, el usuario se registra pero no se asocia automáticamente.
          // Se le informa que puede solicitar acceso después.
          responseMessage = `Usuario registrado. La empresa "${companyName.trim()}" ya existe. Puedes solicitar unirte a ella desde tu dashboard.`;
        }
      } else {
        // Si no se proporcionó nombre de empresa
        responseMessage = 'Usuario registrado exitosamente. Puedes crear o unirte a una empresa desde tu dashboard.';
      }

      return new Response(JSON.stringify({ message: responseMessage, userId: userId }), {
        status: 201, // Created
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (dbError) {
      // Manejar el caso de que el email o username ya existan (UNIQUE constraint)
      if (dbError.message.includes('SQLITE_CONSTRAINT: UNIQUE constraint failed')) {
        let errorMessage = 'Este correo electrónico ya está registrado.';
        if (dbError.message.includes('users.username')) {
            errorMessage = 'Este nombre de usuario ya está en uso.';
        }
        return new Response(JSON.stringify({ message: errorMessage }), {
          status: 409, // Conflict
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Otros errores de la DB
      console.error('Error al insertar usuario en la DB:', dbError);
      return new Response(JSON.stringify({ message: 'Error al registrar el usuario en la base de datos.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error general en el endpoint de registro:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor durante el registro.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}