# Scraper API

API service for processing Across data.

## Usage example

* Provide environment variables
```shell script
cp .env.sample .env
```    

* Run with docker-compose 
```shell script
docker-compose up
```  

* Lint source code files
```shell script
npm run lint
```

## Deployment

We are using feature branches to ensure a smooth CI process

1. Always start new feature branches from the latest `master`. When opening PRs, make sure your branch is up-to-date with the latest master, otherwise rebase the feature branch

```bash
git checkout master && git pull && git checkout -b my-feature-branch
// if new commits were pushed to master
git rebase master
```

2. Feature branches have to be merged twice:
  - `feature-branch` -> `stage`: The branch will be deployed on the staging environment for testing purposes
  - `feature-branch` -> `master`: The branch will be deployed on the production environment for testing purposes. Most of the time, all feature branches will be merged into `stage` branch before the `master` branch.

3. Update the `stage` branch with the latest master whenever is needed 

## Run modes

The application has the ability the load modules and dependencies depending on predefined running modes that can be one or multiple of: scraper, normal, test. Use the RUN_MODES env variable to configure the behaviour of the application:

```
RUN_MODES=normal,test
```

In order to configure a module to behave differently depending on the running mode, use the static `forRoot` method like in the example below:

```ts
@Module({})
export class ExampleModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: ExampleModule, providers: [], controllers: [], imports: [], exports: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal)) {
      module = {
        ...module,
        controllers: [...module.controllers, ...],
        providers: [...module.providers, ...],
        imports: [...module.imports, ...],
        exports: [...module.exports, ...],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Scraper)) {
      module = {
        ...module,
        controllers: [...module.controllers, ...],
        providers: [...module.providers, ...],
        imports: [...module.imports, ...],
        exports: [...module.exports, ...],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        controllers: [...module.controllers, ...],
        providers: [...module.providers, ...],
        imports: [...module.imports, ...],
        exports: [...module.exports, ...],
      };
    }

    return module;
  }
}
```

## Queuing mechanism

```mermaid
flowchart TD
    A(publish blocks) -->|BlocksEventsQueueMsg| B(BlocksEventsQueue)

    B -->|BlockNumberQueueMsg| C(BlockNumberQueue)
    B -->|FillEventsQueueMsg| D(FillEventsQueue)
    B -->|FillEvents2QueueMsg| E("FillEventsQueue2 \n (not implemented)")
    style E stroke:red,color:red
    B -->|SpeedUpEventsQueueMsg| F(SpeedUpEventsQueue)
    B -->|SpeedUpEventsQueue2Msg| G("SpeedUpEventsQueue2 \n (not implemented)")
    style G stroke:red,color:red

    C -->|TokenDetailsQueueMsg| H(TokenDetailsQueue)
    C -->|DepositReferralQueueMsg| I(DepositReferralQueue)
    C -->|SuggestedFeesQueueMsg| J(SuggestedFeesQueue)
    
    D --> |DepositFilledDateQueueMsg| K(DepositFilledDateQueue)
    D --> |TrackFillEventQueueMsg| L(TrackFillEventQueue)

    H --> |TokenPriceQueueMsg| M(TokenPriceQueue)
  ```


## How referral rewards work

### Overview

1. The whole rewards implementation is based on the main `deposit` table which is mapped to the [Deposit entity](https://github.com/across-protocol/scraper-api/blob/master/src/modules/deposit/model/deposit.entity.ts)
2. In the [ReferralCronService](https://github.com/across-protocol/scraper-api/blob/stage/src/modules/referral/services/cron-service.ts) these's a cron that computes the referral statistics for the deposits. [The logic from here](https://github.com/across-protocol/scraper-api/blob/stage/src/modules/referral/services/service.ts#L268) groups deposit by referral address and claimed referral rewards and it computes for each deposit the number of previous deposits using the same referral address and also the volume associated with them. This is useful for computing the [**referral tier**](https://github.com/across-protocol/scraper-api/blob/stage/src/modules/referral/services/service.ts#L156-L171) at each deposit time. All these numbers are finally stored in the `deposit_referral_stat` table mapped to the [DepositReferralStat](https://github.com/across-protocol/scraper-api/blob/stage/src/modules/deposit/model/deposit-referral-stat.entity.ts) entity.
3. The same [ReferralCronService](https://github.com/across-protocol/scraper-api/blob/stage/src/modules/referral/services/cron-service.ts) [refreshes](https://github.com/across-protocol/scraper-api/blob/stage/src/modules/referral/services/cron-service.ts#L43C84-L43C95) the `deposits_mv` materialized view mapped to the entity from [here](https://github.com/across-protocol/scraper-api/blob/stage/src/modules/deposit/model/DepositsMv.entity.ts). This materialized view is used to populate the UI table that lists deposits elligible deposits for referral rewards and to serve all the data related to referral rewards.

### How to create a new window for referral rewards

1. Create a new job for computing referral rewards by calling `POST referral-rewards-window-job` endpoint. This triggers the start of an asynchronous job that computes the data associated with a distribution window. Keep in mind that this is an async job, so the results can be obtained by using the `GET referral-rewards-window-job/:id` endpoint. 
This asynchronous job does to things: it populates the [ReferralRewardsWindowJobResult table](https://github.com/across-protocol/scraper-api/blob/master/src/modules/referral/model/ReferralRewardsWindowJobResult.entity.ts) with the results of the jobs if they didn't fail and also associates a `rewardsWindowIndex` to the elligible deposits by populating the column with the same name.
2. The job results are used by the [merkle-distributor cli tool](https://github.com/across-protocol/merkle-distributor) for computing the Merkle Distributor claims (proofs) which are sent in the end to Scraper API db by running the `yarn publish-tree` command. Under the hood this calls the `POST /upload/merkle-distributor-recipients` endpoint which stores in the DB all the Merkle Distributor claims that can be later fetched and used in the FE to claim the rewards from the contract.
