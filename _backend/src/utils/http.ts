import https from 'https';

/**
 * Fetch JSON from an HTTPS URL with timeout support
 */
export function fetchJson(url: string, timeout = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    request.on('error', reject);

    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}
