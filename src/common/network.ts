const local = {
  rpcEndpoint: 'http://localhost:26657',
  prefix: 'aura',
  denom: 'uaura',
  chainId: 'local-aura',
  broadcastTimeoutMs: 2000,
  broadcastPollIntervalMs: 500,
  // TODO: should calculate from onchain data
  averageBlockTimeMs: 1000,
};

const localTest = {
  rpcEndpoint: 'http://localhost:26667',
  prefix: 'aura',
  denom: 'uaura',
  chainId: 'local-aura',
  broadcastTimeoutMs: 2000,
  broadcastPollIntervalMs: 500,
  averageBlockTimeMs: 1000,
};

export default { local, localTest };
