import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Cancha extends Model {}

Cancha.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // No debería haber dos canchas con el mismo nombre
    comment: 'Ej: Cancha 1 (Central)',
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Cemento',
    comment: 'Ej: Cemento, Césped Sintético, Blindex',
  }
}, {
  sequelize,
  modelName: 'Cancha',
  timestamps: false, // No necesitamos createdAt/updatedAt para las canchas
});

export default Cancha;