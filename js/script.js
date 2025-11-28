/**
 * Lógica principal del Overlay de Chat de Twitch
 * Refactorizado con principios SOLID
 */

// ============================================
// SERVICIOS
// ============================================

/**
 * Servicio encargado de la gestión de datos (Equipos, Números)
 */
class DataService {
    constructor(config, teamsData, userNumbersData, userTeamsData) {
        this.config = config;
        this.teams = teamsData;
        this.userNumbers = userNumbersData;
        this.userTeams = userTeamsData;
    }

    /**
     * Obtiene el número de piloto para un usuario
     * @param {string} username 
     * @returns {number}
     */
    getUserNumber(username) {
        const lowerUser = username.toLowerCase();

        if (lowerUser === this.config.SPECIAL_USER.username) {
            return this.config.SPECIAL_USER.number;
        }

        if (this.userNumbers[lowerUser]) {
            return this.userNumbers[lowerUser];
        }

        return Math.floor(
            Math.random() * (this.config.MAX_RANDOM_NUMBER - this.config.MIN_RANDOM_NUMBER + 1)
        ) + this.config.MIN_RANDOM_NUMBER;
    }

    /**
     * Obtiene el equipo para un usuario
     * @param {string} username 
     * @returns {Object}
     */
    getUserTeam(username) {
        const lowerUser = username.toLowerCase();

        if (lowerUser === this.config.SPECIAL_USER.username) {
            return this.teams[this.config.SPECIAL_USER.team];
        }

        const teamKey = this.userTeams[lowerUser];
        if (teamKey && this.teams[teamKey]) {
            return this.teams[teamKey];
        }

        return this.getRandomTeam();
    }

    /**
     * Obtiene un equipo aleatorio
     * @returns {Object}
     */
    getRandomTeam() {
        const teamKeys = Object.keys(this.teams);
        const randomKey = teamKeys[Math.floor(Math.random() * teamKeys.length)];
        return this.teams[randomKey];
    }
}

/**
 * Servicio encargado del Audio
 */
class AudioService {
    constructor(audioUrl, volume) {
        this.audioUrl = audioUrl;
        this.volume = volume;
        this.audioElement = null;
        this.init();
    }

    init() {
        try {
            this.audioElement = new Audio(this.audioUrl);
            this.audioElement.preload = 'auto';
            this.audioElement.volume = this.volume;

            this.audioElement.addEventListener('error', (e) => {
                console.error('Error al cargar el audio:', e);
            });
        } catch (error) {
            console.error('Error al inicializar AudioService:', error);
        }
    }

    play() {
        if (!this.audioElement) return;

        try {
            this.audioElement.currentTime = 0;
            this.audioElement.play().catch((error) => {
                console.warn('No se pudo reproducir el audio (posiblemente bloqueado por el navegador):', error);
            });
        } catch (error) {
            console.error('Error al reproducir audio:', error);
        }
    }
}

/**
 * Servicio encargado de la conexión con Twitch
 */
class TwitchService {
    constructor(channel, onMessageCallback) {
        this.channel = channel;
        this.onMessageCallback = onMessageCallback;
        this.client = null;
    }

    connect() {
        try {
            // @ts-ignore
            this.client = new tmi.Client({
                channels: [this.channel]
            });

            this.client.on('connected', (address, port) => {
                console.log(`✅ Conectado a Twitch IRC: ${address}:${port}`);
            });

            this.client.on('message', (channel, tags, message, self) => {
                if (this.onMessageCallback) {
                    this.onMessageCallback(tags, message);
                }
            });

            this.client.on('disconnected', (reason) => {
                console.warn('⚠️ Desconectado de Twitch IRC:', reason);
            });

            this.client.connect().catch((error) => {
                console.error('❌ Error al conectar con Twitch:', error);
            });

        } catch (error) {
            console.error('❌ Error al inicializar TwitchService:', error);
        }
    }
}

