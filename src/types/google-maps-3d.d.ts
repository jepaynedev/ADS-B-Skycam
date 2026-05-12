export {};

declare global {
  namespace google {
    namespace maps {
      interface LatLngAltitudeLiteral {
        lat: number;
        lng: number;
        altitude: number;
      }

      interface LatLngLiteral {
        lat: number;
        lng: number;
      }

      class Point {
        constructor(x: number, y: number);
        x: number;
        y: number;
      }

      interface Symbol {
        path: string;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeWeight?: number;
        rotation?: number;
        scale?: number;
        anchor?: Point;
      }

      interface MapOptions {
        center?: LatLngLiteral;
        zoom?: number;
        disableDefaultUI?: boolean;
        gestureHandling?: string;
        mapTypeId?: string;
        clickableIcons?: boolean;
      }

      class Map {
        constructor(element: HTMLElement, options?: MapOptions);
        setCenter(center: LatLngLiteral): void;
        panTo(center: LatLngLiteral): void;
        getZoom(): number | undefined;
        setZoom(zoom: number): void;
        addListener(eventName: string, callback: () => void): void;
      }

      interface MarkerOptions {
        position?: LatLngLiteral;
        map?: Map;
        icon?: Symbol;
        opacity?: number;
      }

      class Marker {
        constructor(options?: MarkerOptions);
        setPosition(position: LatLngLiteral): void;
        setIcon(icon: Symbol): void;
        setMap(map: Map | null): void;
        setOpacity(opacity: number): void;
      }

      interface PolylineOptions {
        path?: LatLngLiteral[];
        strokeColor?: string;
        strokeWeight?: number;
        strokeOpacity?: number;
        map?: Map;
      }

      class Polyline {
        constructor(options?: PolylineOptions);
        setPath(path: LatLngLiteral[]): void;
        setMap(map: Map | null): void;
      }

      namespace event {
        function trigger(target: Map, eventName: string): void;
        function addListener(target: Map, eventName: string, callback: () => void): void;
      }

      namespace maps3d {
        interface CameraOptions {
          center?: google.maps.LatLngAltitudeLiteral;
          range?: number;
          tilt?: number;
          heading?: number;
        }

        interface FlyCameraOptions {
          endCamera: CameraOptions;
          durationMillis?: number;
        }

        class Map3DElement extends HTMLElement {
          center: google.maps.LatLngAltitudeLiteral;
          range: number;
          tilt: number;
          heading: number;
          flyCameraTo(options: FlyCameraOptions): void;
        }
      }
    }
  }

  namespace JSX {
    interface IntrinsicElements {
      'gmp-map-3d': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
