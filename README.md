# Contabilito - Notas Completas del Proyecto

Este documento sirve como un registro central de la visión del proyecto, decisiones clave, estado actual y próximos pasos para la aplicación Contabilito.

---

## 1. Visión General del Proyecto

* **Objetivo Principal:** Crear una aplicación web contable personal/empresarial con gestión de usuarios, empresas y colaboración.
* **Tecnologías Clave:** Astro (SSR/SSG), SQLite (base de datos), Node.js (endpoints API), Tailwind CSS (estilos), JavaScript (frontend interactivo), Gemini API (sugerencias inteligentes).
* **Clave Secreta JWT:** `0402Dionel.*` (¡Solo para desarrollo! Cambiar en producción).

---

## 2. Estado Actual del Desarrollo (Fecha: 19 de Julio de 2025)

### **2.1. Autenticación y Gestión de Sesión**

* **Registro de Usuarios:** Formulario completo con nombre, apellido, username, email, nombre de empresa (opcional), contraseña (con mostrar/ocultar), y aceptación de términos.
* **Inicio de Sesión:** Formulario que permite iniciar sesión con email o nombre de usuario, con opción "Recordarme" (persistencia de sesión).
* **Cierre de Sesión:** Funcionalidad para invalidar la sesión.
* **Recuperación de Contraseña:**
    * Página de solicitud de restablecimiento (introduce email).
    * Endpoint que genera un token, lo guarda en DB y simula el envío de un email con el enlace de restablecimiento.
    * **PENDIENTE:** Página y endpoint para restablecer la contraseña con el token.
    * **PENDIENTE:** Integración real de envío de emails.

### **2.2. Diseño de UI y Componentes**

* **Página de Inicio (`index.astro`):** Diseño de dos columnas (texto/botones + imagen), fondo degradado, tarjeta central.
* **Header Global (`Header.astro`):**
    * Fijo en la parte superior, con transparencia (`bg-blue-700/80`) y efecto `backdrop-blur-md`.
    * Se oculta al hacer scroll hacia abajo y reaparece al scroll hacia arriba.
    * Logo personalizado (asumido) y navegación dinámica (login/registro vs. dashboard/cerrar sesión).
    * Estilos coherentes con la paleta azul/blanco/negro.
* **Formularios de Autenticación:**
    * `LoginForm.astro` y `RegisterForm.astro` con diseño compacto y horizontal.
    * Campos de entrada con estilos uniformes y efecto de enfoque.
    * Botones de acción con degradados y efectos hover/scale.
    * Funcionalidad de "Mostrar/Ocultar" contraseña implementada y accesible.
* **Página de Recuperación de Contraseña (`forgot-password.astro`):** Formulario simple para introducir el email.
* **Dashboard (`dashboard.astro`):**
    * Página protegida (redirecciona si no hay sesión).
    * **Integración Gemini:** Sección para obtener sugerencias de categoría/descripción de transacciones usando IA.
    * **PENDIENTE:** Rediseño completo para la gestión de empresas y transacciones por empresa.

### **2.3. Base de Datos (SQLite)**

* **Estructura Actualizada:** El esquema de la base de datos ha sido modificado para soportar la nueva visión de empresas y roles.
    * **¡IMPORTANTE!** Si no se ha hecho, el archivo `src/db/ingreso.db` debe ser eliminado para que se recree con el esquema más reciente.

### **2.4. Integración de IA (Gemini API)**

* Endpoint `POST /api/gemini/suggest-category` para obtener sugerencias de categoría y descripción de transacciones.
* Integrado en `dashboard.astro` con un campo de texto y botón.

---

## 3. Código Fuente Actual

### **3.1. `src/components/Header.astro`**

