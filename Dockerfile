FROM node:current-alpine

WORKDIR /app

COPY package.json /app

RUN yarn install

COPY . /app

EXPOSE 8888

CMD yarn start