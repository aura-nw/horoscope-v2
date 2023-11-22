module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    ecmaVersion: 2021, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
  ],
  root: true,
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    // 'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  rules: {
    eqeqeq: 2, // error
    // 'no-underscore-dangle' : ['error', {allowAfterThis: true}],
    'no-underscore-dangle': ['off'],
    // 'max-len': ["error", { "code": 120 ,"ignoreComments": true  }],
    'class-methods-use-this': 'off',

    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
    // 'newline-per-chained-call': 'error',
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
    // TODO: remove rules quotes and semi, should be in prettier config. Cannot do it for now, as wrong nvim config
    '@typescript-eslint/quotes': [
      'error',
      'single',
      {
        avoidEscape: true,
      },
    ],
    semi: 'off',
    '@typescript-eslint/semi': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // '@typescript-eslint/indent': ["error", 2],
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/no-empty-interface': [
      'error',
      {
        allowSingleExtends: true,
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_', // https://github.com/typescript-eslint/typescript-eslint/issues/1054
      },
    ],
    '@typescript-eslint/no-explicit-any': ['warn'],
    '@typescript-eslint/no-useless-constructor': 'error',
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false, classes: true },
    ],
    '@typescript-eslint/no-shadow': ['warn'],
    'no-throw-literal': 'off',
    '@typescript-eslint/no-throw-literal': ['error'],
    // prefer es2015 import/export over namespaces and modules
    // only allow declare module for external modules in .d.ts files
    '@typescript-eslint/no-namespace': ['error'],
    // prefer foo as string type assertion to <string>foo
    // and
    // prefer `const foo:someType = bar` over `const foo = bar as someType`
    '@typescript-eslint/consistent-type-assertions': [
      'error',
      { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
    ],
  },
};
