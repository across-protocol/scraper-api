#!/bin/bash

yarn install
yarn db:migration:run
yarn start
