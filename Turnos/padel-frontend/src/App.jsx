import { useState, useEffect } from 'react';
import axios from 'axios';
import { useKeycloak } from '@react-keycloak/web'; // <-- ¡NUEVO HOOK!

const API_URL = 'http://localhost:8080/api';

function App() {
  // --- ¡NUEVO! Obtenemos el estado de Keycloak ---
  const { keycloak, initialized } = useKeycloak();
  // 'keycloak' es el objeto cliente (tiene .token, .login(), .logout(), etc.)
  // 'initialized' nos dice si Keycloak ya terminó de cargar.

  // --- Estados (igual que antes) ---
  const [canchas, setCanchas] = useState([]);
  const [error, setError] = useState(null);
  
  // --- ¡NUEVO! Estado para turnos protegidos ---
  const [misTurnos, setMisTurnos] = useState([]);
  const [turnosError, setTurnosError] = useState(null);

  // --- Configuración de Axios (¡MUY IMPORTANTE!) ---
  // Creamos una instancia de Axios que usará el token de Keycloak
  // en CADA petición que hagamos.
  const apiClient = axios.create({
    baseURL: API_URL,
  });

  apiClient.interceptors.request.use((config) => {
    // Si estamos logueados, adjuntamos el token al Header 'Authorization'
    if (keycloak.authenticated) {
      config.headers.Authorization = `Bearer ${keycloak.token}`;
    }
    return config;
  }, (error) => {
    return Promise.reject(error);
  });

  // --- Carga de Canchas (Ruta Pública) ---
  const fetchCanchas = async () => {
    try {
      // Usamos 'apiClient' (nuestra instancia de Axios)
      const response = await apiClient.get('/canchas');
      setCanchas(response.data);
    } catch (err) {
      console.error("Error al cargar canchas:", err);
      setError("No se pudieron cargar las canchas.");
    }
  };

  // --- ¡NUEVO! Carga de Mis Turnos (Ruta Protegida) ---
  const fetchMisTurnos = async () => {
    // Solo intentamos cargar los turnos si el usuario está logueado
    if (keycloak.authenticated) {
      try {
        const response = await apiClient.get('/turnos/mis-turnos');
        setMisTurnos(response.data);
        setTurnosError(null); // Limpiamos errores previos
      } catch (err) {
        console.error("Error al cargar mis turnos:", err);
        // Si el backend nos da un 403 (Prohibido) o 401 (No autorizado)
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          setTurnosError("Error de permisos. ¿Tienes el rol 'usuario-club'?");
        } else {
          setTurnosError("No se pudieron cargar tus turnos.");
        }
      }
    }
  };
  // (Añade esta función cerca de 'fetchMisTurnos')
const handleCrearCanchaPrueba = async () => {
  try {
    const nuevaCancha = {
      nombre: `Cancha de Prueba #${Math.floor(Math.random() * 100)}`,
      tipo: 'Blindex (Prueba)'
    };

    // ¡Llamamos al endpoint POST!
    const response = await apiClient.post('/canchas', nuevaCancha);

    console.log('Cancha creada:', response.data);
    alert('¡Cancha creada! Refrescando lista...');

    // Volvemos a cargar las canchas para ver la nueva
    fetchCanchas();

  } catch (error) {
    console.error("Error al crear cancha:", error);
    alert(`Error: ${error.response?.data?.message || error.message}`);
  }
};

  // --- useEffect: Cargar datos cuando Keycloak esté listo ---
  useEffect(() => {
    // 'initialized' es true cuando Keycloak terminó de chequear
    // si estábamos logueados (ej. al refrescar la página)
    if (initialized) {
      // Siempre cargamos las canchas (son públicas)
      fetchCanchas();
      
      // Solo cargamos los turnos si estamos logueados
      if (keycloak.authenticated) {
        fetchMisTurnos();
      }
    }
  }, [initialized, keycloak.authenticated]); // Se re-ejecuta si cambia el estado de login

  // --- Renderizado ---

  // Mientras Keycloak se inicializa, mostramos un 'Cargando...'
  if (!initialized) {
    return <div>Cargando Keycloak...</div>;
  }

  return (
    <div className="App">
      <header>
        <h1>Pádel-Club Manager</h1>
        <div className="auth-buttons">
          {/* Si NO está logueado, muestra botón de Login.
            Si ESTÁ logueado, muestra info y botón de Logout.
          */}
          {!keycloak.authenticated ? (
          <button type="button" onClick={() => keycloak.login()}>
              Iniciar Sesión
          </button>
            ) : (
            <div>
              <span>Hola, {keycloak.tokenParsed?.preferred_username ?? 'usuario'} | </span>
              <button type="button" onClick={() => keycloak.logout()}>
                    Cerrar Sesión
              </button>

    {/* --- AÑADE ESTE BOTÓN --- */}
              <button type="button" onClick={() => {console.log("TOKEN ACTUAL:", keycloak.token);
                  navigator.clipboard.writeText(keycloak.token);
                  alert("Token copiado al portapapeles. Pégalo en https://jwt.io/");
                  }}
                    style={{ backgroundColor: 'blue', color: 'white' }}
                        >
                    Copiar Token (Debug)
              </button>
    {/* --- FIN DEL BOTÓN --- */}

            </div>
          )}
        </div>
      </header>

      <main>
        {/* --- Sección Pública --- */}
        <section>
          <h2>Nuestras Canchas (Público)</h2>
          {/* ... (después de <h2>Nuestras Canchas (Público)</h2>) ... */}

{/* ¡BOTÓN DE PRUEBA DE ADMIN! */}
        {keycloak.authenticated && (
            <button onClick={handleCrearCanchaPrueba} style={{ backgroundColor: 'orange', color: 'black' }}>
              (ADMIN) Crear Cancha de Prueba
            </button>
      )}


          {error && <div className="error-box">{error}</div>}
          {canchas.length === 0 && !error ? (
            <p>No hay canchas cargadas.</p>
          ) : (
            <ul>

              {canchas.map((cancha) => (
                <li key={cancha.id}>{cancha.nombre} ({cancha.tipo})</li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Sección Privada --- */}
        {/* Solo mostramos esta sección si el usuario está logueado */}
        {keycloak.authenticated && (
          <section>
            <h2>Mis Turnos (Privado)</h2>
            <button onClick={fetchMisTurnos}>Refrescar mis turnos</button>
            
            {turnosError && <div className="error-box">{turnosError}</div>}
            
            {misTurnos.length === 0 && !turnosError ? (
              <p>No tienes turnos reservados.</p>
            ) : (
              <ul>
                {misTurnos.map((turno) => (
                  <li key={turno.id}>Turno {turno.id} en Cancha {turno.canchaId}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;