import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler advisories: reported, but not build-breaking. Correctness rules (rules-of-hooks, …) stay errors.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/incompatible-library': 'off',
    },
  },
  { ignores: ['.next/**', '.next-dev/**', 'api/**', 'docs/**', 'e2e/**', 'lib/api-types.ts', 'public/**', 'next-env.d.ts'] },
]

export default config
