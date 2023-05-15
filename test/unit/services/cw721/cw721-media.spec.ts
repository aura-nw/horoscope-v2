import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import Cw721MediaService from '../../../../src/services/cw721/cw721-media.service';

@Describe('Test cw721 service')
export default class Cw721MediaTest {
  broker = new ServiceBroker({ logger: false });

  cw721MediaService = this.broker.createService(
    Cw721MediaService
  ) as Cw721MediaService;

  @BeforeAll()
  initSuite() {}

  @AfterAll()
  tearDown() {}

  @Test('test uploadMediaToS3')
  async testUploadMediaToS3() {
    const result = await this.cw721MediaService.uploadMediaToS3(
      'ipfs://QmPERcPAAjDMLdTjkuTagmCkCq86H9wWyU4JDTSyTWr7Y6/4.jpg'
    );
    console.log(result);
  }

  @Test('test getTokensMediaInfo')
  async testGetTokensMediaInfo() {
    const tokenInfo = await this.cw721MediaService.getTokensMediaInfo([
      {
        contractAddress:
          'aura1pvrwmjuusn9wh34j7y520g8gumuy9xtl3gvprlljfdpwju3x7ucsge6gzp',
        onchainTokenId: '100',
        cw721_token_id: 1,
      },
    ]);
    console.log(tokenInfo);
  }
}
