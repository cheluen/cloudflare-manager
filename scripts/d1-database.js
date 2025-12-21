#!/usr/bin/env node
/**
 * Cloudflare D1 Database Management
 *
 * Usage:
 *   node scripts/d1-database.js list
 *   node scripts/d1-database.js create <name>
 *   node scripts/d1-database.js get <database-id>
 *   node scripts/d1-database.js delete <database-id>
 *   node scripts/d1-database.js query <database-id> "<sql>"
 *   node scripts/d1-database.js execute <database-id> "<sql>"
 *
 * Features:
 * - List all D1 databases
 * - Create new databases
 * - Get database details
 * - Delete databases
 * - Execute SQL queries (SELECT)
 * - Execute SQL statements (INSERT, UPDATE, DELETE, CREATE, etc.)
 */

import {
  makeApiRequestWithRetry,
  getAccountId,
  parseArgs,
  printSuccess,
  printError,
  printInfo,
  isMainModule,
  CloudflareApiError,
} from './utils.js';

/**
 * List all D1 databases
 */
async function listDatabases() {
  try {
    const accountId = await getAccountId();
    const response = await makeApiRequestWithRetry(`/accounts/${accountId}/d1/database`);

    const databases = response.result;

    if (!databases || databases.length === 0) {
      printInfo('No D1 databases found.');
      return [];
    }

    console.log(`\n🗄️  D1 Databases (${databases.length}):\n`);

    for (const db of databases) {
      console.log(`  ${db.name}`);
      console.log(`    ID: ${db.uuid}`);
      console.log(`    Version: ${db.version || 'N/A'}`);
      console.log(`    Created: ${new Date(db.created_at).toLocaleString()}`);
      if (db.file_size) {
        console.log(`    Size: ${formatSize(db.file_size)}`);
      }
      console.log('');
    }

    return databases;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to list databases');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [];
  }
}

/**
 * Create a new D1 database
 */
