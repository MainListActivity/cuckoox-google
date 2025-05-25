// Fix: The reference below is standard for Vite projects.
/// <reference types="vite/client" />
// The error "Cannot find type definition file for 'vite/client'" on the line above
// usually indicates that Vite is not correctly installed or TypeScript's typeRoots
// are misconfigured in tsconfig.json. This line is presumed to be correct and necessary
// for Vite-specific features like `import.meta.env`.

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