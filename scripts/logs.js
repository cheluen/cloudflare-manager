#!/usr/bin/env node
/**
 * Cloudflare Workers and Pages Logs Management
 *
 * Usage:
 *   node scripts/logs.js workers <worker-name> [options]
 *   node scripts/logs.js pages <project-name> [deployment-id]
 *
 * Workers Options:
 *   --tail              Start real-time log streaming (requires wrangler)
 *   --from <time>       Start time for query (e.g., "1h", "30m", "2024-01-01T00:00:00Z")
 *   --to <time>         End time for query (default: now)
 *   --limit <n>         Max number of events (default: 100)
 *   --status <status>   Filter by status: ok, error, canceled
 *
 * Features:
 * - Query Workers historical logs via Telemetry API
 * - Stream real-time Workers logs via wrangler tail
 * - View Pages deployment/build logs
 * - Automatic wrangler detection and installation guidance
 */

import { spawnSync } from 'child_process';
import {
  makeApiRequestWithRetry,
  getAccountId,
  parseArgs,
  printSuccess,
  printError,
  printInfo,
  printWarning,
  isMainModule,
  CloudflareApiError,
} from './utils.js';

/**
 * Check if wrangler is installed
 */
function checkWrangler() {
  const result = spawnSync('npx', ['wrangler', '--version'], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    return { installed: false, version: null };
  }

  const version = result.stdout?.trim() || result.stderr?.trim();
  return { installed: true, version };
}

/**
 * Check if wrangler is logged in
 */
function checkWranglerAuth() {
  const result = spawnSync('npx', ['wrangler', 'whoami'], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    return { authenticated: false, user: null };
  }

  return { authenticated: true, user: result.stdout?.trim() };
}

/**
 * Parse time string to timestamp
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;

  // Check if it's a relative time like "1h", "30m", "2d"
  const relativeMatch = timeStr.match(/^(\d+)(m|h|d)$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const now = Date.now();

    switch (unit) {
      case 'm':
        return now - value * 60 * 1000;
      case 'h':
        return now - value * 60 * 60 * 1000;
      case 'd':
        return now - value * 24 * 60 * 60 * 1000;
    }
  }

  // Try to parse as ISO date
  const date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    return date.getTime();
  }

  throw new Error(`Invalid time format: ${timeStr}. Use "1h", "30m", "2d" or ISO date.`);
}

/**
 * Start real-time log streaming with wrangler
 */
