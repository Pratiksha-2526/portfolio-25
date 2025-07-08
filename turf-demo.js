// Initialize all maps when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Isochrone Map
    const isochroneMap = L.map('isochrone-map').setView([27.7172, 85.3240], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(isochroneMap);
    
    // Optimal Location Map
    const optimalMap = L.map('optimal-map').setView([27.7172, 85.3240], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(optimalMap);
    
    // Analysis Map
    const analysisMap = L.map('analysis-map').setView([27.7172, 85.3240], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(analysisMap);
    
    // Initialize all tools
    initIsochroneTool(isochroneMap);
    initOptimalLocationTool(optimalMap);
    initSpatialAnalysisTool(analysisMap);
    
    // Update range value displays
    document.getElementById('isochrone-time').addEventListener('input', function() {
        document.getElementById('time-value').textContent = this.value;
    });
    
    document.getElementById('isochrone-speed').addEventListener('input', function() {
        document.getElementById('speed-value').textContent = this.value;
    });
});

// 1. Isochrone Mapping Tool
function initIsochroneTool(map) {
    let isochroneLayer = null;
    let centerMarker = null;
    
    // Parse initial center point
    const centerInput = document.getElementById('isochrone-center').value.split(',');
    let centerPoint = [parseFloat(centerInput[0]), parseFloat(centerInput[1])];
    
    // Add initial marker
    centerMarker = L.marker(centerPoint).addTo(map)
        .bindPopup("Center point for isochrone")
        .openPopup();
    
    // Generate isochrone button
    document.getElementById('generate-isochrone').addEventListener('click', function() {
        const timeMinutes = parseInt(document.getElementById('isochrone-time').value);
        const speedKmH = parseInt(document.getElementById('isochrone-speed').value);
        
        // Clear previous isochrone
        if (isochroneLayer) {
            map.removeLayer(isochroneLayer);
        }
        
        // Calculate distance that can be traveled in given time at given speed
        const distanceKm = (speedKmH * timeMinutes) / 60;
        
        // Create buffer around point
        const point = turf.point([centerPoint[1], centerPoint[0]]);
        const buffered = turf.buffer(point, distanceKm, {units: 'kilometers'});
        
        // Style and add to map
        isochroneLayer = L.geoJSON(buffered, {
            style: {
                fillColor: '#3498db',
                fillOpacity: 0.5,
                color: '#2980b9',
                weight: 2
            }
        }).addTo(map);
        
        // Fit bounds to show both marker and isochrone
        const bounds = isochroneLayer.getBounds();
        map.fitBounds(bounds);
    });
    
    // Update center point when input changes
    document.getElementById('isochrone-center').addEventListener('change', function() {
        const newCenter = this.value.split(',');
        if (newCenter.length === 2 && !isNaN(newCenter[0]) && !isNaN(newCenter[1])) {
            centerPoint = [parseFloat(newCenter[0]), parseFloat(newCenter[1])];
            map.setView(centerPoint, 12);
            
            // Update marker
            if (centerMarker) {
                map.removeLayer(centerMarker);
            }
            centerMarker = L.marker(centerPoint).addTo(map)
                .bindPopup("Center point for isochrone")
                .openPopup();
        }
    });
}

// 2. Optimal Location Finder Tool
function initOptimalLocationTool(map) {
    const points = [];
    let pointLayer = L.layerGroup().addTo(map);
    let optimalMarker = null;
    let linesLayer = L.layerGroup().addTo(map);
    
    // Add points on click
    map.on('click', function(e) {
        const newPoint = e.latlng;
        points.push(newPoint);
        
        // Add marker for the point
        L.marker(newPoint, {
            icon: L.divIcon({
                className: 'point-marker',
                html: '<div class="marker-inner"></div>',
                iconSize: [12, 12]
            })
        }).addTo(pointLayer);
        
        // Clear previous optimal location
        if (optimalMarker) {
            map.removeLayer(optimalMarker);
            linesLayer.clearLayers();
        }
    });
    
    // Find optimal location button
    document.getElementById('find-optimal').addEventListener('click', function() {
        if (points.length < 2) {
            document.getElementById('optimal-result').innerHTML = 
                '<p class="error">Please add at least 2 points to find optimal location.</p>';
            return;
        }
        
        // Convert points to Turf format
        const turfPoints = points.map(p => turf.point([p.lng, p.lat]));
        const pointsFeatureCollection = turf.featureCollection(turfPoints);
        
        // Calculate centroid (mean center)
        const centroid = turf.center(pointsFeatureCollection);
        
        // Calculate median center (minimizes distance to all points)
        const medianCenter = turf.centerMedian(pointsFeatureCollection);
        
        // Display results
        const centroidDistance = calculateTotalDistance(centroid, turfPoints);
        const medianDistance = calculateTotalDistance(medianCenter, turfPoints);
        
        document.getElementById('optimal-result').innerHTML = `
            <h4>Optimal Location Found</h4>
            <p><strong>Mean Center:</strong> ${centroid.geometry.coordinates[1].toFixed(4)}, ${centroid.geometry.coordinates[0].toFixed(4)}</p>
            <p><strong>Total Distance:</strong> ${centroidDistance.toFixed(2)} km</p>
            <p><strong>Median Center:</strong> ${medianCenter.geometry.coordinates[1].toFixed(4)}, ${medianCenter.geometry.coordinates[0].toFixed(4)}</p>
            <p><strong>Total Distance:</strong> ${medianDistance.toFixed(2)} km</p>
        `;
        
        // Add markers to map
        if (optimalMarker) {
            map.removeLayer(optimalMarker);
        }
        
        optimalMarker = L.layerGroup();
        
        // Add mean center (blue)
        L.marker([centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]], {
            icon: L.divIcon({
                className: 'optimal-marker mean-center',
                html: '<div class="marker-inner"></div>',
                iconSize: [20, 20]
            })
        }).bindPopup("Mean Center (Centroid)").addTo(optimalMarker);
        
        // Add median center (red)
        L.marker([medianCenter.geometry.coordinates[1], medianCenter.geometry.coordinates[0]], {
            icon: L.divIcon({
                className: 'optimal-marker median-center',
                html: '<div class="marker-inner"></div>',
                iconSize: [20, 20]
            })
        }).bindPopup("Median Center (Minimizes Distance)").addTo(optimalMarker);
        
        optimalMarker.addTo(map);
        
        // Draw lines from median center to all points
        linesLayer.clearLayers();
        turfPoints.forEach(turfPoint => {
            const line = turf.lineString([
                [medianCenter.geometry.coordinates[0], medianCenter.geometry.coordinates[1]],
                [turfPoint.geometry.coordinates[0], turfPoint.geometry.coordinates[1]]
            ]);
            
            L.geoJSON(line, {
                style: {
                    color: '#e74c3c',
                    weight: 2,
                    dashArray: '5, 5'
                }
            }).addTo(linesLayer);
        });
        
        // Fit bounds to show all points and optimal locations
        const allPoints = [...points];
        allPoints.push({
            lat: centroid.geometry.coordinates[1],
            lng: centroid.geometry.coordinates[0]
        });
        allPoints.push({
            lat: medianCenter.geometry.coordinates[1],
            lng: medianCenter.geometry.coordinates[0]
        });
        
        map.fitBounds(L.latLngBounds(allPoints).pad(0.1));
    });
    
    // Clear points button
    document.getElementById('clear-points').addEventListener('click', function() {
        points.length = 0;
        pointLayer.clearLayers();
        if (optimalMarker) {
            map.removeLayer(optimalMarker);
            optimalMarker = null;
        }
        linesLayer.clearLayers();
        document.getElementById('optimal-result').innerHTML = '';
    });
    
    // Helper function to calculate total distance from a point to all other points
    function calculateTotalDistance(center, points) {
        return points.reduce((total, point) => {
            const distance = turf.distance(center, point, {units: 'kilometers'});
            return total + distance;
        }, 0);
    }
}

