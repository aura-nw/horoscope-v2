## Database schema

### account

| Column             | Description                                        |
| ------------------ | -------------------------------------------------- |
| id                 | table's identity                                   |
| created_at         | created time                                       |
| updated_at         | updated time                                       |
| address            |                                                    |
| balances           | balances take from LCD balance                     |
| spendable_balances | spendable balance take from LCD spendable_balances |
| type               | address's type                                     |
| pubkey             | address's pubkey                                   |
| account_number     | account number                                     |
| sequence           | address's sequence                                 |

### account_vesting

| Column            | Description                      |
| ----------------- | -------------------------------- |
| id                | table's identity                 |
| created_at        | created time                     |
| updated_at        | updated time                     |
| account_id        | reference to id in account table |
| orginal_vesting   | original vesting                 |
| delegated_free    | delegated free                   |
| delegated_vesting | delegated vesting                |
| start_time        | start time vesting               |
| end_time          | end time vesting                 |

### block

| Column           | Description                                      |
| ---------------- | ------------------------------------------------ |
| height           | table's identity, block height                   |
| hash             | block hash                                       |
| time             | block time                                       |
| proposer_address | validator who proposed this block, in hex format |
| data             | full log block take from RPC block?height        |

### signature

| Column            | Description                     |
| ----------------- | ------------------------------- |
| id                | table's identity                |
| height            | block height                    |
| block_id_flag     | block id flag                   |
| validator_address | validator address in hex format |
| timestamp         | timestamp                       |
| signature         | signature                       |

### transaction

| Column     | Description                  |
| ---------- | ---------------------------- |
| id         | table's identity             |
| height     | tx's height                  |
| hash       | tx's hash                    |
| codespace  | codespace result tx          |
| code       | code result tx               |
| gas_used   | gas used by tx               |
| gas_wanted | gas wanted by tx             |
| gas_limit  | gas limit by tx              |
| fee        | fee in tx                    |
| timestamp  | timestamp                    |
| data       | full log decoded from RPC tx |
| memo       | memo                         |
| index      | tx's index in one block      |

### transaction_message

| Column    | Description                                                |
| --------- | ---------------------------------------------------------- |
| id        | table's identity                                           |
| tx_id     | reference to id in transaction table                       |
| index     | message index in one transaction                           |
| type      | message type                                               |
| sender    | message sender                                             |
| content   | decoded from message's value                               |
| parent_id | reference to id in this table (used in case authz message) |

### transaction_message_receiver

| Column    | Description                                       |
| --------- | ------------------------------------------------- |
| id        | table's identity                                  |
| tx_msg_id | reference to id in transaction_message table      |
| address   |                                                   |
| reason    | composite key (transfer.recipient/wasm.recipient) |

### event

| Column       | Description                                                         |
| ------------ | ------------------------------------------------------------------- |
| id           | table's identity                                                    |
| tx_id        | reference to id in transaction table (if this is transaction_event) |
| block_height | reference to height in block table                                  |
| tx_msg_index | event of message's index                                            |
| type         | type                                                                |
| source       | source's event (BEGIN_BLOCK_EVENT/END_BLOCK_EVENT/TX_EVENT)         |

### event_attribute

| Column        | Description                          |
| ------------- | ------------------------------------ |
| event_id      | reference to id in event table       |
| key           | key                                  |
| value         | value                                |
| tx_id         | reference to id in transaction table |
| block_height  | reference to id in block table       |
| composite_key | type (in event) + key                |
| index         | event attribute's index in one event |

### code

| Column                 | Description                          |
| ---------------------- | ------------------------------------ |
| code_id                | table's identity, code id in onchain |
| created_at             | created time                         |
| updated_at             | updated time                         |
| creator                | who stored this code on network      |
| data_hash              | data hash of code                    |
| instantiate_permission | instantiate permission for this code |
| type                   | code's type (CW721/CW4973/CW20/...)  |
| status                 | code's status                        |
| store_hash             | hash of tx store code                |
| store_height           | height of tx store code              |

### code_id_verification

