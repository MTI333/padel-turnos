import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Calculamos las rutas __dirname y __filename ---
// Esto es necesario en ES Modules (el "type": "module" que pusimos)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Creamos la instancia de Sequelize ---
const sequelize = new Sequelize({
  // Usamos el dialecto 'sqlite'
  dialect: 'sqlite',
  
  // Especificamos la ruta al archivo de la base de datos.
  // path.join() une las rutas de forma segura.
  // '__dirname' es el directorio actual (donde está database.js)
  // '..' sube un nivel (a /padel-backend)
  // 'padel-club.sqlite' es el nombre de nuestro archivo de base de datos.
  storage: path.join(__dirname, '..', 'padel-club.sqlite'),
  
  // (Opcional) Desactiva los logs de SQL en la consola.
  // Recomiendo activarlo (dejarlo en 'true' o borrar la línea) 
  // si quieres ver el SQL exacto que Sequelize ejecuta.
  logging: false, 
});

// Exportamos la instancia para usarla en otros archivos
export default sequelize;