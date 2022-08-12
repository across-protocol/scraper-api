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

- `stage` branch is used to deploy it to the staging environment
- for production deployment always merge `stage` branch into `master`