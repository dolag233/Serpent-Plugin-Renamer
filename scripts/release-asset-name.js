'use strict';

function releaseAssetName(pluginId, version, platform = 'any') {
  if (!pluginId || !version) throw new Error('pluginId and version are required.');
  return `${pluginId}-${version}-${platform}.zip`;
}

module.exports = { releaseAssetName };
