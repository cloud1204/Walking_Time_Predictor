// Personal Walking Time Estimator - Main Application Logic
class WalkingTimeEstimator {
    constructor() {
        this.map = null;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.tracking = false;
        this.watchId = null;
        this.routeDistance = 0;
        this.startTime = null;
        this.lastPosition = null;
        this.speedBuffer = []; // Buffer for smooth speed calculations
        this.totalDistanceWalked = 0;
        
        // Load saved data or initialize with sample data
        this.speedData = this.loadSpeedData();
        this.userSettings = this.loadUserSettings();
        
        this.initializeEventListeners();
    }
    
    // Initialize Google Maps
    initMap() {
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 24.8138, lng: 120.9675 }, // Hsinchu, Taiwan
            zoom: 13,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                },
                {
                    featureType: "transit",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ],
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });
        
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            draggable: true,
            polylineOptions: {
                strokeColor: '#667eea',
                strokeWeight: 6,
                strokeOpacity: 0.8
            },
            markerOptions: {
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="15" cy="15" r="12" fill="#667eea" stroke="white" stroke-width="3"/>
                            <text x="15" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold">🚶</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(30, 30)
                }
            }
        });
        this.directionsRenderer.setMap(this.map);
        
        // Update route when user drags
        this.directionsRenderer.addListener('directions_changed', () => {
            this.updateRouteInfo();
        });
        
        // Initialize autocomplete
        this.initAutocomplete();
    }
    
    // Initialize autocomplete for address inputs
    initAutocomplete() {
        const startInput = document.getElementById('start');
        const endInput = document.getElementById('end');
        
        const startAutocomplete = new google.maps.places.Autocomplete(startInput);
        const endAutocomplete = new google.maps.places.Autocomplete(endInput);
        
        startAutocomplete.bindTo('bounds', this.map);
        endAutocomplete.bindTo('bounds', this.map);
    }
    
    // Calculate route between two points
    calculateRoute() {
        const start = document.getElementById('start').value;
        const end = document.getElementById('end').value;
        
        if (!start || !end) {
            this.showMessage('Please enter both start and end locations', 'error');
            return;
        }
        
        const calculateBtn = event.target;
        calculateBtn.classList.add('loading');
        calculateBtn.disabled = true;
        
        const request = {
            origin: start,
            destination: end,
            travelMode: google.maps.TravelMode.WALKING,
            unitSystem: google.maps.UnitSystem.METRIC,
            avoidHighways: true,
            provideRouteAlternatives: true
        };
        
        this.directionsService.route(request, (result, status) => {
            calculateBtn.classList.remove('loading');
            calculateBtn.disabled = false;
            
            if (status === 'OK') {
                this.directionsRenderer.setDirections(result);
                this.updateRouteInfo();
                this.showMessage('Route calculated! Your personalized estimate is shown below.', 'success');
            } else {
                let errorMessage = 'Could not calculate route: ';
                switch(status) {
                    case 'NOT_FOUND':
                        errorMessage += 'One or more locations could not be found.';
                        break;
                    case 'ZERO_RESULTS':
                        errorMessage += 'No walking route could be found between these locations.';
                        break;
                    case 'MAX_WAYPOINTS_EXCEEDED':
                        errorMessage += 'Too many waypoints in the request.';
                        break;
                    case 'INVALID_REQUEST':
                        errorMessage += 'Invalid request.';
                        break;
                    case 'OVER_QUERY_LIMIT':
                        errorMessage += 'Query limit exceeded. Please try again later.';
                        break;
                    case 'REQUEST_DENIED':
                        errorMessage += 'Request denied. Check your API key.';
                        break;
                    case 'UNKNOWN_ERROR':
                        errorMessage += 'Server error. Please try again.';
                        break;
                    default:
                        errorMessage += status;
                }
                this.showMessage(errorMessage, 'error');
            }
        });
    }
    
    // Update route information display
    updateRouteInfo() {
        const directions = this.directionsRenderer.getDirections();
        if (!directions) return;
        
        const route = directions.routes[0];
        const leg = route.legs[0];
        this.routeDistance = leg.distance.value / 1000; // Convert to km
        
        const personalSpeed = this.getPersonalizedSpeed();
        const personalTime = (this.routeDistance / personalSpeed) * 60; // minutes
        const googleTime = leg.duration.value / 60; // Google's estimate in minutes
        
        document.getElementById('distanceRemaining').textContent = this.routeDistance.toFixed(2) + ' km';
        document.getElementById('timeRemaining').textContent = Math.round(personalTime) + ' min';
        
        const timeDifference = googleTime - personalTime;
        const percentDifference = ((Math.abs(timeDifference) / googleTime) * 100).toFixed(1);
        
        const resultHTML = `
            <div class="route-result">
                <h3 style="color: #2c3e50; margin-bottom: 15px;">🎯 Route Analysis</h3>
                <div class="route-comparison">
                    <div class="comparison-item">
                        <span class="comparison-value">${leg.distance.text}</span>
                        <span class="comparison-label">Total Distance</span>
                    </div>
                    <div class="comparison-item">
                        <span class="comparison-value">${Math.round(googleTime)} min</span>
                        <span class="comparison-label">Google Estimate</span>
                    </div>
                    <div class="comparison-item">
                        <span class="comparison-value" style="color: #e74c3c;">${Math.round(personalTime)} min</span>
                        <span class="comparison-label">Your Estimate</span>
                    </div>
                    <div class="comparison-item">
                        <span class="comparison-value" style="color: ${timeDifference > 0 ? '#2ecc71' : '#e74c3c'};">
                            ${timeDifference > 0 ? '-' : '+'}${Math.abs(Math.round(timeDifference))} min
                        </span>
                        <span class="comparison-label">${timeDifference > 0 ? 'Faster' : 'Slower'} (${percentDifference}%)</span>
                    </div>
                </div>
                <p style="margin-top: 15px; color: #7f8c8d; font-style: italic;">
                    Based on your average speed of ${personalSpeed.toFixed(1)} km/h with ${this.getTerrainDescription()} terrain adjustment.
                </p>
            </div>
        `;
        document.getElementById('routeResult').innerHTML = resultHTML;
    }
    
    // Calculate personalized walking speed
    getPersonalizedSpeed() {
        const baseSpeed = parseFloat(document.getElementById('avgSpeed').value);
        const terrainFactor = parseFloat(document.getElementById('terrain').value);
        
        // If we have historical data, use machine learning approach
        if (this.speedData.length >= 3) {
            // Use weighted average of recent walks (more recent = higher weight)
            const weights = this.speedData.map((_, index) => Math.pow(1.1, index)); // Exponential weighting
            const weightedSum = this.speedData.reduce((sum, walk, index) => sum + (walk.speed * weights[index]), 0);
            const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
            const learnedSpeed = weightedSum / totalWeight;
            
            // Blend learned speed with user input (80% learned, 20% user input for better adaptation)
            const blendedSpeed = (learnedSpeed * 0.8) + (baseSpeed * 0.2);
            return Math.max(1.0, blendedSpeed * terrainFactor); // Minimum 1 km/h
        }
        
        return Math.max(1.0, baseSpeed * terrainFactor);
    }
    
    // Get terrain description for display
    getTerrainDescription() {
        const terrainValue = parseFloat(document.getElementById('terrain').value);
        const descriptions = {
            1.0: 'flat',
            0.8: 'hilly',
            0.6: 'very hilly',
            1.1: 'downhill'
        };
        return descriptions[terrainValue] || 'custom';
    }
    
    // Update personal speed settings
    updatePersonalSpeed() {
        const speed = parseFloat(document.getElementById('avgSpeed').value);
        document.getElementById('avgSpeedDisplay').textContent = speed.toFixed(1);
        
        // Save settings
        this.userSettings.averageSpeed = speed;
        this.userSettings.terrainFactor = parseFloat(document.getElementById('terrain').value);
        this.saveUserSettings();
        
        if (this.directionsRenderer.getDirections()) {
            this.updateRouteInfo();
        }
        
        this.showMessage('Speed profile updated! Future estimates will use this data.', 'success');
    }
    
    // Toggle GPS tracking
    toggleTracking() {
        const btn = document.getElementById('trackingBtn');
        const status = document.getElementById('walkingStatus');
        
        if (!this.tracking) {
            this.startTracking();
            btn.textContent = 'Stop Walk';
            btn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            status.textContent = 'Tracking your walk in real-time... 📍';
            status.classList.remove('inactive');
        } else {
            this.stopTracking();
            btn.textContent = 'Start Walk';
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            status.textContent = 'Walk completed. Data saved to improve future estimates. ✅';
            status.classList.add('inactive');
        }
    }
    
    // Start GPS tracking
    startTracking() {
        if (!navigator.geolocation) {
            this.showMessage('Geolocation not supported by this browser', 'error');
            return;
        }
        
        this.tracking = true;
        this.startTime = new Date();
        this.lastPosition = null;
        this.speedBuffer = [];
        this.totalDistanceWalked = 0;
        
        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 2000
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updatePosition(position),
            (error) => this.handleLocationError(error),
            options
        );
    }
    
    // Stop GPS tracking
    stopTracking() {
        this.tracking = false;
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Save walk data for machine learning
        if (this.startTime && this.lastPosition && this.totalDistanceWalked > 0.1) { // Minimum 100m walk
            const walkDuration = (new Date() - this.startTime) / 1000 / 3600; // hours
            const averageSpeed = this.totalDistanceWalked / walkDuration; // km/h
            
            if (averageSpeed > 1 && averageSpeed < 15) { // Reasonable walking speeds only
                const newWalk = {
                    id: Date.now(),
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString(),
                    route: this.generateRouteDescription(),
                    speed: averageSpeed,
                    distance: this.totalDistanceWalked,
                    duration: walkDuration * 60, // minutes
                    terrain: parseFloat(document.getElementById('terrain').value)
                };
                
                this.speedData.push(newWalk);
                this.saveSpeedData();
                this.updateSpeedHistory();
                
                // Auto-update average speed based on recent learning
                const recentAvg = this.calculateRecentAverageSpeed();
                document.getElementById('avgSpeed').value = recentAvg.toFixed(1);
                this.updatePersonalSpeed();
                
                this.showMessage(`Walk saved! Distance: ${this.totalDistanceWalked.toFixed(2)}km, Avg Speed: ${averageSpeed.toFixed(1)}km/h`, 'success');
            }
        }
    }
    
    // Update position during tracking
    updatePosition(position) {
        if (!this.tracking) return;
        
        const currentPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date(),
            accuracy: position.coords.accuracy
        };
        
        // Only process if accuracy is reasonable (within 50 meters)
        if (currentPos.accuracy > 50) {
            console.log('Low GPS accuracy, skipping position update');
            return;
        }
        
        if (this.lastPosition) {
            // Calculate distance and speed
            const distance = this.calculateDistance(this.lastPosition, currentPos);
            const timeDiff = (currentPos.timestamp - this.lastPosition.timestamp) / 1000 / 3600; // hours
            
            // Only process if movement is reasonable
            if (distance > 0.001 && timeDiff > 0) { // Minimum 1 meter movement
                this.totalDistanceWalked += distance;
                const instantSpeed = distance / timeDiff; // km/h
                
                // Use speed buffer for smoothing (avoid GPS noise)
                if (instantSpeed > 0.5 && instantSpeed < 15) { // Reasonable walking speeds
                    this.speedBuffer.push(instantSpeed);
                    if (this.speedBuffer.length > 10) { // Keep last 10 readings
                        this.speedBuffer.shift();
                    }
                    
                    // Calculate smoothed speed
                    const smoothedSpeed = this.speedBuffer.reduce((sum, speed) => sum + speed, 0) / this.speedBuffer.length;
                    document.getElementById('currentSpeed').textContent = smoothedSpeed.toFixed(1);
                    
                    // Update time remaining based on current speed
                    if (this.routeDistance > 0) {
                        const distanceRemaining = Math.max(0, this.routeDistance - this.totalDistanceWalked);
                        const remainingTime = (distanceRemaining / smoothedSpeed) * 60; // minutes
                        document.getElementById('timeRemaining').textContent = Math.round(remainingTime) + ' min';
                        document.getElementById('distanceRemaining').textContent = distanceRemaining.toFixed(2) + ' km';
                    }
                }
            }
        }
        
        this.lastPosition = currentPos;
    }
    
    // Calculate distance between two GPS coordinates
    calculateDistance(pos1, pos2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(pos2.lat - pos1.lat);
        const dLng = this.toRadians(pos2.lng - pos1.lng);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(this.toRadians(pos1.lat)) * Math.cos(this.toRadians(pos2.lat)) *
                 Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Convert degrees to radians
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    // Handle geolocation errors
    handleLocationError(error) {
        let message = 'Location tracking error: ';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'Location access denied. Please enable location permissions and try again.';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'Location information unavailable. Check your GPS signal.';
                break;
            case error.TIMEOUT:
                message += 'Location request timed out. Please try again.';
                break;
            default:
                message += 'Unknown error occurred.';
        }
        this.showMessage(message, 'error');
        
        // Stop tracking if there's an error
        if (this.tracking) {
            this.toggleTracking();
        }
    }
    
    // Calculate recent average speed from last few walks
    calculateRecentAverageSpeed() {
        if (this.speedData.length === 0) return 5.5; // Default
        
        const recentWalks = this.speedData.slice(-5); // Last 5 walks
        return recentWalks.reduce((sum, walk) => sum + walk.speed, 0) / recentWalks.length;
    }
    
    // Generate route description for saved walks
    generateRouteDescription() {
        const start = document.getElementById('start').value;
        const end = document.getElementById('end').value;
        
        if (start && end) {
            return `${this.shortenAddress(start)} → ${this.shortenAddress(end)}`;
        }
        return `Walk ${this.speedData.length + 1}`;
    }
    
    // Shorten address for display
    shortenAddress(address) {
        const parts = address.split(',');
        return parts[0].length > 20 ? parts[0].substring(0, 17) + '...' : parts[0];
    }
    
    // Update speed history display
    updateSpeedHistory() {
        const historyContainer = document.getElementById('speedHistory');
        historyContainer.innerHTML = '';
        
        if (this.speedData.length === 0) {
            historyContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No walking data yet. Start tracking walks to see your history!</p>';
            return;
        }
        
        // Show last 15 walks, most recent first
        const recentWalks = this.speedData.slice(-15).reverse();
        
        recentWalks.forEach(walk => {
            const entry = document.createElement('div');
            entry.className = 'speed-entry';
            entry.innerHTML = `
                <div>
                    <div class="route-info">${walk.route}</div>
                    <div style="font-size: 0.85em; color: #7f8c8d;">${walk.date} • ${walk.distance.toFixed(2)}km • ${walk.duration.toFixed(0)}min</div>
                </div>
                <div class="speed-info">${walk.speed.toFixed(1)} km/h</div>
            `;
            historyContainer.appendChild(entry);
        });
        
        // Add summary statistics
        const avgSpeed = this.calculateRecentAverageSpeed();
        const totalDistance = this.speedData.reduce((sum, walk) => sum + walk.distance, 0);
        const totalWalks = this.speedData.length;
        
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = 'margin-top: 15px; padding: 15px; background: #667eea; color: white; border-radius: 10px;';
        summaryDiv.innerHTML = `
            <strong>Your Walking Stats:</strong><br>
            Total Walks: ${totalWalks} • Total Distance: ${totalDistance.toFixed(1)}km • Average Speed: ${avgSpeed.toFixed(1)}km/h
        `;
        historyContainer.appendChild(summaryDiv);
    }
    
    // Export walking data
    exportData() {
        if (this.speedData.length === 0) {
            this.showMessage('No data to export yet!', 'warning');
            return;
        }
        
        const csvContent = this.convertToCSV(this.speedData);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `walking_data_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showMessage('Walking data exported successfully!', 'success');
    }
    
    // Convert data to CSV format
    convertToCSV(data) {
        const headers = ['Date', 'Time', 'Route', 'Distance (km)', 'Duration (min)', 'Speed (km/h)', 'Terrain Factor'];
        const rows = data.map(walk => [
            walk.date,
            walk.time,
            walk.route,
            walk.distance.toFixed(2),
            walk.duration.toFixed(0),
            walk.speed.toFixed(1),
            walk.terrain
        ]);
        
        return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    }
    
    // Clear all data
    clearData() {
        if (confirm('Are you sure you want to clear all walking data? This cannot be undone.')) {
            this.speedData = [];
            this.saveSpeedData();
            this.updateSpeedHistory();
            this.showMessage('All walking data cleared.', 'warning');
        }
    }
    
    // Load speed data from localStorage
    loadSpeedData() {
        try {
            const saved = JSON.parse(window.localStorage?.getItem('walkingSpeedData') || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (e) {
            console.warn('Could not load speed data:', e);
            return [];
        }
    }
    
    // Save speed data to localStorage
    saveSpeedData() {
        try {
            window.localStorage?.setItem('walkingSpeedData', JSON.stringify(this.speedData));
        } catch (e) {
            console.warn('Could not save speed data:', e);
        }
    }
    
    // Load user settings
    loadUserSettings() {
        try {
            const saved = JSON.parse(window.localStorage?.getItem('walkingUserSettings') || '{}');
            return {
                averageSpeed: 5.5,
                terrainFactor: 1.0,
                ...saved
            };
        } catch (e) {
            console.warn('Could not load user settings:', e);
            return { averageSpeed: 5.5, terrainFactor: 1.0 };
        }
    }
    
    // Save user settings
    saveUserSettings() {
        try {
            window.localStorage?.setItem('walkingUserSettings', JSON.stringify(this.userSettings));
        } catch (e) {
            console.warn('Could not save user settings:', e);
        }
    }
    
    // Initialize event listeners
    initializeEventListeners() {
        // Apply saved settings on load
        document.getElementById('avgSpeed').value = this.userSettings.averageSpeed;
        document.getElementById('terrain').value = this.userSettings.terrainFactor;
        document.getElementById('avgSpeedDisplay').textContent = this.userSettings.averageSpeed.toFixed(1);
        
        // Auto-save settings when changed
        document.getElementById('terrain').addEventListener('change', () => {
            this.updatePersonalSpeed();
        });
        
        // Enter key support for route calculation
        ['start', 'end'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.calculateRoute();
                }
            });
        });
        
        // Update display when average speed changes
        document.getElementById('avgSpeed').addEventListener('input', () => {
            document.getElementById('avgSpeedDisplay').textContent = 
                parseFloat(document.getElementById('avgSpeed').value).toFixed(1);
        });
    }
    
    // Show message to user
    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        // Insert after route result or at top of container
        const routeResult = document.getElementById('routeResult');
        const container = routeResult.parentNode;
        container.insertBefore(messageDiv, routeResult.nextSibling);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
        
        // Allow manual dismissal
        messageDiv.addEventListener('click', () => {
            messageDiv.remove();
        });
    }
}

// Global functions for HTML onclick handlers
let app;

function initializeApp() {
    app = new WalkingTimeEstimator();
    app.initMap();
    app.updateSpeedHistory();
}

function calculateRoute() {
    app.calculateRoute();
}

function updatePersonalSpeed() {
    app.updatePersonalSpeed();
}

function toggleTracking() {
    app.toggleTracking();
}

function exportData() {
    app.exportData();
}

function clearData() {
    app.clearData();
}

// Service Worker registration for offline capability (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => console.log('SW registered'))
            .catch(registrationError => console.log('SW registration failed'));
    });
}