async function tailWorkerLogs(workerName) {
  console.log('\n📡 Real-time Log Streaming\n');

  // Check wrangler installation
  const { installed, version } = checkWrangler();

  if (!installed) {
    printWarning('Wrangler CLI is not installed.');
    console.log('To install wrangler, run:\n');
    console.log('  npm install -g wrangler\n');
    console.log('Or use npx directly:\n');
    console.log(`  npx wrangler tail ${workerName}\n`);
    return false;
  }

  console.log(`✅ Wrangler detected: ${version}`);

  // Check authentication
  const { authenticated, user } = checkWranglerAuth();

  if (!authenticated) {
    printWarning('Wrangler is not logged in.');
    console.log('To login, run:\n');
    console.log('  npx wrangler login\n');
    console.log('Then start tail:\n');
    console.log(`  npx wrangler tail ${workerName}\n`);
    return false;
  }

  console.log(`✅ Authenticated: ${user}`);
  console.log('\n🚀 Starting log tail...\n');
  console.log('─'.repeat(50));
  console.log(`Running: npx wrangler tail ${workerName}`);
  console.log('Press Ctrl+C to stop\n');

  // Start wrangler tail (interactive)
  const tail = spawnSync('npx', ['wrangler', 'tail', workerName], {
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  if (tail.status !== 0 && tail.status !== null) {
    printError(`Tail exited with code ${tail.status}`);
    return false;
  }

  return true;
}

/**
 * Query Workers historical logs via Telemetry API
 */
async function queryWorkerLogs(workerName, options = {}) {
  try {
    const accountId = await getAccountId();
    const now = Date.now();

    // Parse time range
    const fromTime = options.from ? parseTimeString(options.from) : now - 60 * 60 * 1000; // Default: 1 hour ago
    const toTime = options.to ? parseTimeString(options.to) : now;
    const limit = options.limit || 100;

    printInfo(`Querying logs for worker: ${workerName}`);
    console.log(`📅 Time range: ${new Date(fromTime).toISOString()} to ${new Date(toTime).toISOString()}`);
    console.log(`📊 Limit: ${limit} events\n`);

    // Build query
    const query = {
      timeframe: {
        from: fromTime,
        to: toTime,
      },
      datasets: ['workers'],
      filters: [
        {
          key: 'scriptName',
          operation: 'eq',
          value: workerName,
        },
      ],
      limit: limit,
      orderBy: {
        key: 'timestamp',
        order: 'desc',
      },
    };

    // Add status filter if specified
    if (options.status) {
      query.filters.push({
        key: 'outcome',
        operation: 'eq',
        value: options.status,
      });
    }

    const response = await makeApiRequestWithRetry(
      `/accounts/${accountId}/workers/observability/telemetry/query`,
      {
        method: 'POST',
        body: query,
      }
    );

    const result = response.result;

    // Check if we have events
    if (!result?.events || result.events.length === 0) {
      printInfo('No log events found for the specified time range.');
      console.log('\n💡 Tips:');
      console.log('  - Try a longer time range: --from 24h');
      console.log('  - Check if the worker name is correct');
      console.log('  - Ensure the worker has received requests\n');
      return [];
    }

    console.log(`\n📋 Log Events (${result.events.length}):\n`);
    console.log('─'.repeat(80));

    for (const event of result.events) {
      const timestamp = new Date(event.timestamp).toLocaleString();
      const outcome = event.$workers?.outcome || 'unknown';
      const duration = event.$metadata?.duration ? `${event.$metadata.duration}ms` : 'N/A';
      const statusIcon = outcome === 'ok' ? '✅' : outcome === 'error' ? '❌' : '⚠️';

      console.log(`${statusIcon} [${timestamp}] ${outcome.toUpperCase()}`);
      console.log(`   Duration: ${duration}`);

      if (event.$metadata?.error) {
        console.log(`   Error: ${event.$metadata.error}`);
      }

      if (event.$workers?.eventType) {
        console.log(`   Event: ${event.$workers.eventType}`);
      }

      // Show logs if available
      if (event.logs && event.logs.length > 0) {
        console.log('   Logs:');
        for (const log of event.logs) {
          console.log(`     ${log.level}: ${log.message}`);
        }
      }

      console.log('');
    }

    // Show statistics
    if (result.statistics) {
      console.log('─'.repeat(80));
      console.log('📊 Statistics:');
      console.log(`   Rows read: ${result.statistics.rowsRead || 0}`);
      console.log(`   Query time: ${result.statistics.elapsedMs || 0}ms\n`);
    }

    return result.events;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.statusCode === 404 || error.message.includes('not found')) {
        printError(`Worker "${workerName}" not found or observability not enabled.`);
        console.log('\n💡 Tips:');
        console.log('  - Verify the worker name with: node scripts/workers.js list');
        console.log('  - Observability may need to be enabled for your account');
        console.log('  - Use --tail for real-time logs instead\n');
      } else {
        printError('Failed to query logs');
        printError(error.getUserMessage());
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [];
  }
}

/**
 * Get Pages deployment logs
 */
async function getPagesLogs(projectName, deploymentId) {
  try {
    const accountId = await getAccountId();

    // If no deployment ID, get latest deployment
    if (!deploymentId) {
      printInfo(`Fetching latest deployment for: ${projectName}`);

      const deploymentsResponse = await makeApiRequestWithRetry(
        `/accounts/${accountId}/pages/projects/${projectName}/deployments`,
        { queryParams: { per_page: 1 } }
      );

      const deployments = deploymentsResponse.result;

      if (!deployments || deployments.length === 0) {
        printError(`No deployments found for project: ${projectName}`);
        return null;
      }

      deploymentId = deployments[0].id;
      console.log(`📦 Latest deployment: ${deploymentId}`);
      console.log(`🌐 URL: ${deployments[0].url}`);
      console.log(`📊 Status: ${deployments[0].latest_stage?.status || 'unknown'}\n`);
    }

    printInfo(`Fetching logs for deployment: ${deploymentId}`);

    const response = await makeApiRequestWithRetry(
      `/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}/history/logs`
    );

    const result = response.result;

    if (!result?.data || result.data.length === 0) {
      printInfo('No logs found for this deployment.');
      return null;
    }

    console.log(`\n📋 Deployment Logs (${result.total || result.data.length} entries):\n`);
    console.log('─'.repeat(80));

    for (const log of result.data) {
      const timestamp = log.ts ? new Date(log.ts).toLocaleString() : '';
      const line = log.line || log.message || JSON.stringify(log);
      console.log(`[${timestamp}] ${line}`);
    }

    console.log('─'.repeat(80));

    if (result.includes_container_logs) {
      console.log('ℹ️  Includes container logs\n');
    }

    return result;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to get Pages logs');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Show dashboard links for logs
 */
async function showDashboardLinks(type, name) {
  const accountId = await getAccountId();

  console.log('\n🔗 Dashboard Links:\n');

  if (type === 'workers') {
    console.log(`  Logs: https://dash.cloudflare.com/${accountId}/workers/services/view/${name}/production/logs`);
    console.log(`  Metrics: https://dash.cloudflare.com/${accountId}/workers/services/view/${name}/production/metrics`);
    console.log(`  Traces: https://dash.cloudflare.com/${accountId}/workers/services/view/${name}/production/traces`);
  } else if (type === 'pages') {
    console.log(`  Project: https://dash.cloudflare.com/${accountId}/pages/view/${name}`);
    console.log(`  Deployments: https://dash.cloudflare.com/${accountId}/pages/view/${name}/deployments`);
  }

  console.log('');
}

/**
 * Main CLI handler
 */
async function main() {
  const { command, args, flags } = parseArgs(process.argv);

  if (!command) {
    console.log(`
Cloudflare Logs Management

Usage:
  node scripts/logs.js workers <worker-name> [options]
  node scripts/logs.js pages <project-name> [deployment-id]

Workers Options:
  --tail              Start real-time log streaming (requires wrangler)
  --from <time>       Start time: "1h", "30m", "2d", or ISO date (default: 1h)
  --to <time>         End time (default: now)
  --limit <n>         Max events to return (default: 100)
  --status <status>   Filter by outcome: ok, error, canceled
  --dashboard         Show dashboard links only

Examples:
  # Real-time logs (requires wrangler)
  node scripts/logs.js workers my-worker --tail

  # Query last hour of logs
  node scripts/logs.js workers my-worker

  # Query last 24 hours, errors only
  node scripts/logs.js workers my-worker --from 24h --status error

  # Pages deployment logs
  node scripts/logs.js pages my-site

  # Specific deployment logs
  node scripts/logs.js pages my-site abc123-deployment-id

Prerequisites for real-time logs:
  1. Install wrangler: npm install -g wrangler
  2. Login: npx wrangler login
    `);
    return;
  }

  switch (command) {
    case 'workers': {
      const [workerName] = args;
      if (!workerName) {
        printError('Usage: workers <worker-name> [options]');
        process.exit(1);
      }

      if (flags.dashboard) {
        await showDashboardLinks('workers', workerName);
        return;
      }

      if (flags.tail) {
        await tailWorkerLogs(workerName);
      } else {
        await queryWorkerLogs(workerName, {
          from: flags.from,
          to: flags.to,
          limit: flags.limit ? parseInt(String(flags.limit)) : undefined,
          status: flags.status,
        });
        await showDashboardLinks('workers', workerName);
      }
      break;
    }

    case 'pages': {
      const [projectName, deploymentId] = args;
      if (!projectName) {
        printError('Usage: pages <project-name> [deployment-id]');
        process.exit(1);
      }

      if (flags.dashboard) {
        await showDashboardLinks('pages', projectName);
        return;
      }

      await getPagesLogs(projectName, deploymentId);
      await showDashboardLinks('pages', projectName);
      break;
    }

    default:
      printError(`Unknown command: ${command}`);
      console.log('Use "workers" or "pages"');
      process.exit(1);
  }
}

// Run if called directly
if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    printError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

export { tailWorkerLogs, queryWorkerLogs, getPagesLogs, showDashboardLinks };
