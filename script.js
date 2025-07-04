// Google Maps API implementation for Where2Go
let map;
let directionsService;
let directionsRenderer;
let restroomMarkers = [];
let userMarker = null;
let userLocation = null;
let restroomData = [];

// Initialize the map when the page loads
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();

    // Add event listener for distance filter
    const distanceFilter = document.getElementById('distance-filter');
    if (distanceFilter) {
        distanceFilter.addEventListener('change', () => {
            // Use user location if set, otherwise map center
            let center;
            if (userLocation) {
                center = userLocation instanceof google.maps.LatLng
                    ? userLocation
                    : new google.maps.LatLng(userLocation.lat, userLocation.lng);
            } else if (map) {
                center = map.getCenter();
            } else {
                center = { lat: 40.7128, lng: -74.0060 };
            }
            fetchRestrooms(center.lat(), center.lng());
        });
    }
});

function initMap() {
    // Default center: New York City
    const defaultCenter = { lat: 40.7128, lng: -74.0060 };
    
    // Initialize the map
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: defaultCenter,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
    });

    // Initialize directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // We'll handle our own markers
        panel: document.getElementById('directions-list')
    });
    directionsRenderer.setMap(map);

    // Add click listener to set user location
    map.addListener('click', (event) => {
        setUserLocation(event.latLng);
    });

    // Load initial restroom data
    fetchRestrooms(defaultCenter.lat, defaultCenter.lng);
}

function setupEventListeners() {
    const searchBtn = document.getElementById('search-btn');
    const addressInput = document.getElementById('address-input');
    const myLocBtn = document.getElementById('myloc-btn');

    // Address search functionality
    if (searchBtn && addressInput) {
        searchBtn.addEventListener('click', () => {
            const address = addressInput.value.trim();
            if (!address) return;
            
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: address }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    map.setCenter(location);
                    map.setZoom(15);
                    setUserLocation(location);
                    fetchRestrooms(location.lat(), location.lng());
                } else {
                    alert('Location not found. Please try a different address.');
                }
            });
        });

        // Allow Enter key to trigger search
        addressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });
    }

    // Use My Location button
    if (myLocBtn) {
        myLocBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser.');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    map.setCenter(location);
                    map.setZoom(15);
                    setUserLocation(location);
                    fetchRestrooms(location.lat, location.lng);
                },
                () => {
                    alert('Unable to retrieve your location. Please check your location settings.');
                }
            );
        });
    }
}

function setUserLocation(latLng) {
    // Remove existing user marker
    if (userMarker) {
        userMarker.setMap(null);
    }

    // Always convert to google.maps.LatLng
    const latLngObj = latLng instanceof google.maps.LatLng ? latLng : new google.maps.LatLng(latLng.lat, latLng.lng);

    // Create new user marker
    userMarker = new google.maps.Marker({
        position: latLngObj,
        map: map,
        title: 'Your Location',
        icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new google.maps.Size(32, 32)
        }
    });

    userLocation = latLngObj;
    
    // Clear existing directions
    directionsRenderer.setDirections({ routes: [] });
    // Do NOT automatically route to the nearest restroom anymore
}

// Helper: Calculate distance in meters between two lat/lng points
function getDistanceMeters(lat1, lng1, lat2, lng2) {
    const p1 = new google.maps.LatLng(lat1, lng1);
    const p2 = new google.maps.LatLng(lat2, lng2);
    return google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
}

function fetchRestrooms(lat, lng) {
    // Clear existing markers
    clearRestroomMarkers();
    
    // Get selected radius in miles from dropdown (default 1 mile)
    let radiusMiles = 1;
    const distanceFilter = document.getElementById('distance-filter');
    if (distanceFilter) {
        radiusMiles = parseFloat(distanceFilter.value) || 1;
    }
    const radiusMeters = radiusMiles * 1609.34;

    // Fetch restrooms from Refuge Restrooms API
    const url = `https://www.refugerestrooms.org/api/v1/restrooms/by_location?page=1&per_page=50&offset=0&lat=${lat}&lng=${lng}&radius=${radiusMiles}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Filter by radius in JS (API may return more than requested)
            const filtered = data.filter(restroom => {
                const d = getDistanceMeters(lat, lng, parseFloat(restroom.latitude), parseFloat(restroom.longitude));
                return d <= radiusMeters;
            });
            console.log(`Filtered restrooms within ${radiusMiles} mile(s):`, filtered.length);
            restroomData = filtered;
            addRestroomMarkers(filtered);
        })
        .catch(error => {
            console.error('Error fetching restrooms:', error);
            // Fallback: Add some sample restrooms for demonstration
            addSampleRestrooms(lat, lng);
        });
}

function addRestroomMarkers(restrooms) {
    restrooms.forEach(restroom => {
        // Unique ID for info window button
        const btnId = `route-btn-${restroom.latitude.toString().replace('.', '_')}_${restroom.longitude.toString().replace('.', '_')}`;
        const marker = new google.maps.Marker({
            position: { lat: parseFloat(restroom.latitude), lng: parseFloat(restroom.longitude) },
            map: map,
            title: restroom.name || 'Public Restroom',
            icon: {
                url: 'toilet.png',
                scaledSize: new google.maps.Size(32, 32)
            }
        });

        // Add info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style=\"padding: 8px;\">
                    <h3 style=\"margin: 0 0 8px 0; font-size: 14px;\">${restroom.name || 'Public Restroom'}</h3>
                    <p style=\"margin: 0; font-size: 12px;\">${restroom.street || 'Address not available'}</p>
                    ${restroom.accessible ? '<p style=\\\"margin: 4px 0 0 0; font-size: 12px; color: green;\\\">♿ Accessible</p>' : ''}
                    <button id=\"${btnId}\" 
                            style=\"margin-top: 8px; padding: 4px 8px; background: #267373; color: white; border: none; border-radius: 4px; cursor: pointer;\">
                        Get Directions
                    </button>
                </div>
            `
        });

        marker.addListener('click', () => {
            infoWindow.open(map, marker);
            // Attach event listener after info window opens
            setTimeout(() => {
                const routeBtn = document.getElementById(btnId);
                if (routeBtn) {
                    routeBtn.addEventListener('click', () => {
                        console.log('Get Directions (marker) clicked for:', restroom.name, restroom);
                        if (userLocation) {
                            const userLatLng = userLocation instanceof google.maps.LatLng
                                ? userLocation
                                : new google.maps.LatLng(userLocation.lat, userLocation.lng);
                            showRouteToRestroom(userLatLng, restroom);
                            infoWindow.close();
                        } else {
                            alert('Please set your starting location first by clicking on the map or using "Use My Location".');
                        }
                    });
                }
            }, 100);
        });

        restroomMarkers.push(marker);
    });

    updateRestroomList(restrooms);
}

