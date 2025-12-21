#!/usr/bin/env node
/**
 * Cloudflare R2 Storage Management
 *
 * Usage:
 *   node scripts/r2-storage.js create-bucket <name>
 *   node scripts/r2-storage.js list-buckets
 *   node scripts/r2-storage.js delete-bucket <name>
 *   node scripts/r2-storage.js upload <bucket> <local-path> <object-key>
 *   node scripts/r2-storage.js download <bucket> <object-key> <local-path>
 *   node scripts/r2-storage.js delete-object <bucket> <object-key>
 *   node scripts/r2-storage.js list-objects <bucket> [--prefix <prefix>]
 *
 * Features:
 * - Create and manage R2 buckets
 * - Upload and download objects
 * - List objects with prefix filtering
 * - Delete buckets and objects
 */

import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import {
  makeApiRequestWithRetry,
  getAccountId,
  validateBucketName,
  formatBytes,
  parseArgs,
  printSuccess,
  printError,
  printInfo,
  isMainModule,
  loadConfig,
  CloudflareApiError,
} from './utils.js';

/**
 * Create a new R2 bucket
 */
async function createBucket(name) {
  try {
    validateBucketName(name);
    const accountId = await getAccountId();

    printInfo(`Creating R2 bucket: ${name}`);

    const response = await makeApiRequestWithRetry(`/accounts/${accountId}/r2/buckets`, {
      method: 'POST',
      body: { name },
    });

    const bucket = response.result;

    printSuccess(`R2 bucket created successfully!`);
    console.log(`\n📦 Bucket: ${bucket.name}`);
    console.log(`📅 Created: ${new Date(bucket.creation_date).toLocaleString()}`);
    console.log('');

    return { success: true, name: bucket.name };
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to create R2 bucket');
      printError(error.getUserMessage());

      // Check if bucket name is taken
      if (error.errors.some((e) => e.message.includes('already exists'))) {
        printInfo('Bucket names must be globally unique. Try a different name.');
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { success: false };
  }
}

/**
 * List all R2 buckets
 */
async function listBuckets() {
  try {
    const accountId = await getAccountId();

    const response = await makeApiRequestWithRetry(`/accounts/${accountId}/r2/buckets`);

    const buckets = response.result.buckets;

    if (!buckets || buckets.length === 0) {
      printInfo('No R2 buckets found.');
      return;
    }

    console.log(`\n📦 R2 Buckets (${buckets.length}):\n`);

    for (const bucket of buckets) {
      console.log(`  ${bucket.name}`);
      console.log(`    Created: ${new Date(bucket.creation_date).toLocaleString()}`);
      if (bucket.location) {
        console.log(`    Location: ${bucket.location}`);
      }
      console.log('');
    }
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to list R2 buckets');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Delete an R2 bucket
 */
async function deleteBucket(name) {
  try {
    validateBucketName(name);
    const accountId = await getAccountId();

    printInfo(`Deleting R2 bucket: ${name}`);

    await makeApiRequestWithRetry(`/accounts/${accountId}/r2/buckets/${name}`, { method: 'DELETE' });

    printSuccess(`R2 bucket "${name}" deleted successfully`);
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to delete R2 bucket');
      printError(error.getUserMessage());

      if (error.errors.some((e) => e.message.includes('not empty'))) {
        printInfo('Bucket must be empty before deletion. Delete all objects first.');
      }
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Upload object to R2 bucket
 */
async function uploadObject(bucketName, localPath, objectKey) {
  try {
    validateBucketName(bucketName);

    if (!existsSync(localPath)) {
      throw new Error(`File not found: ${localPath}`);
    }

    const accountId = await getAccountId();
    const fileContent = readFileSync(localPath);
    const fileSize = fileContent.length;

    printInfo(`Uploading ${formatBytes(fileSize)} to ${bucketName}/${objectKey}...`);

    // R2 uses S3-compatible API, we'll use curl for object upload
    await uploadObjectWithCurl(accountId, bucketName, objectKey, localPath);

    printSuccess(`Object uploaded successfully!`);
    console.log(`\n📦 Bucket: ${bucketName}`);
    console.log(`🔑 Key: ${objectKey}`);
    console.log(`📏 Size: ${formatBytes(fileSize)}`);
    console.log('');
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to upload object');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Upload object using curl (for binary data support)
 */
async function uploadObjectWithCurl(accountId, bucketName, objectKey, localPath) {
  const config = loadConfig();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${objectKey}`;

  const curlArgs = [
    '-X',
    'PUT',
    url,
    '-H',
    `Authorization: Bearer ${config.apiKey}`,
    '-H',
    'Content-Type: application/octet-stream',
    '--data-binary',
    `@${localPath}`,
  ];

  const result = spawnSync('curl', curlArgs, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.error) {
    throw new Error(`curl failed: ${result.error.message}`);
  }

  try {
    const response = JSON.parse(result.stdout);

    if (!response.success) {
      throw new CloudflareApiError(
        'Object upload failed',
        response.errors?.[0]?.code || 500,
        response.errors || []
      );
    }
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      throw error;
    }
    // If response is not JSON, assume success (some R2 operations return non-JSON)
    if (result.status !== 0) {
      throw new Error(`Upload failed with status ${result.status}: ${result.stderr}`);
    }
  }
}

/**
 * Download object from R2 bucket
 */
async function downloadObject(bucketName, objectKey, localPath) {
  try {
    validateBucketName(bucketName);
    const accountId = await getAccountId();

    printInfo(`Downloading ${bucketName}/${objectKey}...`);

    // Use curl for binary download
    await downloadObjectWithCurl(accountId, bucketName, objectKey, localPath);

    const fileSize = readFileSync(localPath).length;

    printSuccess(`Object downloaded successfully!`);
    console.log(`\n📦 Bucket: ${bucketName}`);
    console.log(`🔑 Key: ${objectKey}`);
    console.log(`📁 Saved to: ${localPath}`);
    console.log(`📏 Size: ${formatBytes(fileSize)}`);
    console.log('');
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to download object');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Download object using curl
 */
async function downloadObjectWithCurl(accountId, bucketName, objectKey, localPath) {
  const config = loadConfig();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${objectKey}`;

  const curlArgs = ['-X', 'GET', url, '-H', `Authorization: Bearer ${config.apiKey}`, '-o', localPath];

  const result = spawnSync('curl', curlArgs, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.error) {
    throw new Error(`curl failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Download failed with status ${result.status}: ${result.stderr}`);
  }
}

/**
 * Delete object from R2 bucket
 */
async function deleteObject(bucketName, objectKey) {
  try {
    validateBucketName(bucketName);
    const accountId = await getAccountId();

    printInfo(`Deleting object: ${bucketName}/${objectKey}`);

    await makeApiRequestWithRetry(
      `/accounts/${accountId}/r2/buckets/${bucketName}/objects/${objectKey}`,
      { method: 'DELETE' }
    );

    printSuccess(`Object "${objectKey}" deleted successfully`);
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to delete object');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * List objects in R2 bucket
 */
async function listObjects(bucketName, prefix) {
  try {
    validateBucketName(bucketName);
    const accountId = await getAccountId();

    const queryParams = {};
    if (prefix) {
      queryParams.prefix = prefix;
    }

    const response = await makeApiRequestWithRetry(
      `/accounts/${accountId}/r2/buckets/${bucketName}/objects`,
      { queryParams }
    );

    const objects = response.result.objects;

    if (!objects || objects.length === 0) {
      printInfo(`No objects found in bucket "${bucketName}"${prefix ? ` with prefix "${prefix}"` : ''}.`);
      return;
    }

    console.log(`\n📦 Objects in ${bucketName} (${objects.length}):\n`);

    for (const obj of objects) {
      console.log(`  ${obj.key}`);
      console.log(`    Size: ${formatBytes(obj.size)}`);
      console.log(`    Uploaded: ${new Date(obj.uploaded).toLocaleString()}`);
      console.log(`    ETag: ${obj.etag}`);
      console.log('');
    }
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      printError('Failed to list objects');
      printError(error.getUserMessage());
    } else {
      printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const { command, args, flags } = parseArgs(process.argv);

  if (!command) {
    console.log(`
Cloudflare R2 Storage Management

Usage:
  node scripts/r2-storage.js create-bucket <name>
  node scripts/r2-storage.js list-buckets
  node scripts/r2-storage.js delete-bucket <name>
  node scripts/r2-storage.js upload <bucket> <local-path> <object-key>
  node scripts/r2-storage.js download <bucket> <object-key> <local-path>
  node scripts/r2-storage.js delete-object <bucket> <object-key>
  node scripts/r2-storage.js list-objects <bucket> [--prefix <prefix>]

Examples:
  node scripts/r2-storage.js create-bucket media-assets
  node scripts/r2-storage.js upload media-assets ./logo.png images/logo.png
  node scripts/r2-storage.js list-objects media-assets --prefix images/
  node scripts/r2-storage.js download media-assets images/logo.png ./downloaded-logo.png
    `);
    return;
  }

  switch (command) {
    case 'create-bucket': {
      const [name] = args;
      if (!name) {
        printError('Usage: create-bucket <name>');
        process.exit(1);
      }
      await createBucket(name);
      break;
    }

    case 'list-buckets':
      await listBuckets();
      break;

    case 'delete-bucket': {
      const [name] = args;
      if (!name) {
        printError('Usage: delete-bucket <name>');
        process.exit(1);
      }
      await deleteBucket(name);
      break;
    }

    case 'upload': {
      const [bucket, localPath, objectKey] = args;
      if (!bucket || !localPath || !objectKey) {
        printError('Usage: upload <bucket> <local-path> <object-key>');
        process.exit(1);
      }
      await uploadObject(bucket, localPath, objectKey);
      break;
    }

    case 'download': {
      const [bucket, objectKey, localPath] = args;
      if (!bucket || !objectKey || !localPath) {
        printError('Usage: download <bucket> <object-key> <local-path>');
        process.exit(1);
      }
      await downloadObject(bucket, objectKey, localPath);
      break;
    }

    case 'delete-object': {
      const [bucket, objectKey] = args;
      if (!bucket || !objectKey) {
        printError('Usage: delete-object <bucket> <object-key>');
        process.exit(1);
      }
      await deleteObject(bucket, objectKey);
      break;
    }

    case 'list-objects': {
      const [bucket] = args;
      if (!bucket) {
        printError('Usage: list-objects <bucket> [--prefix <prefix>]');
        process.exit(1);
      }
      const prefix = flags.prefix ? String(flags.prefix) : undefined;
      await listObjects(bucket, prefix);
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

export {
  createBucket,
  listBuckets,
  deleteBucket,
  uploadObject,
  downloadObject,
  deleteObject,
  listObjects,
};
