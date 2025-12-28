declare global {
  interface Window {
    google: {
      maps: {
        DirectionsService: new () => google.maps.DirectionsService;
        DirectionsStatus: { OK: string };
        LatLng: new (lat: number, lng: number) => google.maps.LatLng;
        TravelMode: { DRIVING: google.maps.TravelMode };
      };
    };
  }
}

declare namespace google {
  namespace maps {
    interface DirectionsResult {
      routes: DirectionsRoute[];
    }

    interface DirectionsRoute {
      legs: DirectionsLeg[];
    }

    interface DirectionsLeg {
      distance?: { text: string; value: number };
      duration?: { text: string; value: number };
      steps: DirectionsStep[];
    }

    interface DirectionsStep {
      distance?: { text: string; value: number };
      duration?: { text: string; value: number };
      end_location: LatLng;
      instructions?: string;
    }

    interface LatLng {
      lat(): number;
      lng(): number;
    }

    enum TravelMode {
      DRIVING = "DRIVING",
    }

    interface DirectionsService {
      route(
        request: DirectionsRequest,
        callback: (result: DirectionsResult | null, status: string) => void
      ): void;
    }

    interface DirectionsRequest {
      origin: LatLng;
      destination: LatLng;
      travelMode: TravelMode;
    }
  }
}

export {};
