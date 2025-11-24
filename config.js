/**
 * Configuración del Overlay de Chat de Twitch
 * Todas las constantes y configuraciones centralizadas
 */

const CONFIG = {
  // Configuración de Twitch
  TWITCH_CHANNEL: 'liiukiin',
  
  // Tiempos (en milisegundos)
  MESSAGE_DISPLAY_TIME: 5000,
  TRANSITION_DURATION: 700,
  
  // Audio
  AUDIO_URL: 'https://res.cloudinary.com/pcsolucion/video/upload/v1745911791/f1-box-box_hg8frh.mp3',
  AUDIO_VOLUME: 1.0,
  
  // Tamaños y dimensiones
  EMOTE_SIZE: '1.2em',
  TEAM_LOGO_DEFAULT_WIDTH: '1.6em',
  
  // Números de piloto
  MIN_RANDOM_NUMBER: 1,
  MAX_RANDOM_NUMBER: 99,
  
  // Usuario especial
  SPECIAL_USER: {
    username: 'liiukiin',
    number: 63,
    team: 'mercedes'
  },
  
  // Configuración de accesibilidad
  ACCESSIBILITY: {
    ENABLE_ARIA: true,
    ENABLE_SCREEN_READER: true
  },
  
  // Modo debug
  DEBUG: false
};

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
