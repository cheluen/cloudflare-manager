#!/usr/bin/env node
/**
 * Cloudflare Workers Secrets Management
 *
 * Usage:
 *   node scripts/secrets.js list <worker-name>
 *   node scripts/secrets.js put <worker-name> <secret-name> <secret-value>
 *   node scripts/secrets.js delete <worker-name> <secret-name>
 *
 * Features:
 * - List all secrets for a worker (names only, values are not exposed)
 * - Create or update secrets
 * - Delete secrets
 * - Secrets are encrypted and only accessible by the worker at runtime
 */

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
 * List all secrets for a worker
 */
async function listSecrets(workerName) {
  try {
    validateWorkerName(workerName);
    const accountId = await getAccountId();

    printInfo(`Fetching secrets for worker: ${workerName}`);

    const response = await makeApiRequestWithRetry(
      `/accounts/${accountId}/workers/scripts/${workerName}/secrets`
    );

    const secrets = response.result;

    if (!secrets || secrets.length === 0) {
      printInfo(`No secrets found for worker "${workerName}".`);
      return [];
    }

    console.log(`\n🔐 Secrets for ${workerName} (${secrets.length}):\n`);

    for (const secret of secrets) {
      console.log(`  • ${secret.name}`);
      if (secret.type) {
        console.log(`    Type: ${secret.type}`);
      }
    }

    console.log('\n⚠️  Note: Secret values are never exposed via API for security reasons.\n');

    return secrets;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.statusCode === 404) {
        printError(`Worker "${workerName}" not found.`);
        printInfo('Use "node scripts/workers.js list" to see available workers.');
      } else {
        printError('Failed to list secrets');
        printError(error.getUserMessage());
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [];
  }
}

/**
 * Create or update a secret
 */
async function putSecret(workerName, secretName, secretValue) {
  try {
    validateWorkerName(workerName);
    validateSecretName(secretName);

    const accountId = await getAccountId();

    printInfo(`Setting secret "${secretName}" for worker: ${workerName}`);

    await makeApiRequestWithRetry(
      `/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
      {
        method: 'PUT',
        body: {
          name: secretName,
          text: secretValue,
          type: 'secret_text',
        },
      }
    );

    printSuccess(`Secret "${secretName}" set successfully!`);
    console.log(`\n🔐 Worker: ${workerName}`);
    console.log(`🔑 Secret: ${secretName}`);
    console.log('\n⚠️  Note: A new version of the worker has been deployed with this secret.\n');

    return true;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.statusCode === 404) {
        printError(`Worker "${workerName}" not found.`);
        printInfo('Deploy the worker first using "node scripts/workers.js deploy"');
      } else {
        printError('Failed to set secret');
        printError(error.getUserMessage());
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}

/**
 * Delete a secret
 */
async function deleteSecret(workerName, secretName) {
  try {
    validateWorkerName(workerName);
    validateSecretName(secretName);

    const accountId = await getAccountId();

    printInfo(`Deleting secret "${secretName}" from worker: ${workerName}`);

    await makeApiRequestWithRetry(
      `/accounts/${accountId}/workers/scripts/${workerName}/secrets/${secretName}`,
      { method: 'DELETE' }
    );

    printSuccess(`Secret "${secretName}" deleted successfully!`);
    console.log('\n⚠️  Note: A new version of the worker has been deployed without this secret.\n');

    return true;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.statusCode === 404) {
        printError(`Secret "${secretName}" not found in worker "${workerName}".`);
      } else {
        printError('Failed to delete secret');
        printError(error.getUserMessage());
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}

/**
 * Bulk set secrets from JSON file or object
 */
async function bulkPutSecrets(workerName, secrets) {
  try {
    validateWorkerName(workerName);
    const accountId = await getAccountId();

    const secretEntries = Object.entries(secrets);
    printInfo(`Setting ${secretEntries.length} secrets for worker: ${workerName}`);

    let successCount = 0;
    let failCount = 0;

    for (const [name, value] of secretEntries) {
      try {
        validateSecretName(name);

        await makeApiRequestWithRetry(
          `/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
          {
            method: 'PUT',
            body: {
              name,
              text: String(value),
              type: 'secret_text',
            },
          }
        );

        console.log(`  ✅ ${name}`);
        successCount++;
      } catch (error) {
        console.log(`  ❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
        failCount++;
      }
    }

    console.log('');
    printSuccess(`Bulk set complete: ${successCount} succeeded, ${failCount} failed`);

    return { successCount, failCount };
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Bulk set failed');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { successCount: 0, failCount: Object.keys(secrets).length };
  }
}

/**
 * Validate secret name
 */
function validateSecretName(name) {
  // Secret names must be valid environment variable names
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      `Invalid secret name: "${name}"\n\n` +
        'Secret names must:\n' +
        '- Start with a letter or underscore\n' +
        '- Contain only letters, numbers, and underscores\n' +
        'Example: "API_KEY" or "DATABASE_URL"'
    );
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const { command, args, flags } = parseArgs(process.argv);

  if (!command) {
    console.log(`
Cloudflare Workers Secrets Management

Usage:
  node scripts/secrets.js list <worker-name>
  node scripts/secrets.js put <worker-name> <secret-name> <secret-value>
  node scripts/secrets.js delete <worker-name> <secret-name>

Commands:
  list <worker>                          List all secrets for a worker
  put <worker> <name> <value>            Create or update a secret
  delete <worker> <name>                 Delete a secret

Examples:
  node scripts/secrets.js list my-worker
  node scripts/secrets.js put my-worker API_KEY sk-123456
  node scripts/secrets.js put my-worker DATABASE_URL "postgres://user:pass@host/db"
  node scripts/secrets.js delete my-worker OLD_SECRET

Notes:
  - Secret values are encrypted and only accessible by the worker at runtime
  - Setting a secret creates a new version of the worker
  - Secret names must be valid environment variable names (e.g., API_KEY, DB_URL)
  - Secret values are never exposed via the API for security reasons
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
      await listSecrets(workerName);
      break;
    }

    case 'put': {
      const [workerName, secretName, ...valueParts] = args;
      const secretValue = valueParts.join(' ');

      if (!workerName || !secretName || !secretValue) {
        printError('Usage: put <worker-name> <secret-name> <secret-value>');
        process.exit(1);
      }
      await putSecret(workerName, secretName, secretValue);
      break;
    }

    case 'delete': {
      const [workerName, secretName] = args;
      if (!workerName || !secretName) {
        printError('Usage: delete <worker-name> <secret-name>');
        process.exit(1);
      }
      await deleteSecret(workerName, secretName);
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

export { listSecrets, putSecret, deleteSecret, bulkPutSecrets };
