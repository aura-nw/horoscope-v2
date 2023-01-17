const network = {
  development: {
    rpcEndpoint: 'http://localhost:26657',
    prefix: 'aura',
    denom: 'uaura',
    chainId: 'local-aura',
    broadcastTimeoutMs: 2000,
    broadcastPollIntervalMs: 500,
    // TODO: should calculate from onchain data
    averageBlockTimeMs: 1000,
  },
  test: {
    rpcEndpoint: 'http://localhost:26667',
    prefix: 'aura',
    denom: 'uaura',
    chainId: 'local-aura',
    broadcastTimeoutMs: 2000,
    broadcastPollIntervalMs: 500,
    averageBlockTimeMs: 1000,
  },

  // production: {
  //   rpcEndpoint: 'http://localhost:26657',
  //   prefix: 'aura',
  //   denom: 'uaura',
  //   chainId: 'local-aura',
  //   broadcastTimeoutMs: 2000,
  //   broadcastPollIntervalMs: 500,
  //   // TODO: should calculate from onchain data
  //   averageBlockTimeMs: 1000,
  // },
  // staging: {
  //   rpcEndpoint: 'http://localhost:26657',
  //   prefix: 'aura',
  //   denom: 'uaura',
  //   chainId: 'local-aura',
  //   broadcastTimeoutMs: 2000,
  //   broadcastPollIntervalMs: 500,
  //   // TODO: should calculate from onchain data
  //   averageBlockTimeMs: 1000,
  // }
};
export default network;
