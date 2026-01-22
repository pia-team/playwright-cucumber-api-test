module.exports = {
    default: {
      paths: ['src/features/**/*.feature'],
      require: ['src/features/steps/**/*.step.ts', 'src/core/hooks/**/*.ts'],
      requireModule: ['ts-node/register'],
      format: [
        'progress',
        'json:reports/cucumber-report/cucumber-report.json',
        'html:reports/cucumber-report/report.html',
        'junit:reports/cucumber-report/junit-report.xml',
        'message:reports/cucumber-report/cucumber-messages.ndjson'
      ],
      publishQuiet: true,
      worldParameters: {
        reportDir: 'reports/cucumber-report'
      }
    }
  };
  