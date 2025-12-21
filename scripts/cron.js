#!/usr/bin/env node
// Cloudflare Workers Cron Triggers Management
//
// Usage:
//   node scripts/cron.js list <worker-name>
//   node scripts/cron.js update <worker-name> <cron1> [cron2] [cron3] ...
//   node scripts/cron.js delete <worker-name>
//   node scripts/cron.js test <worker-name> [--cron <expression>]
//
// Features:
// - List current cron schedules for a worker
// - Update/replace cron schedules
// - Delete all cron schedules
// - Test cron triggers locally (requires wrangler dev)
//
// Cron Expression Format:
//   minute hour day-of-month month day-of-week
//   Example: "0 9 * * 1-5" = 9 AM on weekdays

import { spawnSync } from 'child_process';
import {
  makeApiRequestWithRetry,
  getAccountId,
  validateWorkerName,
  parseArgs,
  printSuccess,
  printError,
  printInfo,
  printWarning,
  isMainModule,
  CloudflareApiError,
} from './utils.js';

/**
 * List cron schedules for a worker
 */
async function listSchedules(workerName) {
  try {
    validateWorkerName(workerName);
    const accountId = await getAccountId();

    printInfo(`Fetching cron schedules for worker: ${workerName}`);

    const response = await makeApiRequestWithRetry(
      `/accounts/${accountId}/workers/scripts/${workerName}/schedules`
    );

    const schedules = response.result?.schedules || [];

    if (!schedules || schedules.length === 0) {
      printInfo(`No cron schedules found for worker "${workerName}".`);
      console.log('\n💡 To add schedules, use:');
      console.log(`   node scripts/cron.js update ${workerName} "*/5 * * * *"\n`);
      return [];
    }

    console.log(`\n⏰ Cron Schedules for ${workerName} (${schedules.length}):\n`);

    for (const schedule of schedules) {
      console.log(`  📅 ${schedule.cron}`);
      if (schedule.created_on) {
        console.log(`     Created: ${new Date(schedule.created_on).toLocaleString()}`);
      }
      if (schedule.modified_on) {
        console.log(`     Modified: ${new Date(schedule.modified_on).toLocaleString()}`);
      }
    }

    console.log('');
    printCronHelp();

    return schedules;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.statusCode === 404) {
        printError(`Worker "${workerName}" not found.`);
        printInfo('Use "node scripts/workers.js list" to see available workers.');
      } else {
        printError('Failed to list schedules');
        printError(error.getUserMessage());
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [];
  }
}

/**
 * Update cron schedules for a worker
 */