```html
---
// src/components/Header.astro
import pkg from 'jsonwebtoken';
const { verify } = pkg;
import '../styles/global.css'; // Asegúrate de que esto esté presente

// La misma clave secreta que usas en login.js y dashboard.astro
const JWT_SECRET = '0402Dionel.*'; // ¡DEBE SER LA MISMA!

let isLoggedIn = false;
let username = '';

try {
  const token = Astro.cookies.get('auth_token')?.value;

  if (token) {
    const decoded = verify(token, JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null) {
      isLoggedIn = true;
      username = decoded.username || '';
    } else {
      console.log("Token decodificado en Header no es un objeto:", decoded);
      isLoggedIn = false;
    }
  }
} catch (error: unknown) {
  if (error instanceof Error) {
    console.log("No autenticado o token inválido en Header:", error.message);
  } else {
    console.log("No autenticado o token inválido en Header:", error);
  }
  isLoggedIn = false;
}
---

<header id="mainHeader" class="fixed top-0 left-0 right-0 bg-blue-700/80 backdrop-blur-md text-white shadow-md py-4 px-6 sm:px-10 flex justify-between items-center z-50 transform translate-y-0 transition-transform duration-300 ease-in-out">
    <div class="flex items-center">
        <a href="/" class="text-2xl font-bold flex items-center group">
            Contabilito
        </a>
    </div>

    <nav class="hidden md:flex items-center space-x-6 text-lg font-medium">
        {isLoggedIn ? (
            <>
                <a href="/dashboard" class="hover:text-blue-200 transition-colors duration-200">Dashboard</a>
                <span class="text-blue-100 mr-2">Hola, {username || 'usuario'}!</span>
                <button id="logoutButtonHeader" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-700 focus:ring-blue-500 transition duration-300 cursor-pointer">Cerrar Sesión</button>
            </>
        ) : (
            <>
                <a href="/login" class="text-white hover:text-blue-200 transition-colors duration-200">Iniciar Sesión</a>
                <a href="/register" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-700 focus:ring-blue-500 transition duration-300">Regístrate</a>
            </>
        )}
    </nav>

    <div class="md:hidden">
        <button id="mobileMenuButton" class="text-white hover:text-blue-200 focus:outline-none">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
    </div>
</header>

<script is:inline>
  // Script para el botón de cerrar sesión
  const logoutButtonHeader = document.getElementById('logoutButtonHeader');
  if (logoutButtonHeader) {
    logoutButtonHeader.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          window.location.href = '/login';
        } else {
          console.error('Error al cerrar sesión desde el header:', await response.json());
          alert('Hubo un problema al cerrar sesión. Intenta de nuevo.');
        }
      } catch (error) {
        console.error('Error de red al cerrar sesión desde el header:', error);
        alert('No se pudo conectar al servidor para cerrar sesión.');
      }
    });
  }

  // SCRIPT PARA OCULTAR/MOSTRAR HEADER EN SCROLL
  const mainHeader = document.getElementById('mainHeader');
  let lastScrollY = window.scrollY;
  const headerHeight = mainHeader ? mainHeader.offsetHeight : 72; // Altura del header, usa 72px como fallback

  window.addEventListener('scroll', () => {
    // Si el scroll está cerca de la parte superior, siempre mostrar el header
    if (window.scrollY < 100) { // Muestra el header si estamos en los primeros 100px de scroll
      mainHeader?.classList.remove('-translate-y-full');
      mainHeader?.classList.add('translate-y-0');
    }
    // Si hacemos scroll hacia abajo (la posición actual es mayor que la anterior)
    else if (window.scrollY > lastScrollY && window.scrollY > headerHeight) {
      // Ocultar el header
      mainHeader?.classList.remove('translate-y-0');
      mainHeader?.classList.add('-translate-y-full');
    }
    // Si hacemos scroll hacia arriba (la posición actual es menor que la anterior)
    else if (window.scrollY < lastScrollY) {
      // Mostrar el header
      mainHeader?.classList.remove('-translate-y-full');
      mainHeader?.classList.add('translate-y-0');
    }

    lastScrollY = window.scrollY;
  });
</script>