/**
 * Gestor de la Interfaz de Usuario (UI)
 */
class UIManager {
    constructor(config) {
        this.config = config;
        this.dom = {
            username: document.getElementById('username'),
            number: document.querySelector('.number'),
            message: document.getElementById('message'),
            container: document.querySelector('.container'),
            teamLogo: document.querySelector('.team-logo'),
            root: document.documentElement
        };
        this.hideTimeout = null;
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    processEmotes(text, emotes) {
        if (!emotes) return this.escapeHTML(text);

        try {
            let splitText = text.split('');
            let emoteReplacements = [];

            Object.entries(emotes).forEach(([emoteId, positions]) => {
                positions.forEach(pos => {
                    const [start, end] = pos.split('-').map(Number);
                    emoteReplacements.push({ start, end, id: emoteId });
                });
            });

            emoteReplacements.sort((a, b) => b.start - a.start);

            emoteReplacements.forEach(({ start, end, id }) => {
                const emoteImg = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0" alt="emote" class="emote-img" style="height:${this.config.EMOTE_SIZE};vertical-align:middle;">`;
                splitText.splice(start, end - start + 1, emoteImg);
            });

            return splitText.map(char => {
                return char.startsWith('<img') ? char : this.escapeHTML(char);
            }).join('');

        } catch (error) {
            console.error('Error al procesar emotes:', error);
            return this.escapeHTML(text);
        }
    }

    displayMessage(username, message, emotes, userNumber, team) {
        try {
            // Actualizar contenido
            this.dom.username.textContent = username.toUpperCase();
            this.dom.number.textContent = userNumber;
            this.dom.root.style.setProperty('--team-color', team.color);
            this.dom.teamLogo.style.backgroundImage = `url('${team.logo}')`;

            // Procesar mensaje
            const processedMessage = this.processEmotes(message, emotes);
            this.dom.message.innerHTML = `"${processedMessage}"`;

            // Accesibilidad
            if (this.config.ACCESSIBILITY.ENABLE_ARIA) {
                this.dom.message.setAttribute('aria-label', `Mensaje de ${username}: ${message}`);
            }

            // Mostrar
            this.dom.container.style.opacity = '1';

            // Resetear timer
            if (this.hideTimeout) clearTimeout(this.hideTimeout);

            this.hideTimeout = setTimeout(() => {
                this.dom.container.style.opacity = '0';
            }, this.config.MESSAGE_DISPLAY_TIME);

        } catch (error) {
            console.error('Error en UIManager:', error);
        }
    }
}

// ============================================
// APLICACIÓN PRINCIPAL
// ============================================

class App {
    constructor() {
        this.config = CONFIG; // Global from config.js
        // Globales from data.js: teams, userNumbers, userTeams
        this.dataService = new DataService(this.config, teams, userNumbers, userTeams);
        this.audioService = new AudioService(this.config.AUDIO_URL, this.config.AUDIO_VOLUME);
        this.uiManager = new UIManager(this.config);
        this.twitchService = new TwitchService(
            this.config.TWITCH_CHANNEL,
            this.handleMessage.bind(this)
        );
    }

    init() {
        console.log('🏎️ Inicializando Twitch Chat Overlay F1 (Refactorizado)...');
        this.twitchService.connect();

        // Exponer para pruebas
        window.simularMensaje = (usuario, mensaje) => {
            this.handleMessage({ 'display-name': usuario, emotes: {} }, mensaje);
        };

        console.log('✅ App inicializada');
    }

    handleMessage(tags, message) {
        const username = tags['display-name'] || tags.username;
        const emotes = tags.emotes;

        if (this.config.DEBUG) {
            console.log('Mensaje recibido:', username, message);
        }

        const userNumber = this.dataService.getUserNumber(username);
        const team = this.dataService.getUserTeam(username);

        this.uiManager.displayMessage(username, message, emotes, userNumber, team);
        this.audioService.play();
    }
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
