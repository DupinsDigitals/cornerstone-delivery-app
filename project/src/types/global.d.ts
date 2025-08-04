// Global type definitions for Google Maps API
declare global {
  interface Window {
    google: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: google.maps.places.AutocompleteOptions
          ) => google.maps.places.Autocomplete;
        };
      };
    };
  }
}

declare namespace google {
  namespace maps {
    namespace places {
      interface AutocompleteOptions {
        types?: string[];
        componentRestrictions?: {
          country: string | string[];
        };
        fields?: string[];
      }

      interface Autocomplete {
        addListener(eventName: string, handler: () => void): void;
        getPlace(): {
          formatted_address?: string;
          address_components?: any[];
          geometry?: any;
        };
      }
    }
  }
}

export {};