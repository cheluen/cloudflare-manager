#!/usr/bin/env node
/**
 * Cloudflare Zone Management
 *
 * Usage:
 *   node scripts/zones.js list
 *   node scripts/zones.js get <zone-name-or-id>
 *   node scripts/zones.js settings <zone-name-or-id>
 *   node scripts/zones.js purge-cache <zone-name-or-id> [--all | --urls <url1,url2> | --tags <tag1,tag2> | --prefixes <prefix1,prefix2> | --hosts <host1,host2>]
 *
 * Features:
 * - List all zones in your account
 * - Get zone details by name or ID
 * - View zone settings
 * - Purge cache (all, by URLs, by tags, by prefixes, by hosts)
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
 * List all zones
 */
async function listZones() {
  try {
    const response = await makeApiRequestWithRetry('/zones');

    const zones = response.result;

    if (!zones || zones.length === 0) {
      printInfo('No zones found in your account.');
      return [];
    }

    console.log(`\n🌐 Zones (${zones.length}):\n`);

    for (const zone of zones) {
      console.log(`  ${zone.name}`);
      console.log(`    ID: ${zone.id}`);
      console.log(`    Status: ${zone.status}`);
      console.log(`    Plan: ${zone.plan?.name || 'Unknown'}`);
      console.log(`    Name Servers: ${zone.name_servers?.join(', ') || 'N/A'}`);
      console.log(`    Paused: ${zone.paused ? 'Yes' : 'No'}`);
      console.log('');
    }

    return zones;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to list zones');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [];
  }
}

/**
 * Get zone by name or ID
 */
