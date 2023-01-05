# Scraper API

API service for serving Across V2 data.

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

Can be one or multiple of 
- scraper
- normal
- test

2022-11-28 17:01:59