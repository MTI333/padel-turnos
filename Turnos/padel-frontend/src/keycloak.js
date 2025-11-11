import Keycloak from 'keycloak-js';

// Esta es la configuración para el CLIENTE 'padel-frontend'
// que creamos en el panel de Keycloak.
const keycloakConfig = {
  url: 'http://localhost:9090',     // URL de tu servidor Keycloak
  realm: 'padel-club',              // Nombre de tu Realm
  clientId: 'padel-frontend',       // Client ID de tu app React
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;