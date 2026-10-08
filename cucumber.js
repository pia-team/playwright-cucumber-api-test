module.exports = {
  default: {
    // Do not set `paths` here. cucumber-js merges config paths with CLI feature args, so a
    // glob would re-run the entire tree during CoTester single-feature and Flow step runs.
    // Pass features on the CLI (or use the `all` profile for a full local suite).
    require: ['src/features/steps/**/*.step.ts', 'src/core/hooks/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      'progress',
      'json:reports/cucumber-report/cucumber-report.json',
      'html:reports/cucumber-report/report.html',
      'junit:reports/cucumber-report/junit-report.xml',
      'message:reports/cucumber-report/cucumber-messages.ndjson',
    ],
    publishQuiet: true,
    worldParameters: {
      reportDir: 'reports/cucumber-report',
    },
  },
  all: {
    paths: ['src/features/**/*.feature'],
    require: ['src/features/steps/**/*.step.ts', 'src/core/hooks/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      'progress',
      'json:reports/cucumber-report/cucumber-report.json',
      'html:reports/cucumber-report/report.html',
    ],
    publishQuiet: true,
  },
};
