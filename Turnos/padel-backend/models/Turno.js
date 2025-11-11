import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Turno extends Model {}

Turno.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  // La FK 'cancha_id' se definirá en las relaciones
  
  usuario_id: {
    type: DataTypes.STRING, // Almacenará el UUID que nos da Keycloak
    allowNull: false,
  },
  hora_inicio: {
    type: DataTypes.DATE, // Tipo Timestamp (Fecha y Hora)
    allowNull: false,
  },
  hora_fin: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Confirmado', // ej: Confirmado, Cancelado
  }
}, {
  sequelize,
  modelName: 'Turno',
  // Aquí sí queremos saber cuándo se creó/modificó el turno
  timestamps: true, 
});

export default Turno;