| Column                 | Description                    |
| ---------------------- | ------------------------------ |
| id                     | table's identity               |
| created_at             | created time                   |
| updated_at             | updated time                   |
| code_id                | code id                        |
| data_hash              | data hash of code              |
| instantiate_msg_schema | schema for message instantiate |
| query_msg_schema       | schema for message query       |
| execute_msg_schema     | schema for message execute     |
| s3_location            | link s3 save this code         |
| verification_status    | verification status            |
| compiler_version       | compiler version               |
| github_url             | github link to commit          |
| verify_step            | current step verify            |
| verified_at            | verified time                  |

### smart_contract

| Column             | Description                               |
| ------------------ | ----------------------------------------- |
| id                 | table's identity                          |
| created_at         | created time                              |
| updated_at         | updated time                              |
| name               | contract's name                           |
| address            | contract's address                        |
| creator            | contract's creator                        |
| code_id            | code id used to instantiate this contract |
| instantiate_hash   | hash of instantiate tx                    |
| instantiate_height | height of instantiate tx                  |
| version            | contract's version                        |

### smart_contract_event

| Column            | Description                             |
| ----------------- | --------------------------------------- |
| id                | table's identity                        |
| smart_contract_id | reference to id in smart_contract table |
| action            | action with this contract               |
| event_id          | reference to id in event table          |
| index             |                                         |
| created_at        | created time                            |
| updated_at        | updated time                            |

### smart_contract_event_attribute

| Column                  | Description                                   |
| ----------------------- | --------------------------------------------- |
| id                      | table's identity                              |
| smart_contract_event_id | reference to id in smart_contract_event table |
| key                     |                                               |
| value                   |                                               |
| created_at              | created time                                  |
| updated_at              | updated time                                  |

### proposal

| Column            | Description                 |
| ----------------- | --------------------------- |
| created_at        | created time                |
| updated_at        | updated time                |
| proposal_id       | proposal id onchain         |
| voting_start_time |                             |
| voting_end_time   |                             |
| submit_time       |                             |
| deposit_end_time  |                             |
| type              | proposal's type             |
| title             | proposal's title            |
| description       |                             |
| content           | proposal's content          |
| status            |                             |
| tally             |                             |
| initial_deposit   |                             |
| total_deposit     |                             |
| turnout           |                             |
| proposer_address  | address who create proposal |
| count_vote        | count vote result           |

### vote

| Column      | Description                       |
| ----------- | --------------------------------- |
| id          | table's identity                  |
| created_at  | created time                      |
| updated_at  | updated time                      |
| voter       | voter address                     |
| tx_id       | reference to tx vote              |
| vote_option | YES/NO/NO_WITH_VETO/ABSTAIN       |
| proposal_id | reference to id in proposal table |
| txhash      | hash of tx vote                   |
| height      | height of tx vote                 |

### validator

| Column                  | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| id                      | table's identity                                                                |
| created_at              | created time                                                                    |
| updated_at              | updated time                                                                    |
| account_address         | normal account address                                                          |
| commission              | commission rate (rate, max rate, max change rate)                               |
| consensus_address       | consensus address (...valcon... format)                                         |
| consensus_hex_address   | consensus address in hex format                                                 |
| consensus_pubkey        | pubkey consensus                                                                |
| delegators_shares       |                                                                                 |
| delegators_count        |                                                                                 |
| delegators_last_height  |                                                                                 |
| description             | validator's description (details, moniker, website, identity, security contact) |
| image_url               | image url from keybase                                                          |
| index_offset            |                                                                                 |
| jailed                  | true/false                                                                      |
| jailed_until            |                                                                                 |
| min_self_delegation     |                                                                                 |
| missed_block_counter    |                                                                                 |
| operator_address        | operator address (...valoper... format)                                         |
| percent_voting_power    |                                                                                 |
| self_delegation_balance |                                                                                 |
| start_height            |                                                                                 |
| status                  |                                                                                 |
| tokens                  |                                                                                 |
| tombstoned              |                                                                                 |
| unbonding_height        |                                                                                 |
| unbonding_time          |                                                                                 |
| updated_at              |                                                                                 |
| uptime                  |                                                                                 |