async function createDatabase(name) {
  try {
    if (!name || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      throw new Error(
        'Invalid database name. Must start with a letter and contain only letters, numbers, hyphens, and underscores.'
      );
    }

    const accountId = await getAccountId();

    printInfo(`Creating D1 database: ${name}`);

    const response = await makeApiRequestWithRetry(`/accounts/${accountId}/d1/database`, {
      method: 'POST',
      body: { name },
    });

    const db = response.result;

    printSuccess(`Database created successfully!`);
    console.log(`\n🗄️  Database: ${db.name}`);
    console.log(`🆔 ID: ${db.uuid}`);
    console.log(`📅 Created: ${new Date(db.created_at).toLocaleString()}`);
    console.log('');

    return db;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to create database');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Get database details
 */
async function getDatabase(databaseId) {
  try {
    const accountId = await getAccountId();
    const response = await makeApiRequestWithRetry(`/accounts/${accountId}/d1/database/${databaseId}`);

    const db = response.result;

    console.log(`\n🗄️  Database: ${db.name}`);
    console.log(`🆔 ID: ${db.uuid}`);
    console.log(`📊 Version: ${db.version || 'N/A'}`);
    console.log(`📅 Created: ${new Date(db.created_at).toLocaleString()}`);
    if (db.file_size) {
      console.log(`📦 Size: ${formatSize(db.file_size)}`);
    }
    if (db.num_tables !== undefined) {
      console.log(`📋 Tables: ${db.num_tables}`);
    }
    console.log('');

    return db;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to get database details');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Delete a database
 */
async function deleteDatabase(databaseId) {
  try {
    const accountId = await getAccountId();

    printInfo(`Deleting database: ${databaseId}`);

    await makeApiRequestWithRetry(`/accounts/${accountId}/d1/database/${databaseId}`, {
      method: 'DELETE',
    });

    printSuccess(`Database deleted successfully`);
    return true;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to delete database');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}

/**
 * Execute SQL query (returns results)
 */
async function queryDatabase(databaseId, sql) {
  try {
    const accountId = await getAccountId();

    printInfo(`Executing query on database: ${databaseId}`);

    const response = await makeApiRequestWithRetry(`/accounts/${accountId}/d1/database/${databaseId}/query`, {
      method: 'POST',
      body: { sql },
    });

    const results = response.result;

    if (Array.isArray(results) && results.length > 0) {
      const firstResult = results[0];

      if (firstResult.results && firstResult.results.length > 0) {
        console.log(`\n📊 Query Results (${firstResult.results.length} rows):\n`);

        // Print results as table
        const columns = Object.keys(firstResult.results[0]);
        console.log('  ' + columns.join(' | '));
        console.log('  ' + columns.map(() => '---').join(' | '));

        for (const row of firstResult.results) {
          const values = columns.map((col) => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
          });
          console.log('  ' + values.join(' | '));
        }
        console.log('');
      } else {
        printInfo('Query returned no results.');
      }

      if (firstResult.meta) {
        console.log(`ℹ️  Rows read: ${firstResult.meta.rows_read || 0}`);
        console.log(`ℹ️  Rows written: ${firstResult.meta.rows_written || 0}`);
        console.log(`ℹ️  Duration: ${firstResult.meta.duration || 0}ms\n`);
      }
    }

    return results;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Query failed');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Execute SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.)
 */
async function executeStatement(databaseId, sql) {
  try {
    const accountId = await getAccountId();

    printInfo(`Executing statement on database: ${databaseId}`);

    const response = await makeApiRequestWithRetry(`/accounts/${accountId}/d1/database/${databaseId}/query`, {
      method: 'POST',
      body: { sql },
    });

    const results = response.result;

    if (Array.isArray(results) && results.length > 0) {
      const firstResult = results[0];

      printSuccess('Statement executed successfully');

      if (firstResult.meta) {
        console.log(`ℹ️  Rows read: ${firstResult.meta.rows_read || 0}`);
        console.log(`ℹ️  Rows written: ${firstResult.meta.rows_written || 0}`);
        console.log(`ℹ️  Changes: ${firstResult.meta.changes || 0}`);
        console.log(`ℹ️  Last Row ID: ${firstResult.meta.last_row_id || 'N/A'}`);
        console.log(`ℹ️  Duration: ${firstResult.meta.duration || 0}ms\n`);
      }
    }

    return results;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Statement execution failed');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Format file size
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Main CLI handler
 */
async function main() {
  const { command, args, flags } = parseArgs(process.argv);

  if (!command) {
    console.log(`
Cloudflare D1 Database Management

Usage:
  node scripts/d1-database.js list
  node scripts/d1-database.js create <name>
  node scripts/d1-database.js get <database-id>
  node scripts/d1-database.js delete <database-id>
  node scripts/d1-database.js query <database-id> "<sql>"
  node scripts/d1-database.js execute <database-id> "<sql>"

Commands:
  list                     List all D1 databases
  create <name>            Create a new database
  get <id>                 Get database details
  delete <id>              Delete a database
  query <id> "<sql>"       Execute a SELECT query
  execute <id> "<sql>"     Execute SQL statement (INSERT, UPDATE, etc.)

Examples:
  node scripts/d1-database.js list
  node scripts/d1-database.js create my-app-db
  node scripts/d1-database.js query abc123 "SELECT * FROM users LIMIT 10"
  node scripts/d1-database.js execute abc123 "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"
  node scripts/d1-database.js execute abc123 "INSERT INTO users (name) VALUES ('John')"
    `);
    return;
  }

  switch (command) {
    case 'list':
      await listDatabases();
      break;

    case 'create': {
      const [name] = args;
      if (!name) {
        printError('Usage: create <name>');
        process.exit(1);
      }
      await createDatabase(name);
      break;
    }

    case 'get': {
      const [databaseId] = args;
      if (!databaseId) {
        printError('Usage: get <database-id>');
        process.exit(1);
      }
      await getDatabase(databaseId);
      break;
    }

    case 'delete': {
      const [databaseId] = args;
      if (!databaseId) {
        printError('Usage: delete <database-id>');
        process.exit(1);
      }
      await deleteDatabase(databaseId);
      break;
    }

    case 'query': {
      const [databaseId, ...sqlParts] = args;
      const sql = sqlParts.join(' ');
      if (!databaseId || !sql) {
        printError('Usage: query <database-id> "<sql>"');
        process.exit(1);
      }
      await queryDatabase(databaseId, sql);
      break;
    }

    case 'execute': {
      const [databaseId, ...sqlParts] = args;
      const sql = sqlParts.join(' ');
      if (!databaseId || !sql) {
        printError('Usage: execute <database-id> "<sql>"');
        process.exit(1);
      }
      await executeStatement(databaseId, sql);
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

export { listDatabases, createDatabase, getDatabase, deleteDatabase, queryDatabase, executeStatement };
