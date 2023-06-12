## Crawl Validator

```mermaid
  sequenceDiagram
    autonumber
    participant A as CrawlValidatorService
    participant B as DB
    participant C as RPC/LCD

    loop Interval
      A->>B: Get BlockCheckpoint for CrawlValidator
      activate B
      B-->>A: Return BlockCheckpoint
      deactivate B
      alt not found BlockCheckpoint
        A->>A: Set checkpoint = startBlock config
      end
      A->>A: endBlock = min(crawlValidatorCheckpoint + numberOfBlockPerCall, handleTxCheckpoint)

      A->>B: Get a single validator event from crawlValidatorCheckpoint to endBlock
      activate B
      B-->>A: Return event
      deactivate B
      alt event exist
        A->>C: Get list validators from LCD
        activate C
        C->>A: Return list validators
        deactivate C
        A->>B: Update validator's on-chain data to DB
        A->>B: Update checkpoint = endBlock
      end
    end
```
