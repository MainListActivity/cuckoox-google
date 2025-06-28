/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SURREALDB_URL: string;
  readonly VITE_SURREALDB_NAMESPACE: string;
  readonly VITE_SURREALDB_DATABASE: string;
  readonly VITE_OIDC_AUTHORITY: string;
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_REDIRECT_URI: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// If you use CSS Modules:
// declare module '*.module.css' {
//   const classes: { readonly [key: string]: string };
//   export default classes;
// }

// For loading image assets with import statements
declare module '*.png' {
  const value: string;
  export default value;
}
declare module '*.jpg' {
  const value: string;
  export default value;
}
declare module '*.jpeg' {
  const value: string;
  export default value;
}
declare module '*.gif' {
  const value: string;
  export default value;
}
declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

// Add other global type declarations as needed for your project