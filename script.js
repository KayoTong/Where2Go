// script.js
console.log('Where2Go frontend loaded. Ready for future features!');

// Only run advanced map logic on finder.html
if (window.location.pathname.endsWith('finder.html')) {
    let map;
    let overpassMarkers = [];
    let userMarker = null;
    let routeLine = null;
    let lastUserLocation = null;
    let lastRestroomData = [];
    let lastRadius = 1000;
    let lastAccessible = 'any';

    window.addEventListener('DOMContentLoaded', () => {
        // Default center: New York City
        const nycLat = 40.7128;
        const nycLon = -74.0060;
        map = L.map('map').setView([nycLat, nycLon], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Custom toilet icon
        const toiletIcon = L.icon({
            iconUrl: 'toilet.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
        // Custom user icon
        const userIcon = L.icon({
            iconUrl: 'https://img.icons8.com/fluency/48/marker-storm.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        // Elements
        const searchBtn = document.getElementById('search-btn');
        const addressInput = document.getElementById('address-input');
        const myLocBtn = document.getElementById('myloc-btn');
        const distanceFilter = document.getElementById('distance-filter');
        const accessibleFilter = document.getElementById('accessible-filter');
        const restroomListDiv = document.getElementById('restroom-list');
        const mapLocateBtn = document.getElementById('map-locate-btn');

        // Helper: Calculate distance (Haversine)
        function haversine(lat1, lon1, lat2, lon2) {
            const R = 6371e3; // metres
            const φ1 = lat1 * Math.PI/180;
            const φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2-lat1) * Math.PI/180;
            const Δλ = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c; // in metres
        }

        // Fetch all public toilets in NYC on page load
        fetchRefugeRestrooms(nycLat, nycLon, lastRadius / 1609.34);

        // Address search functionality
        if (searchBtn && addressInput) {
            searchBtn.addEventListener('click', () => {
                const address = addressInput.value.trim();
                if (!address) return;
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
                    .then(res => res.json())
                    .then(results => {
                        if (results && results.length > 0) {
                            const lat = parseFloat(results[0].lat);
                            const lon = parseFloat(results[0].lon);
                            map.setView([lat, lon], 15);
                            if (userMarker) {
                                userMarker.setLatLng([lat, lon]);
                            } else {
                                userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map).bindPopup('Your Location').openPopup();
                            }
                            lastUserLocation = [lat, lon];
                            if (routeLine) {
                                map.removeLayer(routeLine);
                                routeLine = null;
                            }
                            fetchRefugeRestrooms(lat, lon, lastRadius / 1609.34);
                        } else {
                            alert('Location not found.');
                        }
                    })
                    .catch(() => alert('Error searching for location.'));
            });
        }
        // Use My Location button functionality
        if (myLocBtn) {
            myLocBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    alert('Geolocation is not supported by your browser.');
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        map.setView([lat, lon], 15);
                        if (userMarker) {
                            userMarker.setLatLng([lat, lon]);
                        } else {
                            userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map).bindPopup('Your Location').openPopup();
                        }
                        lastUserLocation = [lat, lon];
                        if (routeLine) {
                            map.removeLayer(routeLine);
                            routeLine = null;
                        }
                        fetchRefugeRestrooms(lat, lon, lastRadius / 1609.34);
                    },
                    () => {
                        alert('Unable to retrieve your location.');
                    }
                );
            });
        }
        // Filter functionality
        if (distanceFilter) {
            distanceFilter.addEventListener('change', () => {
                lastRadius = parseInt(distanceFilter.value, 10);
                if (lastUserLocation) {
                    fetchRefugeRestrooms(lastUserLocation[0], lastUserLocation[1], lastRadius / 1609.34);
                } else {
                    fetchRefugeRestrooms(nycLat, nycLon, lastRadius / 1609.34);
                }
            });
        }
        if (accessibleFilter) {
            accessibleFilter.addEventListener('change', () => {
                lastAccessible = accessibleFilter.value;
                // Refuge API does not support accessible filter directly, so filter in render
                renderRefugeRestroomList();
            });
        }
        if (mapLocateBtn) {
            mapLocateBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    alert('Geolocation is not supported by your browser.');
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        map.setView([lat, lon], 15);
                        if (userMarker) {
                            userMarker.setLatLng([lat, lon]);
                        } else {
                            userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map).bindPopup('Your Location').openPopup();
                        }
                        lastUserLocation = [lat, lon];
                        if (routeLine) {
                            map.removeLayer(routeLine);
                            routeLine = null;
                        }
                        fetchRefugeRestrooms(lat, lon, lastRadius / 1609.34);
                    },
                    () => {
                        alert('Unable to retrieve your location.');
                    }
                );
            });
        }

        // Remove the floating button from the HTML if present
        const oldBtn = document.getElementById('map-locate-btn');
        if (oldBtn) oldBtn.remove();

        // Add a custom Leaflet control for location
        const LocateControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                container.style.background = '#fff';
                container.style.width = '30px';
                container.style.height = '30px';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.cursor = 'pointer';
                container.title = 'Go to my location';
                container.style.border = '1px solid #bbb';
                container.style.borderTop = 'none';
                container.style.borderRadius = '0 0 4px 4px';
                container.style.marginTop = '0';
                container.style.padding = '0';
                container.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="7"/>
                        <line x1="12" y1="5" x2="12" y2="8"/>
                        <line x1="12" y1="16" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="8" y2="12"/>
                        <line x1="16" y1="12" x2="19" y2="12"/>
                    </svg>
                `;
                L.DomEvent.on(container, 'click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    L.DomEvent.preventDefault(e);
                    if (!navigator.geolocation) {
                        alert('Geolocation is not supported by your browser.');
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const lat = position.coords.latitude;
                            const lon = position.coords.longitude;
                            map.setView([lat, lon], 15);
                            if (userMarker) {
                                userMarker.setLatLng([lat, lon]);
                            } else {
                                userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map).bindPopup('Your Location').openPopup();
                            }
                            lastUserLocation = [lat, lon];
                            if (routeLine) {
                                map.removeLayer(routeLine);
                                routeLine = null;
                            }
                            fetchRefugeRestrooms(lat, lon, lastRadius / 1609.34);
                        },
                        () => {
                            alert('Unable to retrieve your location.');
                        }
                    );
                });
                return container;
            }
        });
        map.addControl(new LocateControl());

        function fetchRefugeRestrooms(lat, lon, radiusMiles) {
            overpassMarkers.forEach(marker => map.removeLayer(marker));
            overpassMarkers = [];
            // Refuge Restrooms API: radius is not supported, so we fetch up to 100 restrooms and filter by distance
            const url = `https://www.refugerestrooms.org/api/v1/restrooms/by_location?lat=${lat}&lng=${lon}&per_page=100`;
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    // Filter by radius (in miles)
                    const filtered = data.filter(el => {
                        if (!el.latitude || !el.longitude) return false;
                        const d = haversine(lat, lon, parseFloat(el.latitude), parseFloat(el.longitude));
                        return d <= (radiusMiles * 1609.34);
                    });
                    lastRestroomData = filtered;
                    renderRefugeRestroomList();
                    if (filtered.length > 0) {
                        filtered.forEach(el => {
                            const restroomName = el.name || 'Restroom';
                            const address = el.street || '';
                            const accessible = el.accessible ? '♿' : '';
                            const unisex = el.unisex ? 'Unisex' : '';
                            const directions = el.directions || '';
                            const comment = el.comment || '';
                            const upvotes = el.upvote || 0;
                            const downvotes = el.downvote || 0;
                            const rating = (upvotes + downvotes > 0) ? Math.round((upvotes / (upvotes + downvotes)) * 100) : null;
                            // Distance
                            let distanceText = '';
                            if (lastUserLocation) {
                                const d = haversine(lastUserLocation[0], lastUserLocation[1], parseFloat(el.latitude), parseFloat(el.longitude));
                                distanceText = ` (${(d/1609.34).toFixed(2)} mi)`;
                            }
                            // Marker
                            const marker = L.marker([parseFloat(el.latitude), parseFloat(el.longitude)], { icon: toiletIcon })
                                .addTo(map)
                                .bindPopup(`<strong>${restroomName}</strong><br>${address}<br>${accessible} ${unisex}<br>${directions}<br>${comment}<br>${rating !== null ? `<span style='color:${rating >= 70 ? 'green' : rating >= 40 ? 'orange' : 'red'};'>${rating}% positive</span>` : 'Not yet rated'}<br>Lat: ${el.latitude}, Lon: ${el.longitude}`);
                            marker.bindTooltip(`<strong>${restroomName}</strong>${distanceText}`, {direction: 'top', offset: [0, -8]});
                            marker.on('click', () => {
                                if (lastUserLocation) {
                                    drawRoute(lastUserLocation, [parseFloat(el.latitude), parseFloat(el.longitude)]);
                                }
                            });
                            overpassMarkers.push(marker);
                        });
                    } else {
                        if (restroomListDiv) restroomListDiv.innerHTML = '<p>No restrooms found near this location.</p>';
                    }
                })
                .catch(() => {
                    if (restroomListDiv) restroomListDiv.innerHTML = '<p style="color:red;">Error fetching public restrooms.</p>';
                });
        }

        function renderRefugeRestroomList() {
            if (!restroomListDiv) return;
            if (!lastRestroomData || lastRestroomData.length === 0) {
                restroomListDiv.innerHTML = '<p>No restrooms found.</p>';
                return;
            }
            let html = '<h3>Nearby Restrooms</h3><ul class="restroom-list">';
            lastRestroomData.forEach(el => {
                if (lastAccessible === 'yes' && !el.accessible) return;
                const restroomName = el.name || 'Restroom';
                const address = el.street || '';
                const accessible = el.accessible ? '♿' : '';
                const unisex = el.unisex ? 'Unisex' : '';
                const upvotes = el.upvote || 0;
                const downvotes = el.downvote || 0;
                const rating = (upvotes + downvotes > 0) ? Math.round((upvotes / (upvotes + downvotes)) * 100) : null;
                let distance = '';
                if (lastUserLocation && el.latitude && el.longitude) {
                    const d = haversine(lastUserLocation[0], lastUserLocation[1], parseFloat(el.latitude), parseFloat(el.longitude));
                    distance = ` (${(d/1609.34).toFixed(2)} mi)`;
                }
                let ratingHtml = '';
                if (rating !== null) {
                    ratingHtml = `<span style='color:${rating >= 70 ? 'green' : rating >= 40 ? 'orange' : 'red'}; font-weight:bold;'>${rating}% positive</span>`;
                } else {
                    ratingHtml = `<span style='color:#444; background:#eee; border-radius:4px; padding:2px 8px;'>Not yet rated</span>`;
                }
                html += `<li><strong>${restroomName}</strong>${distance}<br>${address} ${accessible} ${unisex}<br>${ratingHtml}</li>`;
            });
            html += '</ul>';
            restroomListDiv.innerHTML = html;
        }

        function drawRoute(start, end) {
            if (routeLine) {
                map.removeLayer(routeLine);
                routeLine = null;
            }
            const url = `https://router.project-osrm.org/route/v1/walking/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (data.routes && data.routes.length > 0) {
                        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                        routeLine = L.polyline(coords, { color: '#267373', weight: 5, opacity: 0.8 }).addTo(map);
                        map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
                    } else {
                        alert('No route found.');
                    }
                })
                .catch(() => alert('Error fetching route.'));
        }
    });
} 