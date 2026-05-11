export {};

declare global {
  namespace google {
    namespace maps {
      interface LatLngAltitudeLiteral {
        lat: number;
        lng: number;
        altitude: number;
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
