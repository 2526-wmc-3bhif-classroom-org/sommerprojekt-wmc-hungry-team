<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { BusRoute, BusRouteApiResponse, RouteLeg, BusStop } from '~/types/bus';
import { formatTime, formatDuration, getRouteTypeLabel } from '~/types/bus';

// Hardcoded test coordinates (two distant stops in Linz area)
const START_LAT = 48.34690658;
const START_LON = 14.29262736;
const START_NAME = "Linz/Donau Jäger im Tal";

const END_LAT = 48.21154009;
const END_LON = 14.32905405;
const END_NAME = "Rohrbach b.Linz Wambacherberg";

const DEPARTURE_TIME = "08:00:00";
const MAX_TRANSFERS = 5;

// Reactive state
const routeData = ref<BusRoute | null>(null);
const rawApiData = ref<BusRouteApiResponse[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Transform API response into display-ready route data
function transformRouteData(apiData: BusRouteApiResponse[]): BusRoute {
  if (!apiData || apiData.length === 0) {
    throw new Error('No route data to transform');
  }
  
  // Each row in the API response represents one leg of the journey
  const legs: RouteLeg[] = apiData.map((leg, index) => {
    const startStop: BusStop = {
      id: leg.boarded_at_stop_id,
      name: leg.boarded_at_stop_name,
      time: formatTime(leg.departure_time),
      isTransfer: index > 0 // First leg starts at origin, others start at transfer
    };
    
    const endStop: BusStop = {
      id: leg.alight_at_stop_id,
      name: leg.alight_at_stop_name,
      time: formatTime(leg.arrival_time),
      isTransfer: !!leg.transfer_stop_name // Is a transfer if next leg exists
    };
    
    return {
      routeName: leg.route_short_name,
      routeFullName: leg.route_long_name,
      routeType: leg.route_type,
      startStop,
      endStop,
      departureTime: formatTime(leg.departure_time),
      arrivalTime: formatTime(leg.arrival_time),
      stops: [startStop, endStop] // For now, just start and end (can expand later)
    };
  });
  
  // Calculate summary data
  const firstLeg = apiData[0];
  const transferCount = apiData[0].legs - 1;
  
  return {
    legs,
    totalDuration: formatDuration(firstLeg.total_duration),
    transferCount,
    finalArrival: formatTime(apiData[apiData.length - 1].arrival_time),
    startLocation: START_NAME,
    endLocation: END_NAME
  };
}

// Fetch route from backend API
async function fetchRoute() {
  loading.value = true;
  error.value = null;
  
  try {
    const params = new URLSearchParams({
      lat_a: START_LAT.toString(),
      lon_a: START_LON.toString(),
      lat_b: END_LAT.toString(),
      lon_b: END_LON.toString(),
      departure_time: DEPARTURE_TIME,
      max_transfers: MAX_TRANSFERS.toString()
    });
    
    const response = await fetch(`http://localhost:3002/api/bus/route?${params}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data: BusRouteApiResponse[] = await response.json();
    
    if (!data || data.length === 0) {
      error.value = 'No route found between these locations';
      return;
    }
    
    // Store raw API data
    rawApiData.value = data;
    console.log('Route API response:', data);
    
    // Transform data for display
    routeData.value = transformRouteData(data);
    console.log('Transformed route data:', routeData.value);
    
  } catch (err) {
    console.error('Error fetching route:', err);
    error.value = err instanceof Error ? err.message : 'Failed to fetch route';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  console.log('Bus widget mounted, fetching route...');
  fetchRoute();
});
</script>

<template>
  <div class="bus-widget bg-white rounded-lg shadow-md p-6 max-w-md">
    <!-- Widget title -->
    <h2 v-if="routeData" class="text-2xl font-bold mb-6 text-gray-800">
      Route {{ routeData?.legs[0]?.routeName || 'Bus' }}
    </h2>
    
    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <div class="mt-4 text-gray-600">Loading route...</div>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <div class="text-red-600 mb-4">{{ error }}</div>
      <button 
        @click="fetchRoute" 
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        Retry
      </button>
    </div>
    
    <!-- Route flowchart -->
    <div v-else-if="routeData" class="route-flowchart">
      <!-- Vertical flowchart container -->
      <div class="relative pl-12 pr-4 py-4">
        <!-- Vertical blue line (absolute positioned) -->
        <div class="absolute left-6 top-0 bottom-0 w-1 bg-blue-500"></div>
        
        <!-- Route legs will be rendered here -->
        <div class="space-y-8">
          <template v-for="(leg, legIndex) in routeData.legs" :key="legIndex">
            <!-- Start stop of this leg -->
            <div class="relative flex items-center">
              <!-- Stop circle -->
              <div 
                class="absolute left-[-1.75rem] w-4 h-4 rounded-full border-2 border-blue-500 bg-white z-10"
                :class="{ 'w-6 h-6 bg-blue-500 left-[-2.25rem]': leg.startStop.isTransfer }"
              ></div>
              
              <!-- Stop info -->
              <div class="flex justify-between items-center w-full">
                <div class="flex-1">
                  <div class="text-sm font-semibold text-gray-800">{{ leg.startStop.name }}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ getRouteTypeLabel(leg.routeType) }} {{ leg.routeName }}
                  </div>
                </div>
                <div class="text-sm font-medium text-gray-700 ml-4">
                  {{ leg.startStop.time }}
                </div>
              </div>
            </div>
            
            <!-- End stop of this leg -->
            <div class="relative flex items-center">
              <!-- Stop circle -->
              <div 
                class="absolute left-[-1.75rem] w-4 h-4 rounded-full border-2 border-blue-500 bg-white z-10"
                :class="{ 'w-6 h-6 bg-blue-500 left-[-2.25rem]': leg.endStop.isTransfer }"
              ></div>
              
              <!-- Stop info -->
              <div class="flex justify-between items-center w-full">
                <div class="flex-1">
                  <div class="text-sm font-semibold text-gray-800">{{ leg.endStop.name }}</div>
                  <div v-if="leg.endStop.isTransfer" class="text-xs text-blue-600 font-medium mt-1">
                    Transfer
                  </div>
                </div>
                <div class="text-sm font-medium text-gray-700 ml-4">
                  {{ leg.endStop.time }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      
      <!-- Summary section -->
      <div class="mt-8 pt-6 border-t border-gray-200">
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <div class="text-xs text-gray-500 uppercase mb-1">Fahrzeit</div>
            <div class="text-lg font-bold text-gray-800">{{ routeData.totalDuration }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 uppercase mb-1">Umstiege</div>
            <div class="text-lg font-bold text-gray-800">{{ routeData.transferCount }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 uppercase mb-1">Ankunft</div>
            <div class="text-lg font-bold text-gray-800">{{ routeData.finalArrival }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty state -->
    <div v-else class="text-center py-12 text-gray-500">
      No route data available
    </div>
  </div>
</template>
