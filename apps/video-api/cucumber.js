module.exports = {
  default: {
    require: ['features/support/**/*.ts'],
    requireModule: ['ts-node/register'],
    paths: ['features/**/*.feature'],
    format: ['progress-bar', 'summary'],
    formatOptions: { snippetInterface: 'async-await' },
    timeout: 120000,
  },
};
