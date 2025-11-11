import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Horario extends Model {}

Horario.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  // La FK se definirá en las relaciones
  dia_semana: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '0=Domingo, 1=Lunes, 2=Martes, ... 6=Sábado',
  },
  hora_apertura: {
    type: DataTypes.STRING, // Usamos String (ej: "09:00") para simplificar
    allowNull: false,
  },
  hora_cierre: {
    type: DataTypes.STRING, // ej: "22:00"
    allowNull: false,
  },
  duracion_turno_min: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    comment: 'Duración del turno en minutos (ej: 60 o 90)',
  }
}, {
  sequelize,
  modelName: 'Horario',
  timestamps: false,
});

export default Horario;