async function getZoneByNameOrId(nameOrId) {
  try {
    // First try to get by ID directly
    if (/^[a-f0-9]{32}$/i.test(nameOrId)) {
      const response = await makeApiRequestWithRetry(`/zones/${nameOrId}`);
      return response.result;
    }

    // Otherwise search by name
    const response = await makeApiRequestWithRetry('/zones', {
      queryParams: { name: nameOrId },
    });

    if (!response.result || response.result.length === 0) {
      throw new Error(`Zone not found: ${nameOrId}`);
    }

    return response.result[0];
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      throw error;
    }
    throw new Error(`Failed to find zone: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get zone details
 */
async function getZone(nameOrId) {
  try {
    const zone = await getZoneByNameOrId(nameOrId);

    console.log(`\n🌐 Zone: ${zone.name}`);
    console.log(`🆔 ID: ${zone.id}`);
    console.log(`📊 Status: ${zone.status}`);
    console.log(`📋 Plan: ${zone.plan?.name || 'Unknown'}`);
    console.log(`⏸️  Paused: ${zone.paused ? 'Yes' : 'No'}`);
    console.log(`🔒 Type: ${zone.type}`);
    console.log(`📅 Created: ${new Date(zone.created_on).toLocaleString()}`);
    console.log(`🕒 Modified: ${new Date(zone.modified_on).toLocaleString()}`);

    if (zone.name_servers && zone.name_servers.length > 0) {
      console.log(`\n🌍 Name Servers:`);
      for (const ns of zone.name_servers) {
        console.log(`  - ${ns}`);
      }
    }

    console.log('');
    return zone;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to get zone details');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Get zone settings
 */
async function getZoneSettings(nameOrId) {
  try {
    const zone = await getZoneByNameOrId(nameOrId);
    const response = await makeApiRequestWithRetry(`/zones/${zone.id}/settings`);

    const settings = response.result;

    console.log(`\n⚙️  Settings for ${zone.name}:\n`);

    // Group important settings
    const importantSettings = [
      'ssl',
      'always_use_https',
      'min_tls_version',
      'security_level',
      'waf',
      'cache_level',
      'browser_cache_ttl',
      'development_mode',
      'minify',
      'rocket_loader',
    ];

    for (const setting of settings) {
      const isImportant = importantSettings.includes(setting.id);
      const prefix = isImportant ? '⭐' : '  ';
      const value = typeof setting.value === 'object' ? JSON.stringify(setting.value) : setting.value;
      console.log(`${prefix} ${setting.id}: ${value}`);
    }

    console.log('');
    return settings;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to get zone settings');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

/**
 * Purge cache for a zone
 */
async function purgeCache(nameOrId, options = {}) {
  try {
    const zone = await getZoneByNameOrId(nameOrId);

    printInfo(`Purging cache for zone: ${zone.name}`);

    let body = {};

    if (options.all) {
      body = { purge_everything: true };
      printInfo('Purging ALL cached content...');
    } else if (options.urls && options.urls.length > 0) {
      body = { files: options.urls };
      printInfo(`Purging ${options.urls.length} URL(s)...`);
    } else if (options.tags && options.tags.length > 0) {
      body = { tags: options.tags };
      printInfo(`Purging by ${options.tags.length} tag(s)...`);
    } else if (options.prefixes && options.prefixes.length > 0) {
      body = { prefixes: options.prefixes };
      printInfo(`Purging by ${options.prefixes.length} prefix(es)...`);
    } else if (options.hosts && options.hosts.length > 0) {
      body = { hosts: options.hosts };
      printInfo(`Purging by ${options.hosts.length} host(s)...`);
    } else {
      printError('No purge option specified. Use --all, --urls, --tags, --prefixes, or --hosts');
      return false;
    }

    const response = await makeApiRequestWithRetry(`/zones/${zone.id}/purge_cache`, {
      method: 'POST',
      body,
    });

    printSuccess(`Cache purged successfully for ${zone.name}`);
    console.log(`🆔 Purge ID: ${response.result?.id || 'N/A'}\n`);

    return true;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to purge cache');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const { command, args, flags } = parseArgs(process.argv);

  if (!command) {
    console.log(`
Cloudflare Zone Management

Usage:
  node scripts/zones.js list
  node scripts/zones.js get <zone-name-or-id>
  node scripts/zones.js settings <zone-name-or-id>
  node scripts/zones.js purge-cache <zone-name-or-id> [options]

Purge Cache Options:
  --all                    Purge all cached content
  --urls <url1,url2,...>   Purge specific URLs
  --tags <tag1,tag2,...>   Purge by cache tags (Enterprise only)
  --prefixes <p1,p2,...>   Purge by URL prefixes (Enterprise only)
  --hosts <h1,h2,...>      Purge by hostnames

Examples:
  node scripts/zones.js list
  node scripts/zones.js get example.com
  node scripts/zones.js settings example.com
  node scripts/zones.js purge-cache example.com --all
  node scripts/zones.js purge-cache example.com --urls https://example.com/page1,https://example.com/page2
    `);
    return;
  }

  switch (command) {
    case 'list':
      await listZones();
      break;

    case 'get': {
      const [nameOrId] = args;
      if (!nameOrId) {
        printError('Usage: get <zone-name-or-id>');
        process.exit(1);
      }
      await getZone(nameOrId);
      break;
    }

    case 'settings': {
      const [nameOrId] = args;
      if (!nameOrId) {
        printError('Usage: settings <zone-name-or-id>');
        process.exit(1);
      }
      await getZoneSettings(nameOrId);
      break;
    }

    case 'purge-cache': {
      const [nameOrId] = args;
      if (!nameOrId) {
        printError('Usage: purge-cache <zone-name-or-id> [options]');
        process.exit(1);
      }

      const options = {
        all: !!flags.all,
        urls: flags.urls ? String(flags.urls).split(',') : [],
        tags: flags.tags ? String(flags.tags).split(',') : [],
        prefixes: flags.prefixes ? String(flags.prefixes).split(',') : [],
        hosts: flags.hosts ? String(flags.hosts).split(',') : [],
      };

      await purgeCache(nameOrId, options);
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

export { listZones, getZone, getZoneByNameOrId, getZoneSettings, purgeCache };