### power event

| Column           | Description                          |
| ---------------- | ------------------------------------ |
| id               | table's identity                     |
| tx_id            | reference to id in transaction table |
| height           | transaction height                   |
| validator_src_id | reference to id in validator table   |
| validator_dst_id | reference to id in validator table   |
| type             |                                      |
| amount           |                                      |
| time             |                                      |

### delegator

| Column            | Description                        |
| ----------------- | ---------------------------------- |
| id                | table's identity                   |
| validator_id      | reference to id in validator table |
| delegator_address |                                    |
| amount            |                                    |

### feegrant

| Column       | Description                                                |
| ------------ | ---------------------------------------------------------- |
| id           | table's identity                                           |
| init_tx_id   | reference to id which init feegrant in transaction table   |
| revoke_tx_id | reference to id which revoke feegrant in transaction table |
| granter      | granter address                                            |
| grantee      | grantee address                                            |
| type         |                                                            |
| expiration   |                                                            |
| status       |                                                            |
| spend_limit  |                                                            |
| denom        |                                                            |

### feegrant_history

| Column      | Description                          |
| ----------- | ------------------------------------ |
| id          | table's identity                     |
| tx_id       | reference to id in transaction table |
| feegrant_id | reference to id in feegrant table    |
| granter     | address granter                      |
| grantee     | address grantee                      |
| action      | amount                               |
| denom       |                                      |
| processed   | marked this feegrant is done or not  |

### cw20_contract

| Column              | Description                             |
| ------------------- | --------------------------------------- |
| id                  | table's identity                        |
| smart_contract_id   | reference to id in smart_contract table |
| marketing_info      |                                         |
| total_supply        |                                         |
| symbol              |                                         |
| minter              |                                         |
| name                |                                         |
| track               | mark if tracked                         |
| last_updated_height |                                         |
| decimal             |                                         |

### cw20_activity

| Column                  | Description                                   |
| ----------------------- | --------------------------------------------- |
| id                      | table's identity                              |
| cw20_contract_id        | reference to id in contract table             |
| smart_contract_event_id | reference to id in smart_contract_event table |
| action                  | action with this contract                     |
| sender                  | address                                       |
| from                    |                                               |
| to                      |                                               |
| height                  | height activity                               |
| amount                  |                                               |

### cw20_holder

| Column              | Description                            |
| ------------------- | -------------------------------------- |
| id                  | table's identity                       |
| cw20_contract_id    | reference to id in cw20_contract table |
| address             |                                        |
| amount              |                                        |
| last_updated_height |                                        |

### cw721_contract

| Column      | Description                       |
| ----------- | --------------------------------- |
| id          | table's identity                  |
| contract_id | reference to id in contract table |
| symbol      |                                   |
| minter      |                                   |
| track       | marked true if tracked            |
| name        |                                   |
| created_at  | created time                      |
| updated_at  | updated time                      |

### cw721_token

| Column              | Description                                                                     |
| ------------------- | ------------------------------------------------------------------------------- |
| id                  | table's identity                                                                |
| token_id            | token id                                                                        |
| owner               | owner address                                                                   |
| cw721_contract_id   | reference to id in cw721_contract table                                         |
| last_updated_height |                                                                                 |
| burned              | true if token id is burned                                                      |
| media_info          | json field with onchain (metadata), offchain (link S3 which save media onchain) |
| created_at          | created time                                                                    |
| updated_at          | updated time                                                                    |

### cw721_activity

| Column            | Description                             |
| ----------------- | --------------------------------------- |
| id                | table's identity                        |
| tx_hash           | transaction hash                        |
| sender            | sender address                          |
| action            |                                         |
| cw721_contract_id | reference to id in cw721_contract table |
| cw721_token_id    | reference to id in cw721_token table    |
| from              | address sender                          |
| to                | address recipient                       |
| height            | tx height                               |
| created_at        | created time                            |
| updated_at        | updated time                            |
