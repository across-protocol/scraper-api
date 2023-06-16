import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import helmet from "helmet";
import { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { AppConfig } from "./modules/configuration/configuration.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "./validation.pipe";
import { configValues } from "./modules/configuration";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot({ runModes: configValues().app.runModes }),
  );
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

  const logger = new Logger("NestApplication");
  logger.log(`Listening on port ${port}`);
  logger.log(`Running in modes: ${config.values.app.runModes}`);
}

bootstrap();
