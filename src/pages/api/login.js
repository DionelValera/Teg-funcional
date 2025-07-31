// src/pages/api/login.js
import { initializeDatabase } from '../../db/db.js'; // Importa la función centralizada
import bcrypt from 'bcrypt';
import pkg from 'jsonwebtoken';
const { sign, verify } = pkg;

// Configura una clave secreta para tu token.
const JWT_SECRET = '0402Dionel.*'; 

// Handler para solicitudes POST (cuando se envía el formulario)
export async function POST({ request, cookies }) {
  try {
    const db = await initializeDatabase(); // Ahora llama a la función importada

    // Recibe 'email' (que puede ser email o username), 'password' y 'rememberMe'
    const { email, password, rememberMe } = await request.json(); 

    // Buscar por 'email' O 'username'
    const user = await db.get('SELECT * FROM users WHERE email = ? OR username = ?', email, email);

    if (!user) {
      return new Response(JSON.stringify({ message: 'Credenciales inválidas' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return new Response(JSON.stringify({ message: 'Credenciales inválidas' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // --- Lógica para crear un token JWT y establecer una cookie ---
    // Duración de la cookie: 7 días si 'recordarme', 1 hora si no
    const expiresInSeconds = rememberMe ? (60 * 60 * 24 * 7) : (60 * 60 * 1); 
    const token = sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: expiresInSeconds });

    // Establece la cookie de forma segura con la duración ajustada
    cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresInSeconds, // Usa la duración calculada
      path: '/',
      sameSite: 'Lax',
    });
    // --- Fin de la lógica de token y cookie ---

    // --- NUEVO: Lógica para establecer la empresa activa por defecto ---
    const userCompanies = await db.all(
        `SELECT c.id FROM companies c JOIN user_company_roles ucr ON c.id = ucr.company_id WHERE ucr.user_id = ?`,
        user.id
    );

    if (userCompanies.length > 0) {
        // Establecer la primera empresa del usuario como la activa por defecto
        cookies.set('active_company_id', userCompanies[0].id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30, // 30 días de duración para la empresa activa
            path: '/',
            sameSite: 'Lax',
        });
    }
    // --- FIN NUEVO ---

    return new Response(JSON.stringify({ message: 'Inicio de sesión exitoso', user: { id: user.id, username: user.username } }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error en el endpoint de login:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}