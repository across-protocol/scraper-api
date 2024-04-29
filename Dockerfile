FROM node:18 AS development

WORKDIR /usr/src/app
COPY package*.json ./
COPY yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts
COPY . .
RUN yarn build

FROM node:18 AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package*.json ./
COPY yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts
COPY . .
COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/main"]