function addSampleRestrooms(lat, lng) {
    // Add some sample restrooms around the location for demonstration
    const sampleRestrooms = [
        {
            name: 'Central Park Restroom',
            latitude: lat + 0.002,
            longitude: lng + 0.002,
            street: 'Central Park, New York, NY',
            accessible: true
        },
        {
            name: 'Public Library Restroom',
            latitude: lat - 0.001,
            longitude: lng + 0.001,
            street: '5th Avenue, New York, NY',
            accessible: true
        },
        {
            name: 'Subway Station Restroom',
            latitude: lat + 0.001,
            longitude: lng - 0.001,
            street: 'Broadway, New York, NY',
            accessible: false
        }
    ];

    addRestroomMarkers(sampleRestrooms);
}

function clearRestroomMarkers() {
    restroomMarkers.forEach(marker => {
        marker.setMap(null);
    });
    restroomMarkers = [];
}

function findNearestRestroom(userLatLng) {
    if (restroomData.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    restroomData.forEach(restroom => {
        const restroomLatLng = {
            lat: parseFloat(restroom.latitude),
            lng: parseFloat(restroom.longitude)
        };
        
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            userLatLng,
            restroomLatLng
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearest = restroom;
        }
    });

    return nearest;
}

function showRouteToRestroom(origin, restroom) {
    if (!origin || !restroom) return;

    const destination = {
        lat: parseFloat(restroom.latitude),
        lng: parseFloat(restroom.longitude)
    };

    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.WALKING
    };

    console.log('Requesting route:', request);
    directionsService.route(request, (result, status) => {
        console.log('Route response status:', status);
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            // Update directions list with more specific instructions
            updateDirectionsList(result.routes[0].legs[0].steps);
        } else {
            alert('Unable to calculate route. Please try again.');
        }
    });
}

function updateDirectionsList(steps) {
    const directionsList = document.getElementById('directions-list');
    directionsList.innerHTML = '';

    steps.forEach((step, index) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'direction-step';
        stepDiv.innerHTML = `
            <div class="step-number">${index + 1}</div>
            <div class="step-content">
                <div class="step-instruction">${step.instructions}</div>
                <div class="step-distance">${step.distance.text}</div>
            </div>
        `;
        directionsList.appendChild(stepDiv);
    });
}

function updateRestroomList(restrooms) {
    const restroomList = document.getElementById('restroom-list');
    restroomList.innerHTML = '<h3>Nearby Restrooms</h3>';

    if (restrooms.length === 0) {
        restroomList.innerHTML += '<p>No restrooms found nearby.</p>';
        return;
    }

    restrooms.slice(0, 5).forEach((restroom, index) => {
        const restroomDiv = document.createElement('div');
        restroomDiv.className = 'restroom-item';
        restroomDiv.innerHTML = `
            <h4>${restroom.name || 'Public Restroom'}</h4>
            <p>${restroom.street || 'Address not available'}</p>
            ${restroom.accessible ? '<span class=\"accessible-badge\">♿ Accessible</span>' : ''}
            <button class=\"route-btn\">Get Directions</button>
        `;
        
        // Add event listener to the button
        const routeBtn = restroomDiv.querySelector('.route-btn');
        routeBtn.addEventListener('click', () => {
            console.log('Get Directions (sidebar) clicked for:', restroom.name, restroom);
            if (userLocation) {
                // Always use google.maps.LatLng for userLocation
                const userLatLng = userLocation instanceof google.maps.LatLng
                    ? userLocation
                    : new google.maps.LatLng(userLocation.lat, userLocation.lng);
                showRouteToRestroom(userLatLng, restroom);
            } else {
                alert('Please set your starting location first by clicking on the map or using "Use My Location".');
            }
        });
        restroomList.appendChild(restroomDiv);
    });
}

 