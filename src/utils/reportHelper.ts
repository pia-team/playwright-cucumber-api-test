import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface TestResult {
  feature: string;
  scenario: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  steps: StepResult[];
  error?: string;
  timestamp: string;
}

export interface StepResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export class ReportHelper {
  private static results: TestResult[] = [];
  private static currentFeature: string = '';
  private static currentScenario: string = '';
  private static scenarioStartTime: number = 0;
  private static stepStartTime: number = 0;
  private static currentSteps: StepResult[] = [];

  static setFeature(featureName: string): void {
    this.currentFeature = featureName;
    logger.debug(`Report: Feature started - ${featureName}`);
  }

  static startScenario(scenarioName: string): void {
    this.currentScenario = scenarioName;
    this.scenarioStartTime = Date.now();
    this.currentSteps = [];
    logger.debug(`Report: Scenario started - ${scenarioName}`);
  }

  static startStep(stepName: string): void {
    this.stepStartTime = Date.now();
    logger.debug(`Report: Step started - ${stepName}`);
  }

  static endStep(stepName: string, status: 'passed' | 'failed' | 'skipped', error?: string): void {
    const duration = Date.now() - this.stepStartTime;
    this.currentSteps.push({
      name: stepName,
      status,
      duration,
      error
    });
    logger.debug(`Report: Step ended - ${stepName} (${status}, ${duration}ms)`);
  }

  static endScenario(status: 'passed' | 'failed' | 'skipped', error?: string): void {
    const duration = Date.now() - this.scenarioStartTime;
    this.results.push({
      feature: this.currentFeature,
      scenario: this.currentScenario,
      status,
      duration,
      steps: [...this.currentSteps],
      error,
      timestamp: new Date().toISOString()
    });
    logger.info(`Report: Scenario ended - ${this.currentScenario} (${status}, ${duration}ms)`);
  }

  static generateDetailedReport(outputPath: string = 'reports/cucumber-report/detailed-report.html'): void {
    const reportDir = path.dirname(outputPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'passed').length;
    const failedTests = this.results.filter(r => r.status === 'failed').length;
    const skippedTests = this.results.filter(r => r.status === 'skipped').length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    const html = this.generateHTMLReport(totalTests, passedTests, failedTests, skippedTests, totalDuration);
    
    fs.writeFileSync(outputPath, html, 'utf-8');
    logger.info(`Detailed report generated: ${outputPath}`);
  }

  private static generateHTMLReport(
    total: number,
    passed: number,
    failed: number,
    skipped: number,
    duration: number
  ): string {
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Test Report - Detailed</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .header .meta { opacity: 0.9; font-size: 0.9rem; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            padding: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-card .value {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .stat-card.passed .value { color: #10b981; }
        .stat-card.failed .value { color: #ef4444; }
        .stat-card.skipped .value { color: #f59e0b; }
        .stat-card.total .value { color: #3b82f6; }
        .stat-card .label {
            color: #6b7280;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .content {
            padding: 2rem;
        }
        .feature-section {
            background: white;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .feature-header {
            background: #f9fafb;
            padding: 1rem 1.5rem;
            border-bottom: 2px solid #e5e7eb;
            font-weight: 600;
            font-size: 1.1rem;
        }
        .scenario {
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem 1.5rem;
        }
        .scenario:last-child { border-bottom: none; }
        .scenario-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .scenario-name {
            font-weight: 500;
            color: #111827;
        }
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-badge.passed {
            background: #d1fae5;
            color: #065f46;
        }
        .status-badge.failed {
            background: #fee2e2;
            color: #991b1b;
        }
        .status-badge.skipped {
            background: #fef3c7;
            color: #92400e;
        }
        .scenario-meta {
            font-size: 0.85rem;
            color: #6b7280;
            margin-bottom: 0.75rem;
        }
        .steps {
            margin-top: 0.75rem;
            padding-left: 1rem;
        }
        .step {
            padding: 0.5rem;
            margin-bottom: 0.25rem;
            border-left: 3px solid #e5e7eb;
            padding-left: 0.75rem;
            font-size: 0.9rem;
        }
        .step.passed { border-left-color: #10b981; }
        .step.failed { border-left-color: #ef4444; }
        .step.skipped { border-left-color: #f59e0b; }
        .step-name {
            font-weight: 500;
            color: #374151;
        }
        .step-duration {
            color: #9ca3af;
            font-size: 0.8rem;
            margin-left: 0.5rem;
        }
        .error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 4px;
            padding: 0.75rem;
            margin-top: 0.5rem;
            color: #991b1b;
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            white-space: pre-wrap;
        }
        .summary {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary h2 {
            margin-bottom: 1rem;
            color: #111827;
        }
        .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .summary-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="header">
        <h1>API Test Execution Report</h1>
        <div class="meta">Generated on ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="stats">
        <div class="stat-card total">
            <div class="value">${total}</div>
            <div class="label">Total Tests</div>
        </div>
        <div class="stat-card passed">
            <div class="value">${passed}</div>
            <div class="label">Passed</div>
        </div>
        <div class="stat-card failed">
            <div class="value">${failed}</div>
            <div class="label">Failed</div>
        </div>
        <div class="stat-card skipped">
            <div class="value">${skipped}</div>
            <div class="label">Skipped</div>
        </div>
    </div>

    <div class="content">
        <div class="summary">
            <h2>Summary</h2>
            <div class="summary-item">
                <span>Total Duration:</span>
                <strong>${(duration / 1000).toFixed(2)}s</strong>
            </div>
            <div class="summary-item">
                <span>Pass Rate:</span>
                <strong>${passRate}%</strong>
            </div>
            <div class="summary-item">
                <span>Average Test Duration:</span>
                <strong>${total > 0 ? (duration / total / 1000).toFixed(2) : '0.00'}s</strong>
            </div>
        </div>

        ${this.generateFeatureSections()}
    </div>
</body>
</html>`;
  }

  private static generateFeatureSections(): string {
    const features = new Map<string, TestResult[]>();
    
    this.results.forEach(result => {
      if (!features.has(result.feature)) {
        features.set(result.feature, []);
      }
      features.get(result.feature)!.push(result);
    });

    let html = '';
    features.forEach((scenarios, featureName) => {
      html += `
        <div class="feature-section">
          <div class="feature-header">${featureName}</div>
          ${scenarios.map(scenario => this.generateScenarioHTML(scenario)).join('')}
        </div>
      `;
    });

    return html;
  }

  private static generateScenarioHTML(scenario: TestResult): string {
    return `
      <div class="scenario">
        <div class="scenario-header">
          <div class="scenario-name">${scenario.scenario}</div>
          <span class="status-badge ${scenario.status}">${scenario.status}</span>
        </div>
        <div class="scenario-meta">
          Duration: ${(scenario.duration / 1000).toFixed(2)}s | 
          Steps: ${scenario.steps.length} | 
          ${scenario.timestamp}
        </div>
        <div class="steps">
          ${scenario.steps.map(step => `
            <div class="step ${step.status}">
              <span class="step-name">${step.name}</span>
              <span class="step-duration">(${step.duration}ms)</span>
              ${step.error ? `<div class="error">${this.escapeHtml(step.error)}</div>` : ''}
            </div>
          `).join('')}
        </div>
        ${scenario.error ? `<div class="error">${this.escapeHtml(scenario.error)}</div>` : ''}
      </div>
    `;
  }

  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  static clear(): void {
    this.results = [];
    this.currentFeature = '';
    this.currentScenario = '';
    this.currentSteps = [];
  }
}