// 3. Spatial Correlation Analysis Tool
function initSpatialAnalysisTool(map) {
    // Sample datasets (in a real app, these would be loaded from external files)
    const healthcareFacilities = turf.randomPoint(15, {
        bbox: [85.2, 27.6, 85.4, 27.8]
    });
    
    const populationCenters = turf.randomPoint(20, {
        bbox: [85.2, 27.6, 85.4, 27.8]
    });
    
    // Add to map with different styles
    const healthcareLayer = L.geoJSON(healthcareFacilities, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 8,
                fillColor: "#e74c3c",
                color: "#c0392b",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).bindPopup("Healthcare Facility");
        }
    }).addTo(map);
    
    const populationLayer = L.geoJSON(populationCenters, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: "#3498db",
                color: "#2980b9",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).bindPopup("Population Center");
        }
    }).addTo(map);
    
    // Run analysis button
    document.getElementById('run-analysis').addEventListener('click', function() {
        // Calculate colocation quotient
        const distanceThreshold = 2; // km
        const cq = calculateColocationQuotient(healthcareFacilities, populationCenters, distanceThreshold);
        
        // Display results
        document.getElementById('cq-value').textContent = cq.toFixed(2);
        
        let interpretation = "";
        if (cq > 1.2) {
            interpretation = "Strong positive colocation (healthcare facilities tend to be near population centers)";
        } else if (cq > 0.8) {
            interpretation = "Moderate colocation (some spatial association)";
        } else {
            interpretation = "Weak or negative colocation (little spatial association)";
        }
        
        document.getElementById('cq-interpretation').textContent = interpretation;
        
        // Highlight pairs within threshold distance
        highlightProximatePairs(healthcareFacilities, populationCenters, distanceThreshold);
    });
    
    // Function to calculate colocation quotient
    function calculateColocationQuotient(setA, setB, distanceThreshold) {
        let observedPairs = 0;
        let totalPossiblePairs = 0;
        
        // Count pairs within threshold distance
        setA.features.forEach(pointA => {
            setB.features.forEach(pointB => {
                const distance = turf.distance(pointA, pointB, {units: 'kilometers'});
                if (distance <= distanceThreshold) {
                    observedPairs++;
                }
                totalPossiblePairs++;
            });
        });
        
        // Calculate expected proportion based on area
        const bbox = turf.bbox(setA);
        const area = turf.area(turf.bboxPolygon(bbox)) / 1000000; // in sq km
        const expectedProportion = (Math.PI * Math.pow(distanceThreshold, 2)) / area;
        
        // Avoid division by zero
        if (expectedProportion === 0 || totalPossiblePairs === 0) {
            return 0;
        }
        
        const observedProportion = observedPairs / totalPossiblePairs;
        return observedProportion / expectedProportion;
    }
    
    // Function to highlight proximate pairs
    function highlightProximatePairs(setA, setB, distanceThreshold) {
        const highlightLayer = L.layerGroup().addTo(map);
        
        setA.features.forEach(pointA => {
            setB.features.forEach(pointB => {
                const distance = turf.distance(pointA, pointB, {units: 'kilometers'});
                if (distance <= distanceThreshold) {
                    const line = turf.lineString([
                        [pointA.geometry.coordinates[0], pointA.geometry.coordinates[1]],
                        [pointB.geometry.coordinates[0], pointB.geometry.coordinates[1]]
                    ]);
                    
                    L.geoJSON(line, {
                        style: {
                            color: '#27ae60',
                            weight: 2,
                            opacity: 0.7
                        }
                    }).addTo(highlightLayer);
                }
            });
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            map.removeLayer(highlightLayer);
        }, 5000);
    }
}