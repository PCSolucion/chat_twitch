/**
 * Lógica principal del Overlay de Chat de Twitch
 * Manejo de conexión, mensajes y visualización
 */

// ============================================
// CACHÉ DE ELEMENTOS DOM
// ============================================
const DOM = {
    username: null,
    number: null,
    message: null,
    container: null,
    teamLogo: null,
    root: null
};

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
let hideTimeout = null;
let audioElement = null;
let twitchClient = null;

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializa el caché de elementos DOM
 */
function initDOMCache() {
    DOM.username = document.getElementById('username');
    DOM.number = document.querySelector('.number');
    DOM.message = document.getElementById('message');
    DOM.container = document.querySelector('.container');
    DOM.teamLogo = document.querySelector('.team-logo');
    DOM.root = document.documentElement;

    if (CONFIG.DEBUG) {
        console.log('DOM cache initialized:', DOM);
    }
}

/**
 * Pre-carga el archivo de audio
 */
function initAudio() {
    try {
        audioElement = new Audio(CONFIG.AUDIO_URL);
        audioElement.preload = 'auto';
        audioElement.volume = CONFIG.AUDIO_VOLUME;

        audioElement.addEventListener('error', (e) => {
            console.error('Error al cargar el audio:', e);
        });

        if (CONFIG.DEBUG) {
            console.log('Audio pre-cargado correctamente');
        }
    } catch (error) {
        console.error('Error al inicializar el audio:', error);
    }
}

/**
 * Inicializa el cliente de Twitch
 */
