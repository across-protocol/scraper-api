import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { NestExpressApplication } from "@nestjs/platform-express";
// import dotenv from "dotenv";
// dotenv.config();

import { AppModule } from "./app.module";
import { AppConfig } from "./modules/configuration/configuration.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "./validation.pipe";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot());
  const config = app.get(AppConfig);
  const port = config.values.app.port;

  app.enableCors({ origin: true });
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe());

  const options = new DocumentBuilder()
    .setTitle("Scraper API")
    .setDescription("Scraper API spec")
    .setVersion("1.0")
    .addTag("health")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup("swagger", app, document);

  await app.listen(port);
}

bootstrap();
