FROM node:16-alpine AS development

RUN apk --no-cache add --virtual .builds-deps build-base python3 git

WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn install
COPY . .
RUN yarn build

FROM node:16-stretch AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn install
COPY . .
COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/main"]