function initTwitchClient() {
    try {
        twitchClient = new tmi.Client({
            channels: [CONFIG.TWITCH_CHANNEL]
        });

        // Event: Conexión exitosa
        twitchClient.on('connected', (address, port) => {
            console.log(`✅ Conectado a Twitch IRC: ${address}:${port}`);
        });

        // Event: Mensaje recibido
        twitchClient.on('message', (channel, tags, message, self) => {
            if (CONFIG.DEBUG) {
                console.log('Mensaje recibido:', tags['display-name'], message, tags.emotes);
            }

            const username = tags['display-name'] || tags.username;
            mostrarMensaje(username, message, tags.emotes);
        });

        // Event: Desconexión
        twitchClient.on('disconnected', (reason) => {
            console.warn('⚠️ Desconectado de Twitch IRC:', reason);
        });

        // Conectar
        twitchClient.connect().catch((error) => {
            console.error('❌ Error al conectar con Twitch:', error);
        });

    } catch (error) {
        console.error('❌ Error al inicializar el cliente de Twitch:', error);
    }
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Reproduce el sonido de notificación
 */
function playNotificationSound() {
    if (!audioElement) return;

    try {
        audioElement.currentTime = 0;
        audioElement.play().catch((error) => {
            if (CONFIG.DEBUG) {
                console.warn('No se pudo reproducir el audio:', error);
            }
        });
    } catch (error) {
        console.error('Error al reproducir audio:', error);
    }
}

/**
 * Obtiene el número de piloto para un usuario
 * @param {string} username - Nombre de usuario (lowercase)
 * @returns {number} Número de piloto
 */
function getUserNumber(username) {
    // Caso especial: Liiukiin
    if (username === CONFIG.SPECIAL_USER.username) {
        return CONFIG.SPECIAL_USER.number;
    }

    // Usuario con número asignado
    if (userNumbers[username]) {
        return userNumbers[username];
    }

    // Número aleatorio
    return Math.floor(
        Math.random() * (CONFIG.MAX_RANDOM_NUMBER - CONFIG.MIN_RANDOM_NUMBER + 1)
    ) + CONFIG.MIN_RANDOM_NUMBER;
}

/**
 * Obtiene el equipo para un usuario
 * @param {string} username - Nombre de usuario (lowercase)
 * @returns {Object} Objeto de equipo
 */
function getUserTeam(username) {
    // Caso especial: Liiukiin
    if (username === CONFIG.SPECIAL_USER.username) {
        return teams[CONFIG.SPECIAL_USER.team];
    }

    // Usuario con equipo asignado
    const teamKey = userTeams[username];
    if (teamKey && teams[teamKey]) {
        return teams[teamKey];
    }

    // Equipo aleatorio
    return getRandomTeam();
}

/**
 * Reemplaza emotes por imágenes
 * @param {string} text - Texto del mensaje
 * @param {Object} emotes - Objeto de emotes de Twitch
 * @returns {string} HTML con emotes reemplazados
 */
function reemplazarEmotes(text, emotes) {
    if (!emotes) {
        return escapeHTML(text);
    }

    try {
        // Convertir texto a array de caracteres
        let splitText = text.split('');
        let emoteReplacements = [];

        // Recopilar todos los reemplazos
        Object.entries(emotes).forEach(([emoteId, positions]) => {
            positions.forEach(pos => {
                const [start, end] = pos.split('-').map(Number);
                emoteReplacements.push({ start, end, id: emoteId });
            });
        });

        // Ordenar de mayor a menor para no romper índices
        emoteReplacements.sort((a, b) => b.start - a.start);

        // Realizar reemplazos
        emoteReplacements.forEach(({ start, end, id }) => {
            const emoteImg = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0" alt="emote" class="emote-img" style="height:${CONFIG.EMOTE_SIZE};vertical-align:middle;">`;
            splitText.splice(start, end - start + 1, emoteImg);
        });

        // Escapar el texto que no es emote
        const result = splitText.map(char => {
            if (char.startsWith('<img')) {
                return char;
            }
            return escapeHTML(char);
        }).join('');

        return result;

    } catch (error) {
        console.error('Error al procesar emotes:', error);
        return escapeHTML(text);
    }
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

/**
 * Muestra un mensaje en el overlay
 * @param {string} usuario - Nombre de usuario
 * @param {string} mensaje - Contenido del mensaje
 * @param {Object} emotes - Emotes del mensaje
 */
function mostrarMensaje(usuario, mensaje, emotes) {
    try {
        const lowerUser = usuario.toLowerCase();

        // Obtener número y equipo
        const userNumber = getUserNumber(lowerUser);
        const team = getUserTeam(lowerUser);

        // Actualizar DOM
        DOM.username.textContent = usuario.toUpperCase();
        DOM.number.textContent = userNumber;
        DOM.root.style.setProperty('--team-color', team.color);
        DOM.teamLogo.style.backgroundImage = `url('${team.logo}')`;

        // Procesar mensaje con emotes
        const mensajeProcesado = reemplazarEmotes(mensaje, emotes);
        DOM.message.innerHTML = `"${mensajeProcesado}"`;

        // Actualizar ARIA para accesibilidad
        if (CONFIG.ACCESSIBILITY.ENABLE_ARIA) {
            DOM.message.setAttribute('aria-label', `Mensaje de ${usuario}: ${mensaje}`);
        }

        // Mostrar contenedor
        DOM.container.style.opacity = '1';

        // Reproducir sonido
        playNotificationSound();

        // Limpiar timeout anterior
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }

        // Ocultar después del tiempo configurado
        hideTimeout = setTimeout(() => {
            DOM.container.style.opacity = '0';
        }, CONFIG.MESSAGE_DISPLAY_TIME);

    } catch (error) {
        console.error('Error al mostrar mensaje:', error);
    }
}

// ============================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏎️ Inicializando Twitch Chat Overlay F1...');

    initDOMCache();
    initAudio();
    initTwitchClient();

    // Función de prueba para consola
    window.simularMensaje = (usuario, mensaje) => {
        mostrarMensaje(usuario, mensaje, {});
    };

    console.log('✅ Overlay inicializado correctamente');
    console.log('💡 Usa simularMensaje("usuario", "mensaje") para probar');
});
