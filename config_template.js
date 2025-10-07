// config.js - API Configuration
// Add this file to .gitignore to keep your API key secure

const CONFIG = {
    GOOGLE_MAPS_API_KEY: 'YOUR_ACTUAL_API_KEY_HERE',
    
    // Optional: Add other configuration options
    DEFAULT_CENTER: {
        lat: 24.8138,
        lng: 120.9675 // Hsinchu, Taiwan
    },
    
    MAP_SETTINGS: {
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    },
    
    GPS_OPTIONS: {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000
    }
};

// Make config available globally
window.APP_CONFIG = CONFIG;