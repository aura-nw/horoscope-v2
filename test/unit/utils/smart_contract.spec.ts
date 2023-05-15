import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import {
  downloadAttachment,
  parseIPFSUri,
  parseFilename,
} from '../../../src/common/utils/smart_contract';

@Describe('Test cw721 service')
export default class SmartContractUtils {
  token_uri = 'ipfs://QmaDJxNVzTBiX3y32BrD2ztRkzZZSGvKUFGtHPFPtBgw3i/1.json';

  @BeforeAll()
  initSuite() {}

  @AfterAll()
  tearDown() {}

  @Test('test getUrl')
  public async testGetUrl() {
    const key = parseIPFSUri(this.token_uri);
    console.log(key);
  }

  @Test('test downloadAttachment')
  public async testdownloadAttachment() {
    const url = parseIPFSUri(this.token_uri);
    const attachment = await downloadAttachment(url);
    console.log(attachment);
  }

  @Test('test parseFilename')
  public async testParseFilename() {
    const filename = parseFilename(this.token_uri);
    console.log(filename);
  }
}
