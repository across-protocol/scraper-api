import { registerAs } from '@nestjs/config';

export default registerAs('config', () => {
  return {
    app: {
      port: parseInt(process.env.PORT, 10),
    },
  };
});
