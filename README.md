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
    C -->|SuggestedFeesQueueMsg| J(SuggestedFeesQueue)
    
    D --> |DepositFilledDateQueueMsg| K(DepositFilledDateQueue)
    D --> |TrackFillEventQueueMsg| L(TrackFillEventQueue)

    H --> |TokenPriceQueueMsg| M(TokenPriceQueue)
  ```

## OP Rebates

Deposits sent to an OP stack chain accruel OP rewards. New chains can be added as needed by editing [this line](https://github.com/across-protocol/scraper-api/blob/master/src/modules/rewards/services/op-rebate-service.ts#L263-L265).

## Add new SpokePool contracts

For adding SpokePool contract to query events from, these steps need to be followed:

1. Make sure a provider is added in the `web3.providers` list from [here](https://github.com/across-protocol/scraper-api/blob/master/src/modules/configuration/index.ts#L61) for the chain. The env variable in the production environment must be added via [zion](https://github.com/UMAprotocol/zion/blob/master/docs/comp-doc/howto-across-api.md#update-variables).

2. Add the SpokePool contract configuration [here](https://github.com/across-protocol/scraper-api/blob/master/src/modules/configuration/index.ts#L94). 

3. (_Optionally_) If the scraping process requires a custom distance to be maintained from the head block, add it [here](https://github.com/across-protocol/scraper-api/blob/master/src/modules/scraper/service.ts#L212).

:warning: Make sure the contract address is the proxy address, not the address of the implementation contract.