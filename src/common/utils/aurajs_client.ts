import { auranw, cosmwasm, ibc } from '@aura-nw/aurajs';
import { Config } from '..';

interface CosmosQuery {
  cosmos: {
    auth: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/auth/v1beta1/query.lcd').LCDQueryClient;
    };
    authz: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/authz/v1beta1/query.lcd').LCDQueryClient;
    };
    bank: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/bank/v1beta1/query.lcd').LCDQueryClient;
    };
    base: {
      node: {
        v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/base/node/v1beta1/query.lcd').LCDQueryClient;
      };
      tendermint: {
        v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/base/tendermint/v1beta1/query.lcd').LCDQueryClient;
      };
    };
    distribution: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/distribution/v1beta1/query.lcd').LCDQueryClient;
    };
    evidence: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/evidence/v1beta1/query.lcd').LCDQueryClient;
    };
    feegrant: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/feegrant/v1beta1/query.lcd').LCDQueryClient;
    };
    gov: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/gov/v1beta1/query.lcd').LCDQueryClient;
    };
    mint: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/mint/v1beta1/query.lcd').LCDQueryClient;
    };
    params: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/params/v1beta1/query.lcd').LCDQueryClient;
    };
    slashing: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/slashing/v1beta1/query.lcd').LCDQueryClient;
    };
    staking: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/staking/v1beta1/query.lcd').LCDQueryClient;
    };
    tx: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/tx/v1beta1/service.lcd').LCDQueryClient;
    };
    upgrade: {
      v1beta1: import('@aura-nw/aurajs/types/codegen/cosmos/upgrade/v1beta1/query.lcd').LCDQueryClient;
    };
  };
}

interface WasmQuery {
  cosmwasm: {
    wasm: {
      v1: import('@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/query.lcd').LCDQueryClient;
    };
  };
}

interface IbcQuery {
  ibc: {
    applications: {
      interchain_accounts: {
        controller: {
          v1: import('@aura-nw/aurajs/types/codegen/ibc/applications/interchain_accounts/controller/v1/query.lcd').LCDQueryClient;
        };
        host: {
          v1: import('@aura-nw/aurajs/types/codegen/ibc/applications/interchain_accounts/host/v1/query.lcd').LCDQueryClient;
        };
      };
      transfer: {
        v1: import('@aura-nw/aurajs/types/codegen/ibc/applications/transfer/v1/query.lcd').LCDQueryClient;
      };
    };
    core: {
      channel: {
        v1: import('@aura-nw/aurajs/types/codegen/ibc/core/channel/v1/query.lcd').LCDQueryClient;
      };
      client: {
        v1: import('@aura-nw/aurajs/types/codegen/ibc/core/client/v1/query.lcd').LCDQueryClient;
      };
      connection: {
        v1: import('@aura-nw/aurajs/types/codegen/ibc/core/connection/v1/query.lcd').LCDQueryClient;
      };
    };
  };
}

interface AuraQuery extends IbcQuery, CosmosQuery, WasmQuery {}
class AuraLcdClient {
  private static lcdEndpoint: string | null = null;

  private static lcdQueries: AuraQuery | null = null;

  public static async connect(endpoint: string): Promise<AuraQuery> {
    if (!this.lcdQueries) {
      this.lcdEndpoint = endpoint;
      this.lcdQueries = {
        ...(await auranw.ClientFactory.createLCDClient({
          restEndpoint: this.lcdEndpoint,
        })),
        ...(await cosmwasm.ClientFactory.createLCDClient({
          restEndpoint: this.lcdEndpoint,
        })),
        ...(await ibc.ClientFactory.createLCDClient({
          restEndpoint: this.lcdEndpoint,
        })),
      };
    }
    return this.lcdQueries;
  }
}

export default await AuraLcdClient.connect(Config.LCD_ENDPOINT);
