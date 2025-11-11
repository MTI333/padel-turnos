import Cancha from './Cancha.js';
import Horario from './Horario.js';
import Turno from './Turno.js';

// --- Definición de Relaciones (Foreign Keys) ---

// 1. Relación Cancha <-> Horario (Uno a Muchos)
Cancha.hasMany(Horario, {
  foreignKey: {
    name: 'cancha_id',
    allowNull: false
  },
  onDelete: 'CASCADE' 
});
Horario.belongsTo(Cancha, {
  foreignKey: 'cancha_id'
});


// 2. Relación Cancha <-> Turno (Uno a Muchos)
Cancha.hasMany(Turno, {
  foreignKey: {
    name: 'cancha_id',
    allowNull: false
  },
  onDelete: 'CASCADE'
});
Turno.belongsTo(Cancha, {
  foreignKey: 'cancha_id'
});


// --- ¡ESTA ES LA LÍNEA CLAVE QUE PROBABLEMENTE FALTA! ---
// Exportamos todos los modelos para usarlos en la API
export { Cancha, Horario, Turno };