async function updateSchedules(workerName, cronExpressions) {
  try {
    validateWorkerName(workerName);

    // Validate cron expressions
    for (const cron of cronExpressions) {
      validateCronExpression(cron);
    }

    const accountId = await getAccountId();

    printInfo(`Updating cron schedules for worker: ${workerName}`);
    console.log(`\n📅 New schedules:`);
    for (const cron of cronExpressions) {
      console.log(`   • ${cron}`);
    }
    console.log('');

    const response = await makeApiRequestWithRetry(
      `/accounts/${accountId}/workers/scripts/${workerName}/schedules`,
      {
        method: 'PUT',
        body: cronExpressions.map((cron) => ({ cron })),
      }
    );

    printSuccess(`Cron schedules updated successfully!`);
    console.log(`\n⏰ Worker: ${workerName}`);
    console.log(`📅 Active schedules: ${cronExpressions.length}`);

    // Show next execution hints
    console.log('\n💡 Tips:');
    console.log('   • Your worker must export a "scheduled" handler');
    console.log('   • Test locally: wrangler dev --test-scheduled');
    console.log('   • View logs: node scripts/logs.js workers ' + workerName);
    console.log('');

    return true;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.statusCode === 404) {
        printError(`Worker "${workerName}" not found.`);
        printInfo('Deploy the worker first using "node scripts/workers.js deploy"');
      } else {
        printError('Failed to update schedules');
        printError(error.getUserMessage());
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}

/**
 * Delete all cron schedules for a worker
 */
async function deleteSchedules(workerName) {
  try {
    validateWorkerName(workerName);
    const accountId = await getAccountId();

    printInfo(`Deleting all cron schedules for worker: ${workerName}`);

    // Set empty schedules array to delete all
    await makeApiRequestWithRetry(
      `/accounts/${accountId}/workers/scripts/${workerName}/schedules`,
      {
        method: 'PUT',
        body: [],
      }
    );

    printSuccess(`All cron schedules deleted for worker "${workerName}"`);

    return true;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.statusCode === 404) {
        printError(`Worker "${workerName}" not found.`);
      } else {
        printError('Failed to delete schedules');
        printError(error.getUserMessage());
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}

/**
 * Test cron trigger locally
 */
async function testSchedule(workerName, cronExpression) {
  console.log('\n🧪 Testing Cron Trigger Locally\n');

  printInfo('To test cron triggers, you need wrangler running in dev mode.');

  console.log('\n📋 Steps to test:\n');
  console.log('  1. Start wrangler dev with scheduled test support:');
  console.log(`     npx wrangler dev --test-scheduled\n`);

  console.log('  2. In another terminal, trigger the scheduled event:');

  if (cronExpression) {
    const encodedCron = encodeURIComponent(cronExpression);
    console.log(`     curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=${encodedCron}"\n`);
  } else {
    console.log('     curl "http://localhost:8787/cdn-cgi/handler/scheduled"\n');
  }

  console.log('  3. Check the wrangler dev output for your scheduled handler logs.\n');

  // Check if wrangler is installed
  const result = spawnSync('npx', ['wrangler', '--version'], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    printWarning('Wrangler CLI not found. Install it with:');
    console.log('   npm install -g wrangler\n');
  } else {
    console.log(`✅ Wrangler detected: ${result.stdout?.trim()}\n`);
  }

  // Show example scheduled handler
  console.log('📝 Example scheduled handler for your worker:\n');
  console.log(`  export default {
    async scheduled(controller, env, ctx) {
      console.log("Cron triggered:", controller.cron);
      console.log("Scheduled time:", controller.scheduledTime);

      // Your scheduled task logic here
      // e.g., cleanup, sync data, send reports, etc.
    },
  };
`);

  return true;
}

/**
 * Validate cron expression (basic validation)
 */
function validateCronExpression(cron) {
  // Basic validation - 5 space-separated fields
  const parts = cron.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: "${cron}"\n\n` +
        'Cron expressions must have 5 fields:\n' +
        '  minute hour day-of-month month day-of-week\n\n' +
        'Examples:\n' +
        '  "* * * * *"     - Every minute\n' +
        '  "0 * * * *"     - Every hour\n' +
        '  "0 0 * * *"     - Every day at midnight\n' +
        '  "*/15 * * * *"  - Every 15 minutes'
    );
  }

  // Validate each field has valid characters
  const validPattern = /^[\d*,\-\/LW]+$/i;
  for (let i = 0; i < parts.length; i++) {
    // Allow month names (JAN-DEC) and day names (SUN-SAT)
    const monthNames = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i;
    const dayNames = /^(SUN|MON|TUE|WED|THU|FRI|SAT)$/i;

    if (!validPattern.test(parts[i]) && !monthNames.test(parts[i]) && !dayNames.test(parts[i])) {
      // Check for ranges with names like JAN-JUN
      const rangePattern = /^[A-Z]{3}-[A-Z]{3}$/i;
      if (!rangePattern.test(parts[i])) {
        throw new Error(
          `Invalid cron field "${parts[i]}" in expression: "${cron}"\n\n` +
            'Valid characters: 0-9, *, ,, -, /, L, W\n' +
            'Valid month names: JAN-DEC\n' +
            'Valid day names: SUN-SAT'
        );
      }
    }
  }

  return true;
}

/**
 * Print cron help information
 */
function printCronHelp() {
  console.log('📖 Cron Expression Reference:\n');
  console.log('  ┌───────────── minute (0-59)');
  console.log('  │ ┌───────────── hour (0-23)');
  console.log('  │ │ ┌───────────── day of month (1-31, L=last)');
  console.log('  │ │ │ ┌───────────── month (1-12 or JAN-DEC)');
  console.log('  │ │ │ │ ┌───────────── day of week (0-6 or SUN-SAT)');
  console.log('  │ │ │ │ │');
  console.log('  * * * * *\n');
  console.log('Common examples:');
  console.log('  "*/5 * * * *"    - Every 5 minutes');
  console.log('  "0 * * * *"      - Every hour');
  console.log('  "0 0 * * *"      - Daily at midnight');
  console.log('  "0 9 * * 1-5"    - 9 AM on weekdays');
  console.log('  "0 0 1 * *"      - First of every month');
  console.log('  "0 0 L * *"      - Last day of every month');
  console.log('');
}

/**
 * Main CLI handler
 */
async function main() {
  const { command, args, flags } = parseArgs(process.argv);

  if (!command) {
    console.log(`
Cloudflare Workers Cron Triggers Management

Usage:
  node scripts/cron.js list <worker-name>
  node scripts/cron.js update <worker-name> <cron1> [cron2] [cron3] ...
  node scripts/cron.js delete <worker-name>
  node scripts/cron.js test <worker-name> [--cron <expression>]

Commands:
  list <worker>                     List current cron schedules
  update <worker> <crons...>        Set cron schedules (replaces existing)
  delete <worker>                   Remove all cron schedules
  test <worker>                     Show instructions for local testing

Cron Expression Format:
  ┌───────────── minute (0-59)
  │ ┌───────────── hour (0-23)
  │ │ ┌───────────── day of month (1-31, L=last)
  │ │ │ ┌───────────── month (1-12 or JAN-DEC)
  │ │ │ │ ┌───────────── day of week (0-6 or SUN-SAT)
  │ │ │ │ │
  * * * * *

Examples:
  # List schedules
  node scripts/cron.js list my-worker

  # Run every 5 minutes
  node scripts/cron.js update my-worker "*/5 * * * *"

  # Multiple schedules: every hour and daily at midnight
  node scripts/cron.js update my-worker "0 * * * *" "0 0 * * *"

  # Every weekday at 9 AM
  node scripts/cron.js update my-worker "0 9 * * 1-5"

  # First day of every month at midnight
  node scripts/cron.js update my-worker "0 0 1 * *"

  # Remove all schedules
  node scripts/cron.js delete my-worker

Notes:
  - Your worker must export a "scheduled" handler to respond to cron triggers
  - Cloudflare uses UTC time for all cron schedules
  - Minimum interval is 1 minute
  - Maximum of 3 cron triggers per worker
    `);
    return;
  }

  switch (command) {
    case 'list': {
      const [workerName] = args;
      if (!workerName) {
        printError('Usage: list <worker-name>');
        process.exit(1);
      }
      await listSchedules(workerName);
      break;
    }

    case 'update': {
      const [workerName, ...cronExpressions] = args;
      if (!workerName || cronExpressions.length === 0) {
        printError('Usage: update <worker-name> <cron1> [cron2] [cron3]');
        console.log('\nExamples:');
        console.log('  node scripts/cron.js update my-worker "*/5 * * * *"');
        console.log('  node scripts/cron.js update my-worker "0 * * * *" "0 0 * * *"');
        process.exit(1);
      }
      if (cronExpressions.length > 3) {
        printWarning('Cloudflare allows a maximum of 3 cron triggers per worker.');
        printInfo('Only the first 3 schedules will be used.');
        cronExpressions.splice(3);
      }
      await updateSchedules(workerName, cronExpressions);
      break;
    }

    case 'delete': {
      const [workerName] = args;
      if (!workerName) {
        printError('Usage: delete <worker-name>');
        process.exit(1);
      }
      await deleteSchedules(workerName);
      break;
    }

    case 'test': {
      const [workerName] = args;
      if (!workerName) {
        printError('Usage: test <worker-name> [--cron <expression>]');
        process.exit(1);
      }
      const cronExpression = flags.cron ? String(flags.cron) : undefined;
      await testSchedule(workerName, cronExpression);
      break;
    }

    default:
      printError(`Unknown command: ${command}`);
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

export { listSchedules, updateSchedules, deleteSchedules, testSchedule };
