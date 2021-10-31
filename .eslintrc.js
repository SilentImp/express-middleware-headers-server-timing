module.exports = {
  env: {
    browser: false,
    node: true,
    commonjs: true,
    es2021: true,
    'jest/globals': true
  },
  extends: [
    'standard'
  ],
  settings: {
    jest: {
      version: 27
    }
  },
  parserOptions: {
    ecmaVersion: 12
  },
  plugins: ['jest'],
  rules: {
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error'
  }
}
