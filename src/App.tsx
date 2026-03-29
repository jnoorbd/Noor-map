/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, Polyline } from 'react-leaflet';
const { BaseLayer } = LayersControl;
import L from 'leaflet';
import { 
  Search, 
  MapPin, 
  Navigation, 
  Layers, 
  Menu, 
  X, 
  Star, 
  Clock, 
  Phone, 
  Globe, 
  ChevronRight,
  Utensils,
  Fuel,
  Hotel,
  Coffee,
  ShoppingBag,
  LocateFixed,
  ArrowLeftRight,
  Car,
  Bike,
  Footprints,
  ArrowLeft
} from 'lucide-react';
import { searchPlaces, getCoordinates } from './services/geminiService';
import { cn } from './lib/utils';

// Fix Leaflet marker icon issue using CDN
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Place {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  reviews?: number;
  lat: number;
  lng: number;
  url?: string;
  type?: string;
}

function MapController({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([23.8103, 90.4125]); // Dhaka default
  const [zoom, setZoom] = useState(13);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  // Directions state
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [route, setRoute] = useState<[number, number][]>([]);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'cycling'>('driving');
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setMapCenter([latitude, longitude]);
          setStartQuery('Your Location');
        },
        (error) => console.error("Error getting location:", error)
      );
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const query = overrideQuery || searchQuery;
    if (!query.trim()) return;

    setIsLoading(true);
    setIsSidebarOpen(true);
    setIsDirectionsMode(false);
    try {
      const result = await searchPlaces(query, userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined);
      
      // Extract places from grounding chunks
      const newPlaces: Place[] = result.groundingChunks
        .filter((chunk: any) => chunk.maps?.uri)
        .map((chunk: any, index: number) => {
          return {
            id: `place-${index}`,
            name: chunk.maps.title || "Unknown Place",
            url: chunk.maps.uri,
            lat: mapCenter[0] + (Math.random() - 0.5) * 0.02, // Simulated offset
            lng: mapCenter[1] + (Math.random() - 0.5) * 0.02,
          };
        });

      setPlaces(newPlaces);
      if (newPlaces.length > 0) {
        setMapCenter([newPlaces[0].lat, newPlaces[0].lng]);
        setZoom(15);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirections = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startQuery.trim() || !endQuery.trim()) return;

    setIsLoading(true);
    setIsSidebarOpen(true);
    try {
      let startCoords: { lat: number; lng: number } | null = null;
      if (startQuery === 'Your Location' && userLocation) {
        startCoords = { lat: userLocation[0], lng: userLocation[1] };
      } else {
        const start = await getCoordinates(startQuery);
        if (start) startCoords = { lat: start.lat, lng: start.lng };
      }

      const end = await getCoordinates(endQuery);
      if (!startCoords || !end) {
        alert("Could not find locations. Please try again.");
        return;
      }

      // Fetch route from OSRM
      const osrmMode = travelMode === 'driving' ? 'driving' : travelMode === 'walking' ? 'foot' : 'bicycle';
      const response = await fetch(`https://router.project-osrm.org/route/v1/${osrmMode}/${startCoords.lng},${startCoords.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        const coords = routeData.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
        setRoute(coords);
        setRouteInfo({
          distance: (routeData.distance / 1000).toFixed(1) + ' km',
          duration: Math.round(routeData.duration / 60) + ' min'
        });
        
        // Fit map to route
        const bounds = L.latLngBounds(coords);
        setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
        setZoom(12);
      }
    } catch (error) {
      console.error("Directions failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNearbySearch = (type: string) => {
    setSearchQuery(`${type} nearby`);
    handleSearch(undefined, `${type} nearby`);
  };

  const swapLocations = () => {
    const temp = startQuery;
    setStartQuery(endQuery);
    setEndQuery(temp);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden font-sans bg-gray-100">
      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-[1000] flex flex-col gap-2">
        <form 
          onSubmit={handleSearch}
          className="bg-white rounded-full shadow-lg flex items-center px-4 py-2 border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 transition-all"
        >
          <button type="button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-full">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <input
            type="text"
            placeholder="Search Noor Map"
            className="flex-1 bg-transparent border-none focus:outline-none px-2 text-gray-800"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="p-2 hover:bg-gray-100 rounded-full">
            <Search className="w-5 h-5 text-gray-600" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button 
            type="button" 
            onClick={() => {
              setIsDirectionsMode(true);
              setIsSidebarOpen(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-full text-blue-600"
          >
            <Navigation className="w-5 h-5" />
          </button>
        </form>

        {/* Quick Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { icon: Utensils, label: 'Restaurants' },
            { icon: Coffee, label: 'Coffee' },
            { icon: Hotel, label: 'Hotels' },
            { icon: ShoppingBag, label: 'Shopping' },
            { icon: Fuel, label: 'Gas' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => handleNearbySearch(item.label)}
              className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-md border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              <item.icon className="w-4 h-4 text-blue-600" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "absolute top-0 left-0 h-full bg-white z-[1001] transition-transform duration-300 shadow-2xl w-full md:w-96 flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {isDirectionsMode ? (
          <div className="flex flex-col h-full">
            <div className="bg-blue-600 p-4 text-white">
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setIsDirectionsMode(false)} className="p-1 hover:bg-blue-700 rounded-full">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 flex justify-around">
                  <button 
                    onClick={() => setTravelMode('driving')}
                    className={cn("p-2 rounded-lg transition-colors", travelMode === 'driving' ? "bg-blue-500" : "hover:bg-blue-500/50")}
                  >
                    <Car className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setTravelMode('cycling')}
                    className={cn("p-2 rounded-lg transition-colors", travelMode === 'cycling' ? "bg-blue-500" : "hover:bg-blue-500/50")}
                  >
                    <Bike className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setTravelMode('walking')}
                    className={cn("p-2 rounded-lg transition-colors", travelMode === 'walking' ? "bg-blue-500" : "hover:bg-blue-500/50")}
                  >
                    <Footprints className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-3 h-3 rounded-full border-2 border-white" />
                  <div className="w-0.5 h-8 bg-white/50 border-dashed border-l" />
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Choose starting point..."
                    className="w-full bg-blue-700/50 border-none rounded-md px-3 py-2 text-white placeholder:text-blue-200 focus:ring-1 focus:ring-white outline-none"
                    value={startQuery}
                    onChange={(e) => setStartQuery(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Choose destination..."
                    className="w-full bg-blue-700/50 border-none rounded-md px-3 py-2 text-white placeholder:text-blue-200 focus:ring-1 focus:ring-white outline-none"
                    value={endQuery}
                    onChange={(e) => setEndQuery(e.target.value)}
                  />
                </div>
                <button onClick={swapLocations} className="p-2 hover:bg-blue-700 rounded-full">
                  <ArrowLeftRight className="w-5 h-5 rotate-90" />
                </button>
              </div>
              
              <button 
                onClick={handleDirections}
                className="w-full mt-4 bg-white text-blue-600 font-bold py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Get Directions
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500 font-medium">Calculating route...</p>
                </div>
              ) : routeInfo ? (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-blue-600 font-bold text-2xl">{routeInfo.duration}</p>
                        <p className="text-gray-500 text-sm">{routeInfo.distance}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-600 font-medium text-sm">Fastest route</p>
                        <p className="text-gray-400 text-xs">via main roads</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-blue-600" /> Steps
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-600" />
                          <div className="w-0.5 flex-1 bg-gray-200" />
                        </div>
                        <p className="text-sm text-gray-700 pb-4">Start from {startQuery}</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-gray-400" />
                          <div className="w-0.5 flex-1 bg-gray-200" />
                        </div>
                        <p className="text-sm text-gray-700 pb-4">Head towards {endQuery}</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <MapPin className="w-4 h-4 text-red-600" />
                        </div>
                        <p className="text-sm font-bold text-gray-900">Arrive at destination</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Navigation className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Plan your trip</h3>
                  <p className="text-gray-500 mt-2">Enter start and end points to see the best route</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-bottom flex items-center justify-between">
          <h2 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <MapPin className="w-6 h-6" /> Noor Map
          </h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 font-medium">Finding places...</p>
            </div>
          ) : places.length > 0 ? (
            places.map((place) => (
              <div 
                key={place.id}
                onClick={() => {
                  setSelectedPlace(place);
                  setMapCenter([place.lat, place.lng]);
                  setZoom(17);
                }}
                className={cn(
                  "p-4 rounded-xl border border-gray-100 cursor-pointer transition-all hover:shadow-md",
                  selectedPlace?.id === place.id ? "bg-blue-50 border-blue-200" : "bg-white"
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900">{place.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <span className="text-orange-500 flex items-center">
                        <Star className="w-3 h-3 fill-current" /> 4.5
                      </span>
                      <span>(120 reviews)</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {place.address || "Dhaka, Bangladesh"}
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={`https://picsum.photos/seed/${place.name}/100/100`} alt={place.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                
                {selectedPlace?.id === place.id && (
                  <div className="mt-4 pt-4 border-t border-blue-100 space-y-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDirectionsMode(true);
                          setEndQuery(place.name);
                          setIsSidebarOpen(true);
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-full text-sm font-bold flex items-center justify-center gap-2"
                      >
                        <Navigation className="w-4 h-4" /> Directions
                      </button>
                      <button className="flex-1 border border-gray-300 py-2 rounded-full text-sm font-bold flex items-center justify-center gap-2">
                        <ShoppingBag className="w-4 h-4" /> Save
                      </button>
                    </div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-green-600 font-medium">Open</span>
                        <span className="text-gray-400">⋅ Closes 10 PM</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>+880 1234-567890</span>
                      </div>
                      {place.url && (
                        <a 
                          href={place.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-blue-600 hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          <span>View on Google Maps</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Search for a place</h3>
              <p className="text-gray-500 mt-2">Find restaurants, hotels, and more in Noor Map</p>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Map Container */}
      <div className="h-full w-full z-0">
        <MapContainer 
          center={mapCenter} 
          zoom={zoom} 
          className="h-full w-full"
          zoomControl={false}
        >
          <LayersControl position="bottomright">
            <BaseLayer checked name="Standard">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </BaseLayer>
            <BaseLayer name="Satellite (Terrain)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              />
            </BaseLayer>
          </LayersControl>
          <MapController center={mapCenter} zoom={zoom} />
          
          {route.length > 0 && (
            <Polyline 
              positions={route} 
              color="#2563eb" 
              weight={6} 
              opacity={0.8}
              lineJoin="round"
            />
          )}

          {places.map((place) => (
            <Marker 
              key={place.id} 
              position={[place.lat, place.lng]}
              eventHandlers={{
                click: () => {
                  setSelectedPlace(place);
                  setIsSidebarOpen(true);
                }
              }}
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-gray-900 m-0">{place.name}</h4>
                  <p className="text-xs text-gray-500 m-0 mt-1">Click for details</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {userLocation && (
            <Marker 
              position={userLocation}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            >
              <Popup>You are here</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-3">
        <button 
          onClick={() => {
            if (userLocation) {
              setMapCenter(userLocation);
              setZoom(15);
            }
          }}
          className="bg-white p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
          title="My Location"
        >
          <LocateFixed className="w-6 h-6" />
        </button>
        <div className="flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <button 
            onClick={() => setZoom(prev => Math.min(prev + 1, 18))}
            className="p-3 hover:bg-gray-50 text-gray-700 border-b border-gray-100 font-bold text-xl"
          >
            +
          </button>
          <button 
            onClick={() => setZoom(prev => Math.max(prev - 1, 3))}
            className="p-3 hover:bg-gray-50 text-gray-700 font-bold text-xl"
          >
            −
          </button>
        </div>
        <button className="bg-white p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
          <Layers className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

