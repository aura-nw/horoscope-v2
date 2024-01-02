import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import ChainRegistry from '../../../../src/services/crawl-tx/chain.registry';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import CrawlBlockService from '../../../../src/services/crawl-block/crawl_block.service';
import { Block, Event } from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';
import { getProviderRegistry } from '../../../../src/services/crawl-tx/provider.registry';

@Describe('Test crawl block service')
export default class CrawlBlockTest {
  blocks = [
    {
      block_id: {
        hash: 'C084A4FDBE3473CE55CF4EFFF2F8153B07B6CE740717ABD26B437898EC95CF1E',
        parts: {
          total: 1,
          hash: '1D23B62D986F5F1EB48C5E9CE1A61F72A0DB925EA31FFA27B0AFAE6D1A9AAC03',
        },
      },
      block: {
        header: {
          version: { block: '11' },
          chain_id: 'euphoria-2',
          height: '2001002',
          time: '2022-11-25T05:01:21.235286829Z',
          last_block_id: {
            hash: 'D633D37EA74467C060F4E06EE5C569C0C705EEECF8A6E94621E8A7532B01FFDA',
            parts: {
              total: 1,
              hash: '9B92B9789FDA3A3B51CF41A7009D10AE53E39F2199027ACFDF79913599669138',
            },
          },
          last_commit_hash:
            '439089FFB6392D07E83F0FA8C1D43FA0D98485E221F5F509D00315E8795C785B',
          data_hash:
            'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
          validators_hash:
            '26F58F551B888E91B9A6FC6863D0A879B24F548F17BF974BA9E91DA7FC8F4C56',
          next_validators_hash:
            'B86EC94CA2C0D0423E5C6AD7FB4C2B734479E3404536B158EB0D5E6F3F523BEE',
          consensus_hash:
            '048091BC7DDC283F77BFBF91D73C44DA58C3DF8A9CBC867405D8B7F3DAADA22F',
          app_hash:
            '52C2F4C896828A00B221AFAAF9DA128B7B3FA38426F226F0FCA49EB9258FE0D6',
          last_results_hash:
            'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
          evidence_hash:
            'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
          proposer_address: 'BCF7CE808B45BFD44DECA498A1029DDE283654A3',
        },
        data: { txs: [] },
        evidence: { evidence: [] },
        last_commit: {
          height: '2001001',
          round: 0,
          block_id: {
            hash: 'D633D37EA74467C060F4E06EE5C569C0C705EEECF8A6E94621E8A7532B01FFDA',
            parts: {
              total: 1,
              hash: '9B92B9789FDA3A3B51CF41A7009D10AE53E39F2199027ACFDF79913599669138',
            },
          },
          signatures: [
            {
              block_id_flag: 2,
              validator_address: 'B00D6A3D473A303E8058810754074F8106804767',
              timestamp: '2022-11-25T05:01:21.352736255Z',
              signature:
                '/Jt3Xs4621hWk9T7rN6opU0y1lcI4mA/WuW3LdAKWMUw0fiAgHyJaN5rCP8oZjHqdCXz7PvwKuQZ5H7qxNqeCw==',
            },
            {
              block_id_flag: 2,
              validator_address: '65CF3004781B3B7B3ECD3EA4B86BC68C6ECD9A3B',
              timestamp: '2022-11-25T05:01:21.151026595Z',
              signature:
                '8za3FL/cTzLQypNDfvhJxZ6R22QQOD2pfgJ17H+FpNG+yuDs8/kZznlBdHhfD5vULs/WV0/K7bEwJKPA2VDzAA==',
            },
            {
              block_id_flag: 2,
              validator_address: '49DFD57C87FC3D60268459B8DD9F9C3A9920BFF9',
              timestamp: '2022-11-25T05:01:21.226899382Z',
              signature:
                'YmeygnXn8lWs7LmYGPy8apUJrqpg1rdtZFzhdKStSBBdNVJ1WFAfcNtahc1MOtToYUFGDw0k3xlc3y/NPsaAAA==',
            },
            {
              block_id_flag: 2,
              validator_address: 'B3A0FEC1F5634FC311C1A7EDC64C273E116F1431',
              timestamp: '2022-11-25T05:01:21.230234128Z',
              signature:
                'SI5pyymunrqhMwBtHvfxA5YiMU2jJKXxMfdoIefbJnVGw+GwFiljSv/buv5DAck4fEk68i1+I9lbV92Y9q3fCQ==',
            },
            {
              block_id_flag: 2,
              validator_address: '5D6B242480442143C95A262C3DA1F13D7D01CE48',
              timestamp: '2022-11-25T05:01:21.223540435Z',
              signature:
                'ij30K30mGc8yexJnePr3ZLJ6mtfsXbWRLzEwq2MP3rnuCPrypfcOvmV84ulk28afEZHBgQna6JKXkMW2yo+IAg==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: '24FBDCAF3E8FACA0F77E5BB433AD1AB61754A2F0',
              timestamp: '2022-11-25T05:01:21.444039056Z',
              signature:
                'Bef6hJsKqYVB7v3Oguc+X++nc1VV2Z7okoS5R6z/WEKi5aCU3zPq5aXSMjVNIUupnjl6HRsNmP9Ol/YRhL/tAw==',
            },
            {
              block_id_flag: 2,
              validator_address: '3BEC3222492181029C74078ECC3FC1C3CDB11962',
              timestamp: '2022-11-25T05:01:21.230570355Z',
              signature:
                '1HexcHNxAb+OVSYLJSSyG0RgDdT6k1uSZ6e76iq2QYk9zVkV1t55IdD/pN/tysYolT3NeNRNmItQQ0KTaeLmBA==',
            },
            {
              block_id_flag: 2,
              validator_address: 'FCA1D149A74B89EAFAD15A2275E7CBEEC3E746CA',
              timestamp: '2022-11-25T05:01:21.24149196Z',
              signature:
                'BfbbPXnhZTyamLqGj/19LL89lURRPAgdIOhR8Z0CoLQNDr9qz5hj8PRfz/CnKAkoKHPV6GCXypKMM4dbopjZBA==',
            },
            {
              block_id_flag: 2,
              validator_address: '2FD1299B202D8158155FE9BA31E4BD50B53A838A',
              timestamp: '2022-11-25T05:01:21.233314398Z',
              signature:
                'GCzPwOkUnlLDswkZwba/dP1tNUYCtflab3BOfoleSWbIPeWmXNIbAcVci0ImfNr3umn6B3oEZv9uu81qetBaAA==',
            },
            {
              block_id_flag: 2,
              validator_address: 'C4960F37A533AB5B9C8356EA669A542EF54BC60B',
              timestamp: '2022-11-25T05:01:21.158821207Z',
              signature:
                'OdXFudfBcMWEYX5eJ4KuP4X2lkoWFASp7CB6LvaK8mgqBaBvlJz4cyDfzGoyUSIrEacz+pbXn3OI8JVwq2iYDw==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: 'FDD91096C87B0E6A8AF32C3EDB097F8BEAF707CD',
              timestamp: '2022-11-25T05:01:21.171122012Z',
              signature:
                '1TdUYxqmciHxdABFEpW/aJONmJenez69Zb9TpyGzmUnqrHkdNgDIw2M+F8i/VgKaME+LWYgSKuV3AKMjrvGVAg==',
            },
            {
              block_id_flag: 2,
              validator_address: '6461F0B7BE86309BB30654A4B5E21E1D0FCEA00D',
              timestamp: '2022-11-25T05:01:21.156049513Z',
              signature:
                'JXkBqdqdXt99jKYQAldIV+YhA4Wu29yM/zeTBilaxdmF434rHMrjf27XdG7he7DHgRLbiOwK9sbmmEJ/oRfiCg==',
            },
            {
              block_id_flag: 2,
              validator_address: '06A77FEDE02C42D214425F1C30AAF2D162904C91',
              timestamp: '2022-11-25T05:01:21.216685749Z',
              signature:
                'Iv2cFmnRcMgEk4du8AgW+tN0qPQY/M+bYqAjOCc8srSuo34Jq57M/kWRz6UNMulX7X880UwZhLZBadTPpOiLAw==',
            },
            {
              block_id_flag: 2,
              validator_address: '853E0DDA67F88D44DDF48B2F48F3CDD3A7F49318',
              timestamp: '2022-11-25T05:01:21.239861911Z',
              signature:
                'vScQx8LZJn8XAQtiqPWaQTRJEbcm3IPm45Y7cXM1KwFwes7+O7LME0B2tJJhSlX1fjYHPaGlmRdCVBMZZq8nDQ==',
            },
            {
              block_id_flag: 2,
              validator_address: '10B32424766A7DA8820C216DC4DD7042B05CB5EF',
              timestamp: '2022-11-25T05:01:21.221597747Z',
              signature:
                'SDOWwYan41M/EW/IpUM4F/IinUUekAPB0AoWTirEOxkfz0D9xDJ0Bq6tZMHhNiq3Sf0xBSYj9XG5lifvjK55Cw==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: '8799D6C944E496EE8EE034A48578BD6868D2683F',
              timestamp: '2022-11-25T05:01:21.221919696Z',
              signature:
                'v723K5n4fFW+TOSmBqDkQPyFXJmnlBo6wXPafqg3oNQhJqc76MamhfhU2EBN0Ep/T6+L5ojxlV4pM507B60HCw==',
            },
            {
              block_id_flag: 2,
              validator_address: '6CE49B8D4C97AA9695861F49172D9744B15A5602',
              timestamp: '2022-11-25T05:01:21.237957705Z',
              signature:
                'RDHOtl4sKDl1fyvL0oYUCufBkTChETSkxjLOAMk9wfYkmXHtL8t6ydBDo/nuCwhPCTGd7puUTsvmmPR7adMYCg==',
            },
            {
              block_id_flag: 2,
              validator_address: '3F3573431332FAD891DF67497760D6A459DA555F',
              timestamp: '2022-11-25T05:01:21.154346662Z',
              signature:
                'lRC2oeE3M63wz96rg9K7iCp3uXX32FTEv1o8BE5E7QN0TQcIFo5q1f3azhZcoHNaB8HQ4axBuk7lvu+WzD0FCQ==',
            },
            {
              block_id_flag: 2,
              validator_address: '97CBC1D1ED661E583BD8861B644564C7FAE8D49A',
              timestamp: '2022-11-25T05:01:21.240788608Z',
              signature:
                '9C1lmAa+18wuAkuc29++uctvCrNYUSyxAPjnpbMyijdyHn0DdXxHMGtYjto/2JvBxuSwtoz6XrowIaXBllorAw==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: '9B3069057E221CB93D7E71972CCE122A8EE75B09',
              timestamp: '2022-11-25T05:01:21.245933747Z',
              signature:
                '2IAx6G6n6DHeSd1N7SfLBNDN2XPE25GABXvcxtKKhgNO+Ywx6fJMhcQybi3yf+MNFyUQLOAWkUN5NV5UfVkNDQ==',
            },
            {
              block_id_flag: 2,
              validator_address: '88D37DBD2C542E555EF010583BAAB7C46EFD29AB',
              timestamp: '2022-11-25T05:01:21.237631288Z',
              signature:
                'u3DBTDJHaoF4P6ZUCSqs1Jk0LGBaOkFIz8uT9rJHsHky1SzMgu0x8ufQiQ9hjz5HbmLmbtMb13AKaVusd7hCBw==',
            },
            {
              block_id_flag: 2,
              validator_address: 'F8016EED9235AA76BD2FDD8483C7FDCBD8C7F614',
              timestamp: '2022-11-25T05:01:21.245359939Z',
              signature:
                'M0fh0gQU4jw47HTBm5Rb9HYv/mGqHlrOxF/DnJ0p0tsdYgUIdpF314fHPbxXQGgNkzIaRVSkU7dJzANpKyv7Cg==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: '2B87BCDC1CF5F3AF7D7D042D26B658311268A606',
              timestamp: '2022-11-25T05:01:21.321464782Z',
              signature:
                'KEKvgyaM+oZv9GGYzdtsgXYk171IN3MLAlsh78qXkoVgwm26rzlY8yKu2IUGm7A3JQEMMMdDJfFvsfv4bhlWAg==',
            },
            {
              block_id_flag: 2,
              validator_address: '5424B288DBA567A9137BFC194938F6053B3D39FD',
              timestamp: '2022-11-25T05:01:21.249268486Z',
              signature:
                'YhrA6nKH4Q4Ahv26CXgYwTWFtyR8Ouk3U9QoYJa8WhK90QMcnOM4ZG/QnD7fJBDUy0wY9YdE0r4rsWqpvEtXCw==',
            },
            {
              block_id_flag: 2,
              validator_address: '2955E3A6E8D217B9FE0E69FEA5B070122B67BA57',
              timestamp: '2022-11-25T05:01:21.274120378Z',
              signature:
                'xIMq+WcCjm648ccpEBs2aTZ+bgHd4RbNPHaFORNdX+5SCH+Eem70k1ANDGoVWUpsa2LIKdIIWF1QOGFrq2K5DQ==',
            },
            {
              block_id_flag: 2,
              validator_address: 'D3E430773F966C82862C66DE242BD4794EF716D2',
              timestamp: '2022-11-25T05:01:21.17867129Z',
              signature:
                'g9iJXEDKgGedQaBWHZ/2TougUyEg+oM1MN8ExjdrcVoOeDTjtN0ufAeYijWz4OdpAdgoUmVTuRu7KBjXPCZyDA==',
            },
            {
              block_id_flag: 2,
              validator_address: '814697A925F6B0F1E2B92DBAB2C8AE78A9D3E62F',
              timestamp: '2022-11-25T05:01:23.002301542Z',
              signature:
                'DoV5KMEQ4xt3fO3XwaBh4CfV1GoK3HF/JKYLql4JrFtxFaKHmLjsAz0zxophI9T2+/zxLk04dV9Jl5mXGNLWDg==',
            },
            {
              block_id_flag: 2,
              validator_address: '76C98C849089E6214EF974261A8638D8882882D4',
              timestamp: '2022-11-25T05:01:21.310168431Z',
              signature:
                'XxDa737wFvIlIuMJHSgvluHPYG43Hz3FVuMI07yuyHUHUM83BTSHM5h1Nd2XtR7KnbUKX5j90UNvklX6wGY2AA==',
            },
            {
              block_id_flag: 2,
              validator_address: 'BCF7CE808B45BFD44DECA498A1029DDE283654A3',
              timestamp: '2022-11-25T05:01:21.291773259Z',
              signature:
                'QyHw+4ui3q2pHv8Ff+rMJGatAcU/vjjRbrNsjkQ3tp36EIrrQ6RvW9BV7VxnzpOJM4ZRL+8R9cqSLqo9bYGrBw==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: 'B5985F1BF8DFC004714ACD951ED5B928040613E5',
              timestamp: '2022-11-25T05:01:21.244495775Z',
              signature:
                'ZcV9dSGT818VLkFuaN9/3TEgRqBh6WZHpFg5tPh7z+Ezo46dHLUaoYpr+dU9znQcMH/c0huvHxD4Mfa8ZrmiCA==',
            },
            {
              block_id_flag: 2,
              validator_address: 'A18F5CF71A9789F062308DC46F2261BA13DF6DC6',
              timestamp: '2022-11-25T05:01:21.304827739Z',
              signature:
                'JGYdtbCnXSd7oS+l0EMVWqlWuxrBq8L/l9y2mYZI26pKMvingpcu1TVhz9a6rjKEPQnOshnBrw27p7hHEaqeCg==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: '3A42B5DC95BE12B09FE9C5B83664A8602F033886',
              timestamp: '2022-11-25T05:01:21.33397971Z',
              signature:
                '9aFcJVQk04PLuB8KzkVfJeUVsL2H/jIgaNKqqTj3gLORXTpO+7tA9dux52v2O/OLj8Oqc5nRWU0DEIU4b/96Aw==',
            },
            {
              block_id_flag: 2,
              validator_address: '194276DF46C6F08BE4DDEB45D9F5FC13D1E9E297',
              timestamp: '2022-11-25T05:01:21.275641699Z',
              signature:
                'AZwEhY9W89qpSpDJH0Ahhi5tb8P+hXFVI5SBi+wQLmLnLmESH54sWAJJ2hF6Xz8jXYktuHTupVXZC/U278VlAw==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: 'F9B2A464080D028CB08D3795F75239ADE074A2BF',
              timestamp: '2022-11-25T05:01:21.235942727Z',
              signature:
                'Qgd6rZ9hal8BQmKlSaRBP5F1e+FnCOemnCieUEhnvk9FlW/0VvXapvOqlIFNh0mqNTKuYo/5RkMuY7oFWITCBw==',
            },
            {
              block_id_flag: 1,
              validator_address: '',
              timestamp: '0001-01-01T00:00:00Z',
              signature: null,
            },
            {
              block_id_flag: 2,
              validator_address: 'D65AF49E9DC74D1C549D4BEC04D4939AED5BAA91',
              timestamp: '2022-11-25T05:01:21.181123046Z',
              signature:
                'ue9ZspKZBo3RqE9siUOCO5dEm8iSv8Ys0B35HCnIwuDoyY6fc/lsrBuRHIBaws+tfprmAZGoV1aWXw1aEIXWCg==',
            },
            {
              block_id_flag: 2,
              validator_address: '0B366A7B3DCAC639C6D263E7B51E44242A986C2E',
              timestamp: '2022-11-25T05:01:21.235286829Z',
              signature:
                'Qf2QQPy6r0iEmvsUOubrCcp8ULHHLwv05HDBrvvZPlJuX8SnBK5nFGJ1Mad2obDkc+hpW/xwutPO/PyaspjACA==',
            },
          ],
        },
      },
      block_result: {
        height: '2001002',
        txs_results: null,
        begin_block_events: [
          {
            type: 'coin_received',
            attributes: [
              {
                key: 'cmVjZWl2ZXI=',
                value:
                  'YXVyYTFtM2gzMHdsdnNmOGxscnV4dHB1a2R2c3kwa20ya3VtOG44czY5ZQ==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'coinbase',
            attributes: [
              {
                key: 'bWludGVy',
                value:
                  'YXVyYTFtM2gzMHdsdnNmOGxscnV4dHB1a2R2c3kwa20ya3VtOG44czY5ZQ==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'coin_spent',
            attributes: [
              {
                key: 'c3BlbmRlcg==',
                value:
                  'YXVyYTFtM2gzMHdsdnNmOGxscnV4dHB1a2R2c3kwa20ya3VtOG44czY5ZQ==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'coin_received',
            attributes: [
              {
                key: 'cmVjZWl2ZXI=',
                value:
                  'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'transfer',
            attributes: [
              {
                key: 'cmVjaXBpZW50',
                value:
                  'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFtM2gzMHdsdnNmOGxscnV4dHB1a2R2c3kwa20ya3VtOG44czY5ZQ==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFtM2gzMHdsdnNmOGxscnV4dHB1a2R2c3kwa20ya3VtOG44czY5ZQ==',
                index: true,
              },
            ],
          },
          {
            type: 'mint',
            attributes: [
              {
                key: 'Ym9uZGVkX3JhdGlv',
                value: 'MC4wMzEyMTU5OTU0NTI4ODc2NjA=',
                index: true,
              },
              {
                key: 'aW5mbGF0aW9u',
                value: 'MC4xMTM4NzUyMTYwMjA5OTc0MTY=',
                index: true,
              },
              {
                key: 'YW5udWFsX3Byb3Zpc2lvbnM=',
                value: 'NTMyNjk4MTc5MzAzNDMuNDY0ODY2NDAyNzQ5ODIxOTI4',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyMw==', index: true },
            ],
          },
          {
            type: 'coin_spent',
            attributes: [
              {
                key: 'c3BlbmRlcg==',
                value:
                  'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'coin_received',
            attributes: [
              {
                key: 'cmVjZWl2ZXI=',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'transfer',
            attributes: [
              {
                key: 'cmVjaXBpZW50',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                index: true,
              },
              { key: 'YW1vdW50', value: 'OTc5NzIyM3VlYXVyYQ==', index: true },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                index: true,
              },
            ],
          },
          {
            type: 'proposer_reward',
            attributes: [
              {
                key: 'YW1vdW50',
                value: 'NDE3NTc5LjEwOTE5OTQyMjQ0ODkzMTcwMnVlYXVyYQ==',
                index: true,
              },
              {
                key: 'dmFsaWRhdG9y',
                value:
                  'YXVyYXZhbG9wZXIxMDNmOXh4amo5OTM4ZGg5Z2h4dGV0NTNjYXQ0ZGw0MmszNTdrOHk=',
                index: true,
              },
            ],
          },
          {
            type: 'commission',
            attributes: [
              {
                key: 'YW1vdW50',
                value: 'MjA4NzguOTU1NDU5OTcxMTIyNDQ2NTg1dWVhdXJh',
                index: true,
              },
              {
                key: 'dmFsaWRhdG9y',
                value:
                  'YXVyYXZhbG9wZXIxMDNmOXh4amo5OTM4ZGg5Z2h4dGV0NTNjYXQ0ZGw0MmszNTdrOHk=',
                index: true,
              },
            ],
          },
          {
            type: 'rewards',
            attributes: [
              {
                key: 'YW1vdW50',
                value: 'NDE3NTc5LjEwOTE5OTQyMjQ0ODkzMTcwMnVlYXVyYQ==',
                index: true,
              },
              {
                key: 'dmFsaWRhdG9y',
                value:
                  'YXVyYXZhbG9wZXIxMDNmOXh4amo5OTM4ZGg5Z2h4dGV0NTNjYXQ0ZGw0MmszNTdrOHk=',
                index: true,
              },
            ],
          },
          {
            type: 'commission',
            attributes: [
              {
                key: 'YW1vdW50',
                value: 'MjAzMzYuMzA0NTIwMzgwMDA4OTQ3ODQ3dWVhdXJh',
                index: true,
              },
              {
                key: 'dmFsaWRhdG9y',
                value:
                  'YXVyYXZhbG9wZXIxaHNlNDJtZWNoeDQ0NDJlZHc5cGZnbnkycjc1Y3pudGhxbGNsNjY=',
                index: true,
              },
            ],
          },
          {
            type: 'rewards',
            attributes: [
              {
                key: 'YW1vdW50',
                value: 'MjkwNTE4LjYzNjAwNTQyODY5OTI1NDk1OXVlYXVyYQ==',
                index: true,
              },
              {
                key: 'dmFsaWRhdG9y',
                value:
                  'YXVyYXZhbG9wZXIxaHNlNDJtZWNoeDQ0NDJlZHc5cGZnbnkycjc1Y3pudGhxbGNsNjY=',
                index: true,
              },
            ],
          },
        ],
        end_block_events: [
          {
            type: 'coin_spent',
            attributes: [
              {
                key: 'c3BlbmRlcg==',
                value:
                  'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MTg2MDc0NDAxODk0MnVlYXVyYQ==',
                index: true,
              },
            ],
          },
          {
            type: 'coin_received',
            attributes: [
              {
                key: 'cmVjZWl2ZXI=',
                value:
                  'YXVyYTF0eWdtczN4aGhzM3l2NDg3cGh4M2R3NGE5NWpuN3Q3bDZkenVkNg==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MTg2MDc0NDAxODk0MnVlYXVyYQ==',
                index: true,
              },
            ],
          },
          {
            type: 'transfer',
            attributes: [
              {
                key: 'cmVjaXBpZW50',
                value:
                  'YXVyYTF0eWdtczN4aGhzM3l2NDg3cGh4M2R3NGE5NWpuN3Q3bDZkenVkNg==',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MTg2MDc0NDAxODk0MnVlYXVyYQ==',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
                index: true,
              },
            ],
          },
        ],
        validator_updates: [
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'W1NsG3hcb30M7AkTDeGGUAnRXakm1WtXcrt6dvtaYx4=',
                },
              },
            },
            power: '7497',
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'Hn1WHJ6mngHVQv8QVw5sS3p/W3o3ctq6njMNjuvw5no=',
                },
              },
            },
            power: '3568',
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'FgpBWraKi0h8CD7MhgxhrSZllpy50HUq/FV/t6iw4Ic=',
                },
              },
            },
            power: '1550',
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'tdGb2d7upC2B64pGBDcc2ywuAYTWx2ep4pa40Sd4uyM=',
                },
              },
            },
            power: '6',
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'fZxbKf3LrYoByRvp3p5g6srhlz7S31SuaN4sUH2VTaI=',
                },
              },
            },
            power: '5',
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: '+JPNqJrTbVm23hScXjd8fWW5zrX6sRaubTK7gbVzsPg=',
                },
              },
            },
            power: '3',
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: '7/j7pn5Wz7koDN0LgAzSGbcAbu8LIW8+yAH2sUUfo8w=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'PMtxj9czl1Sd6BLfKVR5fVzWMau4VhbmyQ9zVOYCyQ8=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'rmqLetLV2U3jujZwYDjQUDey/LFffevHgX+BHff4QuE=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'OnVgp+Ptc0xJFvRcXaFEgoc4l0t8pBpaJ3L0p1XQflw=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'qoznvCGQy6ri2WcMqi8zpKXZ5oueXJMrZbnECpDxtOE=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'Pmx3FDRxTDqaZg+ho3WcHjaZVw2FMtIwI3EyPciNlR0=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'UDEIPiiFN0O6rD+N6nKGHIBOmpmN31vJgjFn5xA/iKo=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'zI/o6so2xzxyvi1Oq5RCROxSQvmvH59cIsNs0s67ggM=',
                },
              },
            },
          },
          {
            pub_key: {
              Sum: {
                type: 'tendermint.crypto.PublicKey_Ed25519',
                value: {
                  ed25519: 'BPmG32MFR8fC8O5eX0D9uXZckN7h4k6vvLczSa57z88=',
                },
              },
            },
          },
        ],
        consensus_param_updates: {
          block: { max_bytes: '22020096', max_gas: '-1' },
          evidence: {
            max_age_num_blocks: '100000',
            max_age_duration: '172800000000000',
            max_bytes: '1048576',
          },
          validator: { pub_key_types: ['ed25519'] },
        },
      },
    },
  ];

  broker = new ServiceBroker({ logger: false });

  crawlBlockService?: CrawlBlockService;

  crawlTxService?: CrawlTxService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    this.crawlBlockService = this.broker.createService(
      CrawlBlockService
    ) as CrawlBlockService;
    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;

    const providerRegistry = await getProviderRegistry();
    const chainRegistry = new ChainRegistry(
      this.crawlTxService.logger,
      providerRegistry
    );
    chainRegistry.setCosmosSdkVersionByString('v0.45.7');
    this.crawlBlockService.setRegistry(chainRegistry);

    this.crawlBlockService.getQueueManager().stopAll();
    this.crawlTxService.getQueueManager().stopAll();
    await knex.raw(
      'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
    );
  }

  @Test('Parse block and insert to DB')
  public async testHandleBlocks() {
    await this.crawlBlockService?.handleListBlock(this.blocks);
    const block = await Block.query().where('height', 2001002);
    const beginBlockEvents = await Event.query()
      .where('block_height', 2001002)
      .andWhere('source', Event.SOURCE.BEGIN_BLOCK_EVENT);
    const endBlockEvents = await Event.query()
      .where('block_height', 2001002)
      .andWhere('source', Event.SOURCE.END_BLOCK_EVENT);

    expect(block).not.toBeUndefined();
    expect(beginBlockEvents.length).toEqual(16);
    expect(endBlockEvents.length).toEqual(4);
  }

  @AfterAll()
  async tearDown() {
    this.crawlBlockService?.getQueueManager().stopAll();
    this.crawlTxService?.getQueueManager().stopAll();
    await Promise.all([
      knex.raw(
        'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
      ),
      this.crawlBlockService?._stop(),
      this.crawlTxService?._stop(),
    ]);
  }
}
