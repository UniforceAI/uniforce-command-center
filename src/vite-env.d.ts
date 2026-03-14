/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare namespace JSX {
  interface IntrinsicElements {
    "stripe-pricing-table": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        "pricing-table-id": string;
        "publishable-key": string;
        "client-reference-id"?: string;
        "customer-email"?: string;
      },
      HTMLElement
    >;
  }
}
