#!/bin/bash

yarn install
yarn db:migration:run
yarn test:e2e --force-exit
