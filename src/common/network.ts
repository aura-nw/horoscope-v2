const Network = [
  {
    chainName: 'Aura Devnet',
    chainId: 'aura-testnet-2',
    RPC: ['https://rpc.dev.aura.network'],
    LCD: ['https://lcd.dev.aura.network'],
    databaseName: 'local_auratestnet',
  },
  {
    chainName: 'Aura Serenity',
    chainId: 'serenity-testnet-001',
    RPC: ['https://rpc.serenity.aura.network'],
    LCD: ['https://lcd.serenity.aura.network'],
    databaseName: 'local_serenitytestnet001',
  },
  {
    chainName: 'Theta Testnet',
    chainId: 'theta-testnet-001',
    RPC: ['https://rpc.theta.aura.network'],
    LCD: ['https://lcd.theta.aura.network'],
    databaseName: 'local_thetatestnet001',
  },
  {
    chainName: 'Osmosis Testnet',
    chainId: 'osmo-test-4',
    RPC: ['https://testnet-rpc.osmosis.zone'],
    LCD: ['https://osmosistest-lcd.quickapi.com'],
    databaseName: 'local_osmotest4',
  },
  {
    chainName: 'Osmosis Mainnet',
    chainId: 'osmosis-1',
    RPC: ['https://rpc.osmosis.zone'],
    LCD: ['https://lcd.osmosis.zone'],
    databaseName: 'local_osmosis1',
  },
  {
    chainName: 'Evmos Testnet',
    chainId: 'evmos_9000-4',
    RPC: ['https://rpc.evmos.aura.network'],
    LCD: ['https://lcd.evmos.aura.network'],
    databaseName: 'local_evmos90004',
  },
  {
    chainName: 'Aura Euphoria',
    chainId: 'euphoria-2',
    RPC: ['https://rpc.euphoria.aura.network'],
    LCD: ['https://lcd.euphoria.aura.network'],
    databaseName: 'euphoria-2',
  },
  {
    chainName: 'Cosmos Mainnet',
    chainId: 'cosmoshub-4',
    RPC: ['https://rpc.cosmos.network'],
    LCD: [
      'https://cosmos-api.polkachu.com',
      'https://cosmos-api.cyphercore.io',
      'https://cosmoshub-api.lavenderfive.com:443',
    ],
    databaseName: 'local_cosmoshub4',
  },
];

export default Network;
